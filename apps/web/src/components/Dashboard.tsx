import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/AuthContext";
import { UserRole } from "@/lib/UserRoles";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  LogOut, 
  ExternalLink, 
  Crown, 
  User, 
  Users, 
  ChevronDown, 
  ChevronRight, 
  Settings, 
  LayoutDashboard, 
  ShieldAlert 
} from "lucide-react";
import { SessionStatus } from "@/components/SessionStatus";

// Core Engine Imports
import { useCoreEngine } from "@/core/useCoreEngine";
import { ModuleErrorBoundary } from "@/core/ModuleErrorBoundary";
import "@/core/registeredModules"; // Assegura o registro de todos os módulos no catálogo

import { subscribeToConflicts } from "@/services/scheduleService";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { db } from "@/lib/db";
import { collection, getDocs, doc, updateDoc, getDoc, setDoc, serverTimestamp } from "@/lib/sira-sql-adapter";

const UserSettingsModal = React.lazy(() => import("./users/UserSettingsModal").then(m => ({ default: m.UserSettingsModal })));

// Componente de carregamento leve
const ModuleLoader = () => (
  <div className="flex flex-col items-center justify-center h-full space-y-4 animate-in fade-in duration-500">
    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-gray-500 font-medium">Carregando módulo...</p>
  </div>
);

const Dashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { userRole, userData, isUserSuperAdmin } = usePermissions();
  const { config: systemConfig } = useSystemConfig();
  
  // Utiliza o motor principal (Core Engine) para controle dinâmico de módulos
  const { 
    activeModuleId, 
    setActiveModuleId, 
    navGroups, 
    currentModuleDef,
    authorizedModules
  } = useCoreEngine();

  // Apenas um grupo expandido por vez; inicia com TODOS os menus fechados (null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const toggleGroup = (label: string) => {
    setExpandedGroup(prev => (prev === label ? null : label));
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pendingConflictsCount, setPendingConflictsCount] = useState(0);
  const [units, setUnits] = useState<any[]>([]);
  
  // Controla a animação de troca de unidade (3 segundos)
  const [isUnitChanging, setIsUnitChanging] = useState(false);
  const [changingUnitName, setChangingUnitName] = useState("");

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const snap = await getDocs(collection(db, "units"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setUnits(list);
      } catch (err) {
        console.error("Erro ao buscar unidades:", err);
      }
    };
    fetchUnits();
  }, []);

  // Auto-seed para certificar que a nova unidade Barra do Bugres existe
  useEffect(() => {
    const ensureBarraDoBugres = async () => {
      if (isSuperAdmin && currentUser) {
        try {
          const unitRef = doc(db, "units", "barra-do-bugres");
          const unitSnap = await getDoc(unitRef);
          
          let dbUpdated = false;
          
          if (!unitSnap.exists()) {
            await setDoc(unitRef, {
              name: "SENAI Barra do Bugres",
              code: "BB",
              createdAt: serverTimestamp()
            });
            console.log("Unidade Barra do Bugres criada no Firestore.");
            dbUpdated = true;
          }

          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const currentUnitIds = userSnap.data().unitIds || [];
            if (!currentUnitIds.includes("barra-do-bugres")) {
              await updateDoc(userRef, {
                unitIds: [...currentUnitIds, "barra-do-bugres"]
              });
              console.log("Unidade Barra do Bugres adicionada ao super admin.");
              dbUpdated = true;
            }
          }

          if (dbUpdated) {
            const snap = await getDocs(collection(db, "units"));
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setUnits(list);
          }
        } catch (error) {
          console.error("Erro ao certificar unidade Barra do Bugres:", error);
        }
      }
    };
    ensureBarraDoBugres();
  }, [currentUser]);

  const userUnitIds = userData?.unitIds || [];
  const selectedUnitId = userData?.selectedUnitId || "caceres";
  const isSuperAdmin = isUserSuperAdmin();

  // Determinar quais unidades mostrar no selector
  const availableUnits = useMemo(() => {
    // 1. SUPER_ADMIN tem acesso global a todas as unidades cadastradas (Estrutura de Papéis)
    if (isSuperAdmin) {
      return units;
    }
    // 2. ADMIN e USUARIO possuem acesso apenas às unidades atribuídas
    if (userUnitIds.length > 0) {
      const filtered = units.filter(u => userUnitIds.includes(u.id));
      if (filtered.length > 0) return filtered;
    }
    return units.filter(u => u.id === selectedUnitId);
  }, [units, isSuperAdmin, userUnitIds, selectedUnitId]);

  const handleUnitChange = async (unitId: string) => {
    if (!currentUser || unitId === selectedUnitId) return;
    const unitName = availableUnits.find(u => u.id === unitId)?.name || unitId;
    setChangingUnitName(unitName);
    setIsUnitChanging(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        selectedUnitId: unitId
      });
    } catch (err) {
      console.error("Erro ao alternar unidade:", err);
    }
    setTimeout(() => setIsUnitChanging(false), 3000);
  };

  // Garante que a unidade ativa do usuário esteja dentro de suas unidades autorizadas
  useEffect(() => {
    if (availableUnits.length > 0) {
      const isValid = availableUnits.some(u => u.id === selectedUnitId);
      if (!isValid && availableUnits[0]) {
        handleUnitChange(availableUnits[0].id);
      }
    }
  }, [availableUnits, selectedUnitId]);

  useEffect(() => {
    // Subscrever à contagem de conflitos pendentes apenas para ADM
    if (userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN) {
      const unsubscribe = subscribeToConflicts((data) => {
        setPendingConflictsCount(data.length);
      });
      return () => unsubscribe();
    }
  }, [userRole]);

  const handleOpenPublicView = () => {
    window.open(`/public-view/${selectedUnitId}`, "_blank");
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const roleLabel = 
    userRole === UserRole.SUPER_ADMIN ? "Super Administrador(a)" :
    userRole === UserRole.ADMIN ? "Administrador(a)" : 
    userRole === UserRole.USER ? "Operacional" : 
    userRole === UserRole.PROFESSOR ? "Professor(a)" : 
    userRole === UserRole.PARTNER_SCHOOL ? "Escola Parceira" : "Usuário(a)";

  // Módulo de Visão Geral (Overview) fixado no topo
  const overviewModule = useMemo(() => {
    return authorizedModules.find(m => m.id === 'overview');
  }, [authorizedModules]);

  // Grupos do menu lateral excluindo o overview (que fica no topo)
  const categoryGroups = useMemo(() => {
    return navGroups
      .map(group => ({
        ...group,
        modules: group.modules.filter(m => m.id !== 'overview')
      }))
      .filter(group => group.modules.length > 0);
  }, [navGroups]);

  // Renderizador do módulo ativo com barreira de isolamento de falha (ErrorBoundary)
  const renderActiveModule = () => {
    if (!currentModuleDef) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-3 p-8">
          <ShieldAlert className="h-12 w-12 text-amber-500 animate-pulse" />
          <p className="font-bold text-gray-800 dark:text-gray-100 text-lg">Módulo Não Disponível</p>
          <p className="text-sm text-gray-500 max-w-md text-center">
            Você não possui permissão para acessar este módulo ou ele está em manutenção.
          </p>
        </div>
      );
    }

    const Component = currentModuleDef.component;
    return (
      <ModuleErrorBoundary
        key={currentModuleDef.id}
        moduleId={currentModuleDef.id}
        moduleTitle={currentModuleDef.title}
      >
        <Component {...(currentModuleDef.defaultProps || {})} />
      </ModuleErrorBoundary>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar / Menu Lateral Dinâmico do Core */}
      <aside className="w-72 bg-gray-900 text-white flex flex-col shadow-lg">
        {/* Seletor de Unidade */}
        <div className="p-4 border-b border-gray-700 flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Unidade Ativa</span>
          {availableUnits.length > 1 ? (
            <select
              value={selectedUnitId}
              onChange={(e) => handleUnitChange(e.target.value)}
              className="bg-gray-800 text-white border border-gray-700 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer w-full transition-all duration-200 hover:bg-gray-750"
            >
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id} className="bg-gray-900 text-white">
                  {u.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="font-bold text-base text-white py-1">
              {units.find(u => u.id === selectedUnitId)?.name || "SENAI Cáceres"}
            </div>
          )}
        </div>

        {/* Navegação Construída Dinamicamente pelo Core Engine */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {/* 1. Módulo Inicial / Visão Geral (Overview) FIXADO NO TOPO */}
          {overviewModule && (
            <button
              key="overview-top-item"
              onClick={() => {
                setActiveModuleId('overview');
                setExpandedGroup(null); // Fecha menus acordeão ao ir para a Visão Geral
              }}
              className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors duration-200 mb-1.5 ${
                activeModuleId === 'overview'
                  ? "bg-blue-600 text-white font-semibold shadow-sm"
                  : "hover:bg-gray-800 text-gray-400"
              }`}
            >
              <overviewModule.icon className="h-4 w-4 shrink-0" />
              <span className="text-sm truncate font-medium">{overviewModule.title}</span>
            </button>
          )}

          {/* 2. Categorias com sistema de recolhimento único (abre um, recolhe o anterior) */}
          {categoryGroups.map((group, groupIndex) => {
            // Se o grupo tiver apenas 1 módulo, renderiza diretamente como item único
            if (group.modules.length === 1) {
              const mod = group.modules[0];
              const Icon = mod.icon;
              const isActive = activeModuleId === mod.id;
              const badgeValue = typeof mod.badge === 'function' 
                ? mod.badge({ pendingConflictsCount, userRole, userData }) 
                : mod.badge;

              return (
                <button
                  key={mod.id}
                  onClick={() => {
                    setActiveModuleId(mod.id);
                    setExpandedGroup(null);
                  }}
                  className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-colors duration-200 ${
                    isActive
                      ? "bg-blue-600 text-white font-semibold shadow-sm"
                      : "hover:bg-gray-800 text-gray-400"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm truncate">{mod.title}</span>
                  {badgeValue !== null && badgeValue !== undefined && (
                    <span className="ml-auto inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                      {badgeValue}
                    </span>
                  )}
                </button>
              );
            }

            // Categoria com múltiplos módulos: Acordeão com comportamento exclusivo (apenas 1 aberto)
            const GroupIcon = group.category.icon;
            const isChildActive = group.modules.some(m => m.id === activeModuleId);
            const isExpanded = expandedGroup === group.category.label;

            return (
              <div key={`group-${groupIndex}`} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.category.label)}
                  className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center justify-between gap-3 transition-colors duration-200 ${
                    isChildActive && !isExpanded
                      ? "bg-gray-800 text-white font-semibold"
                      : "hover:bg-gray-800 text-gray-400"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <GroupIcon className="h-4 w-4 shrink-0" />
                    <span className="text-sm truncate">{group.category.label}</span>
                  </div>
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="pl-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                    {group.modules.map((mod) => {
                      const Icon = mod.icon;
                      const isActive = activeModuleId === mod.id;
                      const badgeValue = typeof mod.badge === 'function'
                        ? mod.badge({ pendingConflictsCount, userRole, userData })
                        : mod.badge;

                      return (
                        <button
                          key={mod.id}
                          onClick={() => setActiveModuleId(mod.id)}
                          className={`w-full text-left px-4 py-2 rounded-lg flex items-center gap-3 transition-colors duration-200 ${
                            isActive
                              ? "bg-blue-600/20 text-blue-400 font-semibold"
                              : "hover:bg-gray-800/50 text-gray-500"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-xs truncate">{mod.title}</span>
                          {badgeValue !== null && badgeValue !== undefined && (
                            <span className="ml-auto inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                              {badgeValue}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Rodapé de Identificação do Usuário */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {(userData?.name || currentUser?.email)?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white truncate">
                  {userData?.name || currentUser?.displayName || "Usuário(a)"}
                </p>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-all"
                  title="Configurações da Conta"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 truncate">
                {currentUser?.email}
              </p>
              <div className="flex items-center gap-1 mt-1">
                {userRole === UserRole.SUPER_ADMIN ? (
                  <Crown className="h-3.5 w-3.5 text-purple-400 animate-pulse" />
                ) : userRole === UserRole.ADMIN ? (
                  <Crown className="h-3 w-3 text-yellow-400" />
                ) : userRole === UserRole.PARTNER_SCHOOL ? (
                  <Users className="h-3 w-3 text-emerald-400" />
                ) : (
                  <User className="h-3 w-3 text-blue-400" />
                )}
                <p className="text-xs text-gray-300 truncate">{roleLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ações Rápidas & Logout */}
        <div className="p-2 border-t border-gray-700 space-y-2">
          {userRole !== UserRole.PROFESSOR && (
            <>
              <button
                onClick={handleOpenPublicView}
                className="w-full text-left px-4 py-2 rounded flex items-center gap-3 text-sm text-gray-300 hover:bg-gray-700 transition-colors duration-200"
              >
                <ExternalLink className="h-4 w-4" />
                Ver Grade Pública
              </button>
              <button
                onClick={() => window.open("/dashboard-publico", "_blank")}
                className="w-full text-left px-4 py-2 rounded flex items-center gap-3 text-sm text-gray-300 hover:bg-gray-700 transition-colors duration-200"
              >
                <LayoutDashboard className="h-4 w-4" />
                Visão BI Pública
              </button>
            </>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded flex items-center gap-3 text-sm text-red-400 hover:bg-red-500 hover:text-white transition-colors duration-200"
          >
            <LogOut className="h-4 w-4" />
            Sair (Logout)
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal do Core */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-50 dark:bg-slate-900 relative">
        <div className="shrink-0 px-6 pt-3 z-40">
          <SessionStatus />
        </div>

        {/* Overlay de troca de unidade */}
        {isUnitChanging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <Settings className="h-16 w-16 text-blue-600 animate-spin" style={{ animationDuration: '1.5s' }} />
                <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-blue-100 border-t-blue-400 animate-spin" style={{ animationDuration: '0.8s', animationDirection: 'reverse' }}></div>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800 dark:text-gray-100">Carregando dados</p>
                <p className="text-sm text-blue-600 font-semibold mt-1">{changingUnitName}</p>
                <p className="text-xs text-gray-500 mt-2">Atualizando todos os módulos para a unidade selecionada...</p>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Janela de Renderização do Módulo Isolado com Error Boundary */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <React.Suspense fallback={<ModuleLoader />}>
            {renderActiveModule()}
          </React.Suspense>
        </div>

        <React.Suspense fallback={null}>
          <UserSettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            userData={userData}
            currentUser={currentUser}
          />
        </React.Suspense>
      </main>
    </div>
  );
};

export default Dashboard;
