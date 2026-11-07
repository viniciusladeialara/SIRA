import React, { useState, useEffect } from 'react';
import { LoginVariant, useSystemConfig } from '@/hooks/useSystemConfig';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, Loader2, Sparkles, Shield, Link2, Trash2, AlertTriangle, CheckCircle, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, writeBatch, updateDoc, serverTimestamp } from 'firebase/firestore';
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";

export const SystemSettingsModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { isUserAdmin, isUserSuperAdmin } = usePermissions();
  const { config, loading, setLoginVariant, updateConfig } = useSystemConfig();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const isMasterUser = isUserSuperAdmin();

  const formatConfigDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      const d = (date && typeof date.toDate === 'function') ? date.toDate() : new Date(date);
      return d.toLocaleString('pt-BR');
    } catch { return 'Data inválida'; }
  };

  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);

  const scanGhostData = async () => {
    setIsScanning(true);
    try {
      const [roomsSnap, classesSnap, teachersSnap, coursesSnap, schedulesSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, "rooms")),
        getDocs(collection(db, "classes")),
        getDocs(collection(db, "teachers")),
        getDocs(collection(db, "courses")),
        getDocs(collection(db, "schedules")),
        getDocs(collection(db, "users"))
      ]);

      const rooms = new Map(roomsSnap.docs.map(d => [d.id, d.data()]));
      const classes = new Map(classesSnap.docs.map(d => [d.id, d.data()]));
      const teachers = new Map(teachersSnap.docs.map(d => [d.id, d.data()]));
      const courses = new Map(coursesSnap.docs.map(d => [d.id, d.data()]));
      const users = new Map(usersSnap.docs.map(d => [d.id, d.data()]));

      const list: any[] = [];

      schedulesSnap.docs.forEach(dSnap => {
        const sched = dSnap.data();
        const id = dSnap.id;
        const issues: string[] = [];

        const isDirect = sched.classId === "direct_booking" || 
                         sched.courseId === "direct_booking" || 
                         sched.isDirectBooking === true ||
                         sched.className?.toLowerCase().includes("reserva");

        if (sched.roomId && !rooms.has(sched.roomId)) {
          issues.push(`Ambiente fantasma: "${sched.roomName || sched.roomId}"`);
        }

        if (isDirect) {
          // Em reservas diretas: se o teacherId não é "direct_booking" e não é professor da tabela teachers:
          // Trata-se do ID do usuário administrativo que fez o agendamento.
          // Devemos NORMALIZAR (definir teacherId como "direct_booking" e salvar responsibleUserId), SEM DELETAR!
          if (sched.teacherId && sched.teacherId !== "direct_booking" && !teachers.has(sched.teacherId)) {
            list.push({
              id,
              type: 'normalize_direct_booking',
              label: `Reserva Direta: ${sched.className || 'Reserva'}`,
              description: `Responsável: "${sched.teacherName || sched.teacherId}" (Normalizar para reserva direta sem excluir)`,
              docRef: dSnap.ref,
              currentTeacherId: sched.teacherId,
              teacherName: sched.teacherName
            });
            return;
          }
        } else {
          // Agendamentos de aulas normais
          if (sched.teacherId && sched.teacherId !== "direct_booking" && !teachers.has(sched.teacherId)) {
            issues.push(`Professor fantasma: "${sched.teacherName || sched.teacherId}"`);
          }
          if (sched.classId && sched.classId !== "direct_booking" && !classes.has(sched.classId)) {
            issues.push(`Turma fantasma: "${sched.className || sched.classId}"`);
          }
          if (!sched.teacherId) {
            issues.push("Sem professor definido");
          }
        }

        if (issues.length > 0) {
          list.push({
            id,
            type: 'schedule',
            label: `Agendamento: ${sched.className || 'Reserva'}`,
            description: issues.join(" | "),
            docRef: dSnap.ref
          });
        }
      });

      classesSnap.docs.forEach(dSnap => {
        const cls = dSnap.data();
        const id = dSnap.id;
        const issues: string[] = [];

        if (cls.teacherIds && Array.isArray(cls.teacherIds)) {
          cls.teacherIds.forEach((tId: string) => {
            if (!teachers.has(tId)) {
              issues.push(`Professor fantasma ID: ${tId}`);
            }
          });
        }
        if (cls.environmentIds && Array.isArray(cls.environmentIds)) {
          cls.environmentIds.forEach((rId: string) => {
            if (!rooms.has(rId)) {
              issues.push(`Ambiente fantasma ID: ${rId}`);
            }
          });
        }

        if (issues.length > 0) {
          list.push({
            id,
            type: 'class',
            label: `Turma: ${cls.name}`,
            description: issues.join(" | "),
            docRef: dSnap.ref,
            payload: {
              teacherIds: (cls.teacherIds || []).filter((tId: string) => teachers.has(tId)),
              teacherNames: (cls.teacherNames || []).filter((_: any, idx: number) => teachers.has(cls.teacherIds[idx])),
              environmentIds: (cls.environmentIds || []).filter((rId: string) => rooms.has(rId))
            }
          });
        }
      });

      setAnomalies(list);
      toast({
        title: "Diagnóstico Concluído",
        description: `Encontradas ${list.length} ocorrências no banco.`
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro no Diagnóstico",
        description: "Falha ao escanear inconsistências de dados.",
        variant: "destructive"
      });
    } finally {
      setIsScanning(false);
    }
  };

  const normalizeSingleBooking = async (anomaly: any) => {
    try {
      await updateDoc(anomaly.docRef, {
        teacherId: "direct_booking",
        responsibleUserId: anomaly.currentTeacherId || null,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Sucesso", description: `Reserva "${anomaly.label}" normalizada com sucesso!` });
      setAnomalies(prev => prev.filter(a => a.id !== anomaly.id));
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao normalizar", description: err.message, variant: "destructive" });
    }
  };

  const normalizeAllDirectBookings = async () => {
    const directItems = anomalies.filter(a => a.type === 'normalize_direct_booking');
    if (directItems.length === 0) return;
    setIsNormalizing(true);
    try {
      const batch = writeBatch(db);
      directItems.forEach(item => {
        batch.update(item.docRef, {
          teacherId: "direct_booking",
          responsibleUserId: item.currentTeacherId || null,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
      toast({
        title: "Normalização Concluída!",
        description: `${directItems.length} reservas diretas foram normalizadas com sucesso para "direct_booking". Nenhuma reserva foi excluída!`
      });
      setAnomalies(prev => prev.filter(a => a.type !== 'normalize_direct_booking'));
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro na Normalização",
        description: err.message || "Falha ao normalizar reservas diretas.",
        variant: "destructive"
      });
    } finally {
      setIsNormalizing(false);
    }
  };

  const deleteAnomaly = async (anomaly: any) => {
    try {
      if (anomaly.type === 'normalize_direct_booking') {
        await normalizeSingleBooking(anomaly);
        return;
      }
      if (anomaly.type === 'schedule') {
        await deleteDoc(anomaly.docRef);
        toast({ title: "Sucesso", description: "Agendamento fantasma removido!" });
      } else if (anomaly.type === 'class') {
        const batch = writeBatch(db);
        batch.update(anomaly.docRef, anomaly.payload);
        await batch.commit();
        toast({ title: "Sucesso", description: "Referências fantasmas removidas da turma!" });
      }
      setAnomalies(prev => prev.filter(a => a.id !== anomaly.id));
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao processar", description: err.message, variant: "destructive" });
    }
  };

  const clearAllAnomalies = async () => {
    if (anomalies.length === 0) return;
    setIsClearing(true);
    try {
      const batch = writeBatch(db);
      anomalies.forEach(anomaly => {
        if (anomaly.type === 'normalize_direct_booking') {
          // Proteção absoluta: reservas diretas são NORMALIZADAS, nunca apagadas acidentalmente!
          batch.update(anomaly.docRef, {
            teacherId: "direct_booking",
            responsibleUserId: anomaly.currentTeacherId || null,
            updatedAt: serverTimestamp()
          });
        } else if (anomaly.type === 'schedule') {
          batch.delete(anomaly.docRef);
        } else if (anomaly.type === 'class') {
          batch.update(anomaly.docRef, anomaly.payload);
        }
      });
      await batch.commit();
      toast({
        title: "Sucesso",
        description: `Todas as ${anomalies.length} inconsistências foram corrigidas/normalizadas!`
      });
      setAnomalies([]);
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro na Limpeza",
        description: "Falha ao executar limpeza em lote.",
        variant: "destructive"
      });
    } finally {
      setIsClearing(false);
    }
  };

  const [links, setLinks] = useState({
    portalDocenteLink: '',
    portalDocenteLabel: '',
    meuSenaiLink: '',
    meuSenaiLabel: '',
    pesquisaSensorialLink: '',
    pesquisaSensorialLabel: '',
    gradePublicaLink: '',
    gradePublicaLabel: '',
  });

  useEffect(() => {
    if (config) {
      setLinks({
        portalDocenteLink: config.portalDocenteLink || '',
        portalDocenteLabel: config.portalDocenteLabel || '',
        meuSenaiLink: config.meuSenaiLink || '',
        meuSenaiLabel: config.meuSenaiLabel || '',
        pesquisaSensorialLink: config.pesquisaSensorialLink || '',
        pesquisaSensorialLabel: config.pesquisaSensorialLabel || '',
        gradePublicaLink: config.gradePublicaLink || '',
        gradePublicaLabel: config.gradePublicaLabel || '',
      });
    }
  }, [config]);

  const handleSaveLinks = async (e: React.FormEvent) => {
    e.preventDefault();

    const validateUrl = (url: string) => {
      if (!url) return false;
      return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
    };

    if (
      !validateUrl(links.portalDocenteLink) ||
      !validateUrl(links.meuSenaiLink) ||
      !validateUrl(links.pesquisaSensorialLink) ||
      !validateUrl(links.gradePublicaLink)
    ) {
      toast({
        title: "Erro de Validação",
        description: "Todas as URLs de destino devem começar com http://, https:// ou / para garantir a segurança do sistema.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUpdating(true);
      await updateConfig(links, currentUser?.uid);
      toast({
        title: "Sucesso",
        description: "Links do painel do professor atualizados com sucesso.",
        variant: "default"
      });
    } catch (error) {
      console.error('Erro ao salvar links:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar os links. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const loginVariantOptions: Array<{
    value: LoginVariant;
    title: string;
    description: string;
    toastName: string;
  }> = [
    {
      value: 'senai',
      title: 'Login padrao SENAI',
      description: 'Layout atual do sistema.',
      toastName: 'Padrao SENAI',
    },
    {
      value: 'animation',
      title: 'Login Form Animation',
      description: 'Versao visual diferenciada para o login.',
      toastName: 'Animation',
    },
    {
      value: 'futuristic',
      title: 'Login Futurista',
      description: 'Experiencia imersiva com efeitos visuais e foco em UX.',
      toastName: 'Futurista',
    },
  ];

  if (!isUserAdmin()) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">Apenas administradores podem acessar as configurações do sistema.</p>
          </CardContent>
        </Card>
      </div>
    );
  }



  const handleSelectLoginVariant = async (variant: LoginVariant) => {
    try {
      setIsUpdating(true);
      await setLoginVariant(variant, currentUser?.uid);
      const selectedVariant = loginVariantOptions.find((option) => option.value === variant);
      toast({
        title: 'Sucesso',
        description: `Login ${selectedVariant?.toastName ?? variant} ativado com sucesso.`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Erro ao atualizar login:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível alterar a configuração do login.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <PageLayout className="bg-white dark:bg-gray-950">
      <PageHeader className="pb-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configurações do Sistema</h1>
        <p className="text-gray-600">Gerencie as configurações globais da aplicação.</p>
      </PageHeader>

      <PageContent className="pt-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Carregando configurações...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-7xl w-full">
          <div className="lg:col-span-5 space-y-6">
            {isMasterUser && (
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-transparent">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                      <Sparkles className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle>Login do Sistema</CardTitle>
                      <CardDescription className="mt-1">
                        Escolha a tela de login ativa no acesso principal. Apenas uma variante pode ficar habilitada por vez.
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 border-t border-emerald-200 space-y-3">
                {loginVariantOptions.map((variant) => {
                  const isActive = config.loginVariant === variant.value;
                  return (
                    <div key={variant.value} className={`rounded-xl border p-4 ${isActive ? 'border-emerald-500 bg-emerald-100/70' : 'border-slate-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{variant.title}</p>
                          <p className="text-sm text-slate-600">{variant.description}</p>
                        </div>
                        <Button
                          onClick={() => handleSelectLoginVariant(variant.value)}
                          disabled={isUpdating || isActive}
                          variant={isActive ? 'default' : 'outline'}
                        >
                          {isActive ? 'Ativo' : 'Ativar'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-emerald-700">A ativação de uma opção desativa automaticamente a outra, mantendo apenas o login selecionado.</p>
              </CardContent>
            </Card>
          )}

          {isMasterUser && (
            <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-transparent mt-6">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Shield className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle>Painel do Super Admin (Limpeza de Dados)</CardTitle>
                    <CardDescription className="mt-1">
                      Escanear e excluir agendamentos ou corrigir turmas com referências fantasmas.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 border-t border-amber-200 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={scanGhostData} disabled={isScanning || isClearing || isNormalizing} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold">
                    {isScanning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Escanear Inconsistências
                  </Button>
                  {anomalies.filter(a => a.type === 'normalize_direct_booking').length > 0 && (
                    <Button 
                      onClick={normalizeAllDirectBookings} 
                      disabled={isScanning || isClearing || isNormalizing} 
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5"
                    >
                      {isNormalizing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCheck className="h-4 w-4 mr-1" />}
                      Normalizar Reservas Diretas ({anomalies.filter(a => a.type === 'normalize_direct_booking').length})
                    </Button>
                  )}
                  {anomalies.filter(a => a.type !== 'normalize_direct_booking').length > 0 && (
                    <Button onClick={clearAllAnomalies} disabled={isScanning || isClearing || isNormalizing} variant="destructive">
                      {isClearing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Excluir/Corrigir Inconsistências ({anomalies.filter(a => a.type !== 'normalize_direct_booking').length})
                    </Button>
                  )}
                </div>

                {anomalies.length > 0 && (
                  <div className="max-h-[340px] overflow-y-auto border border-amber-200 rounded-lg bg-white p-2 divide-y divide-slate-100">
                    {anomalies.map(anomaly => (
                      <div key={anomaly.id} className="py-2 flex items-center justify-between gap-4 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800 truncate">{anomaly.label}</p>
                            {anomaly.type === 'normalize_direct_booking' && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                                Reserva Direta
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 break-words ${anomaly.type === 'normalize_direct_booking' ? 'text-emerald-700 font-medium' : 'text-red-500'}`}>
                            {anomaly.description}
                          </p>
                        </div>
                        {anomaly.type === 'normalize_direct_booking' ? (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 font-semibold shrink-0" 
                            onClick={() => normalizeSingleBooking(anomaly)}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                            Normalizar
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 font-bold shrink-0" onClick={() => deleteAnomaly(anomaly)}>
                            {anomaly.type === 'class' ? 'Corrigir' : 'Remover'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {isScanning && (
                  <p className="text-xs text-slate-600 animate-pulse">Consultando tabelas no Firestore...</p>
                )}
                
                {anomalies.length === 0 && !isScanning && (
                  <p className="text-xs text-amber-800">Use este painel para diagnosticar referências corrompidas no banco de dados.</p>
                )}
              </CardContent>
            </Card>
          )}

          </div>

          <div className="lg:col-span-7 space-y-6">
            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Link2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle>Links do Painel do Professor</CardTitle>
                    <CardDescription className="mt-1">
                      Gerencie as URLs e os nomes dos botões de acesso rápido exibidos na página do professor.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 border-t border-indigo-200">
              <form onSubmit={handleSaveLinks} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Portal Docente */}
                  <div className="space-y-2 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                    <h4 className="font-semibold text-sm text-indigo-950">1. Portal Docente</h4>
                    <div className="space-y-1">
                      <Label htmlFor="portalDocenteLabel" className="text-xs text-slate-500">Nome do Botão</Label>
                      <Input
                        id="portalDocenteLabel"
                        value={links.portalDocenteLabel}
                        onChange={(e) => setLinks(prev => ({ ...prev, portalDocenteLabel: e.target.value }))}
                        placeholder="Ex: Portal Docente"
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="portalDocenteLink" className="text-xs text-slate-500">URL de Destino</Label>
                      <Input
                        id="portalDocenteLink"
                        value={links.portalDocenteLink}
                        onChange={(e) => setLinks(prev => ({ ...prev, portalDocenteLink: e.target.value }))}
                        placeholder="http://..."
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Meu SENAI */}
                  <div className="space-y-2 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                    <h4 className="font-semibold text-sm text-indigo-950">2. Meu SENAI</h4>
                    <div className="space-y-1">
                      <Label htmlFor="meuSenaiLabel" className="text-xs text-slate-500">Nome do Botão</Label>
                      <Input
                        id="meuSenaiLabel"
                        value={links.meuSenaiLabel}
                        onChange={(e) => setLinks(prev => ({ ...prev, meuSenaiLabel: e.target.value }))}
                        placeholder="Ex: Meu SENAI"
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="meuSenaiLink" className="text-xs text-slate-500">URL de Destino</Label>
                      <Input
                        id="meuSenaiLink"
                        value={links.meuSenaiLink}
                        onChange={(e) => setLinks(prev => ({ ...prev, meuSenaiLink: e.target.value }))}
                        placeholder="https://..."
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Pesquisa Sensorial */}
                  <div className="space-y-2 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                    <h4 className="font-semibold text-sm text-indigo-950">3. Pesquisa Sensorial</h4>
                    <div className="space-y-1">
                      <Label htmlFor="pesquisaSensorialLabel" className="text-xs text-slate-500">Nome do Botão</Label>
                      <Input
                        id="pesquisaSensorialLabel"
                        value={links.pesquisaSensorialLabel}
                        onChange={(e) => setLinks(prev => ({ ...prev, pesquisaSensorialLabel: e.target.value }))}
                        placeholder="Ex: Pesquisa Sensorial"
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pesquisaSensorialLink" className="text-xs text-slate-500">URL de Destino</Label>
                      <Input
                        id="pesquisaSensorialLink"
                        value={links.pesquisaSensorialLink}
                        onChange={(e) => setLinks(prev => ({ ...prev, pesquisaSensorialLink: e.target.value }))}
                        placeholder="https://..."
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                  </div>

                  {/* Grade Pública */}
                  <div className="space-y-2 p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                    <h4 className="font-semibold text-sm text-indigo-950">4. Grade Pública</h4>
                    <div className="space-y-1">
                      <Label htmlFor="gradePublicaLabel" className="text-xs text-slate-500">Nome do Botão</Label>
                      <Input
                        id="gradePublicaLabel"
                        value={links.gradePublicaLabel}
                        onChange={(e) => setLinks(prev => ({ ...prev, gradePublicaLabel: e.target.value }))}
                        placeholder="Ex: Grade Pública"
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="gradePublicaLink" className="text-xs text-slate-500">URL de Destino</Label>
                      <Input
                        id="gradePublicaLink"
                        value={links.gradePublicaLink}
                        onChange={(e) => setLinks(prev => ({ ...prev, gradePublicaLink: e.target.value }))}
                        placeholder="Ex: /public-view"
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isUpdating} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                    {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar Alterações
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

            {config.updatedAt && (
              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-slate-100 shadow-sm bg-white">
                <p>Última atualização: {formatConfigDate(config.updatedAt)}</p>
                {config.updatedBy && <p>Por: {config.updatedBy}</p>}
              </div>
            )}
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
};
