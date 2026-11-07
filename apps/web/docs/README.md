# Central de Documentação Técnica - Macro Micro Schedule

Bem-vindo à documentação oficial do sistema **Macro Micro Schedule** (SENAI MT). Esta pasta reúne os guias arquiteturais, históricos, operacionais e de negócio da plataforma, operada 100% no ecossistema Google Cloud e Firebase.

---

## 🧭 Documentos Mestres (Inicie por Aqui)

| Documento | Descrição |
| :--- | :--- |
| 📜 **[De Onde Viemos](./DE_ONDE_VIEMOS.md)** | **Histórico e Evolução:** As dores iniciais, o MVP mono-unidade, a expansão multi-tenant, os gargalos do modelo monolítico e o porquê das decisões tomadas. |
| 🚀 **[Onde Estamos](./ONDE_ESTAMOS.md)** | **Estado Atual e Arquitetura Vigente:** O ecossistema em produção, funcionamento do Core Engine, catálogo completo de módulos, controle dinâmico de permissões e stack. |

---

## 📐 Arquitetura & Engenharia

* **[Arquitetura Core Modular (Micro-Kernel)](./ARQUITETURA_CORE_MODULAR.md):** Especificação técnica do Core, barreira de isolamento de falhas ([ModuleErrorBoundary](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/ModuleErrorBoundary.tsx)), catálogo ([ModuleRegistry](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/core/ModuleRegistry.ts)) e o passo a passo para plugar novos módulos.
* **[Guia de Permissões e Acessos (RBAC)](./GUIA_PERMISSOES_RBAC.md):** Matriz de autorizações por perfil (`SUPER_ADMIN`, `ADMIN`, `USER`, `PROFESSOR`, `PARTNER_SCHOOL`) e escopos por unidade e professor.
* **[Estrutura de Papéis](./Estrutura%20de%20Pap%C3%A9is.md):** Detalhamento dos níveis de privilégio e escopo multi-unidades da governança.
* **[Auditoria e Rastreabilidade](./AUDITORIA_E_RASTREABILIDADE.md):** Padrões de registro de logs imutáveis, trilha de auditoria append-only no Firestore e segurança contra alterações indevidas.

---

## 📚 Regras de Negócio & Operação

* **[Guia de Agendamentos e Conflitos](./GUIA_AGENDAMENTOS_E_CONFLITOS.md):** Regras de não-sobreposição, turnos oficiais no fuso de Mato Grosso (UTC-4), reservas diretas (*direct booking*), templates de repetição com respeito a feriados e resolução no Hub de Conflitos.
* **[Fluxo de Acompanhamento Docente (MSEP / SLIs)](./FLUXO_ACOMPANHAMENTO_DOCENTE.md):** Diretrizes do processo pedagógico contínuo de observação em sala de aula, indicadores de nível de serviço (SLIs/SLAs) e sigilo LGPD restrito à governança.
* **[Integração Google Agenda & Alertas](./INTEGRACAO_GOOGLE_AGENDA_ALERTAS.md):** Sincronização via Web Intent de 1 clique, download de `.ics` (RFC 5545) e alertas automáticos de prazos pedagógicos.
* **[PRD: Excelência em Agendamento](./PRD_AGENDAMENTO_MELHORIAS.md):** Requisitos de produto para UX de agendamento, prevenção ativa de conflitos e operação docente móvel.
* **[PRD Corretivo: Governança e LGPD](./PRD_Corretivo_Macro_Micro_Schedule.md):** Formalização do papel `SUPER_ADMIN`, trilha append-only e normalização de reservas.

---

## 🗂️ Estrutura de Pastas do Projeto

* `src/core/`: Motor Principal (definições de tipos, `ModuleRegistry`, `ModuleErrorBoundary`, `useCoreEngine`, `registeredModules`).
* `src/components/modules/`: Componentes plugáveis de cada módulo de negócio do sistema.
* `src/lib/`: Contextos de autenticação, definições de papéis de usuário (`UserRoles.ts`) e inicialização do Firebase (`firebase.ts`).
* `src/services/`: Camada de comunicação assíncrona e consultas ao Cloud Firestore.
* `functions/`: Cloud Functions v2 (Node.js 22 / TypeScript em `us-central1`) para gatilhos e operações seguras no backend.
* `scripts/`: Utilitários de manutenção e verificação de integridade no Firestore via Firebase Admin SDK.
