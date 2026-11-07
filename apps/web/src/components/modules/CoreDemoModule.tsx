import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ModuleRegistry } from '@/core/ModuleRegistry';
import { 
  Cpu, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  Zap, 
  FileCode2, 
  Lock, 
  Unlock, 
  Boxes,
  Sparkles,
  ExternalLink,
  Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const CoreDemoModule: React.FC = () => {
  const { currentUser } = useAuth();
  const { userRole, userData, isUserSuperAdmin } = usePermissions();
  const [shouldCrash, setShouldCrash] = useState(false);

  // Se o botão de crash for ativado, dispara uma exceção em tempo de execução
  if (shouldCrash) {
    throw new Error(
      "Simulação de Erro Não Tratado: Um erro crítico ocorreu dentro do componente CoreDemoModule. O Core interceptou a falha com sucesso!"
    );
  }

  const isSuperAdmin = isUserSuperAdmin();
  const allModules = ModuleRegistry.getAllModules();
  const userModules = ModuleRegistry.getModulesForUser(userRole, userData, isSuperAdmin);
  const userModuleIds = new Set(userModules.map(m => m.id));

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-900">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-800 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-blue-400/20 text-blue-200 border-blue-300/30 flex items-center gap-1.5 py-1">
                <Sparkles className="h-3.5 w-3.5 text-blue-300" />
                Arquitetura Micro-Kernel Ativa
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 py-1">
                Core Engine v1.0
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Motor Principal & Módulo de Diagnóstico
            </h1>
            <p className="text-blue-100/90 text-sm mt-1 max-w-2xl">
              Este módulo exemplifica a nova arquitetura desacoplada: cada funcionalidade opera isolada com barreira de proteção de falhas, carregamento dinâmico e concessão de acessos sob demanda.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/15 text-center">
              <span className="block text-2xl font-bold">{userModules.length} / {allModules.length}</span>
              <span className="text-[11px] text-blue-200 uppercase font-medium">Módulos Acessíveis</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Demonstração */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Teste de Isolamento de Falhas (Error Boundary) */}
        <Card className="border-red-200 dark:border-red-900/40 shadow-sm bg-white dark:bg-slate-800 lg:col-span-1 flex flex-col">
          <CardHeader className="bg-red-50/60 dark:bg-red-950/20 pb-4 border-b border-red-100 dark:border-red-900/20">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Flame className="h-5 w-5" />
              <CardTitle className="text-base font-bold">Laboratório de Falhas</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Teste a tolerância do Core a quebras de componentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Clique no botão abaixo para forçar um erro em tempo de execução (<code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-red-600 font-mono">throw new Error</code>). 
              Você verá que <strong>apenas este módulo</strong> entra no estado de falha, enquanto a barra lateral, os outros módulos e suas permissões continuam 100% preservados!
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span>Garantia de Isolamento:</span>
              </div>
              <span className="text-[11px] text-gray-500">
                Se um módulo novo falhar em produção, a equipe pode trabalhar exclusivamente nele sem derrubar o restante da plataforma.
              </span>
            </div>

            <Button
              variant="destructive"
              className="w-full flex items-center justify-center gap-2 font-semibold shadow-md hover:shadow-lg transition-all"
              onClick={() => setShouldCrash(true)}
            >
              <Flame className="h-4 w-4" />
              Simular Falha no Módulo Agora
            </Button>
          </CardContent>
        </Card>

        {/* Card 2: Sessão & Permissões do Usuário */}
        <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-slate-800 lg:col-span-2">
          <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Cpu className="h-5 w-5" />
                <CardTitle className="text-base font-bold">Estado da Sessão no Core</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                UID: {currentUser?.uid.slice(0, 10)}...
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Contexto transmitido pelo Core para os módulos plugados.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block mb-1">
                  Usuário Ativo
                </span>
                <p className="text-sm font-semibold truncate text-gray-800 dark:text-gray-200">
                  {userData?.name || currentUser?.displayName || currentUser?.email}
                </p>
                <p className="text-xs text-gray-500 truncate">{currentUser?.email}</p>
              </div>

              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 rounded-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block mb-1">
                  Perfil (Role)
                </span>
                <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                  {userRole || 'Não definido'}
                </p>
                <p className="text-xs text-gray-500">{isSuperAdmin ? 'Super Administrador' : 'Usuário Padrão'}</p>
              </div>

              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block mb-1">
                  Unidade Selecionada
                </span>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 uppercase">
                  {userData?.selectedUnitId || 'caceres'}
                </p>
                <p className="text-xs text-gray-500">Unidades autorizadas: {userData?.unitIds?.length || 1}</p>
              </div>
            </div>

            {/* Explicação de liberação dinâmica */}
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <span className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-amber-500" />
                Como funciona a liberação de novos módulos para este usuário:
              </span>
              <p>
                O Core avalia as permissões do perfil (<code className="text-blue-600 font-mono">defaultRoles</code>) e verifica se há permissões específicas no Firestore (<code className="text-blue-600 font-mono">allowedModules: ['modulo-x', 'modulo-y']</code>). Qualquer módulo concedido pelo administrador é disponibilizado no menu instantaneamente.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Módulos Registrados no Core */}
      <Card className="border-gray-200 dark:border-gray-800 shadow-sm bg-white dark:bg-slate-800">
        <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Boxes className="h-5 w-5" />
              <CardTitle className="text-base font-bold">Catálogo de Módulos Registrados no Core Engine</CardTitle>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {allModules.length} Módulos Catalogados
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Lista de módulos auto-registrados no ModuleRegistry e o status de liberação para sua conta atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 border-b border-gray-200 dark:border-gray-700 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3">ID / Rota</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Perfis Padrão</th>
                  <th className="px-4 py-3 text-center">Status para Você</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {allModules.map((mod) => {
                  const hasAccess = userModuleIds.has(mod.id);
                  const Icon = mod.icon;

                  return (
                    <tr key={mod.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span>{mod.title}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-500">{mod.id}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize text-[11px]">
                          {mod.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {mod.superAdminOnly ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                            Super Admin
                          </Badge>
                        ) : (
                          mod.defaultRoles.join(', ') || 'Nenhum'
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {hasAccess ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <Unlock className="h-3.5 w-3.5" />
                            Liberado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 font-medium">
                            <Lock className="h-3.5 w-3.5" />
                            Bloqueado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CoreDemoModule;
