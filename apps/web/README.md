# Macro Micro Schedule - SENAI MT

Sistema multi-unidades de governança educacional, agendamento inteligente de horários, alocação de docentes, gestão de ambientes físicos, planejamento curricular e acompanhamento pedagógico para o **SENAI Mato Grosso** (operando unidades Cáceres, Várzea Grande e Barra do Bugres).

---

## 🚀 Visão Geral

O **Macro Micro Schedule** centraliza e automatiza a grade de horários escolares, alocação de ambientes físicos (salas de aula, oficinas e laboratórios), controle de disponibilidade docente, prevenção e resolução atômica de conflitos de horário, trocas de aulas (*swaps*), templates com replicação de grade e o ciclo completo de **Acompanhamento Docente MSEP**. 

Construído inteiramente sobre o ecossistema **Google Cloud e Firebase**, o sistema possui arquitetura modular baseada em Micro-Kernel (Core Engine), controle de acesso rigoroso baseado em funções (RBAC com papéis `SUPER_ADMIN`, `ADMIN`, `USER`, `PROFESSOR`, `PARTNER_SCHOOL`), isolamento multi-tenant lógico por unidade escolar, auditoria contínua append-only e integração direta com o **Google Agenda**.

* **Ambiente de Produção (Firebase Hosting):** [https://agendador-ambiente2.web.app](https://agendador-ambiente2.web.app)
* **Visualização Pública da Grade:** [https://agendador-ambiente2.web.app/public-view](https://agendador-ambiente2.web.app/public-view)
* **Console do Projeto:** [Firebase Console](https://console.firebase.google.com/project/agendador-ambiente2/overview)

---

## 📂 Documentação do Sistema

Toda a documentação técnica, arquitetural, funcional e de governança está centralizada na pasta [`/docs`](./docs) e [`/doc-functions`](./doc-functions):

* 📜 **[De Onde Viemos](./docs/DE_ONDE_VIEMOS.md):** Histórico e evolução do projeto, desafios do protótipo mono-unidade e superação dos gargalos monolíticos.
* 🚀 **[Onde Estamos](./docs/ONDE_ESTAMOS.md):** Arquitetura vigente, funcionamento do Core Engine, catálogo completo dos 18 módulos em produção, segurança LGPD e motor de agendamento.
* ⚡ **[Mapeamento das Cloud Functions](./doc-functions/MAPEAMENTO_CLOUD_FUNCTIONS.md):** Inventário técnico e histórico de otimização das 12 funções serverless ativas.
* 📐 **[Arquitetura Core Modular](./docs/ARQUITETURA_CORE_MODULAR.md):** Especificação técnica do micro-kernel, barreira de tolerância a falhas (`ModuleErrorBoundary`) e registro dinâmico de módulos (`ModuleRegistry`).
* 🔐 **[Guia de Permissões e Perfis RBAC](./docs/GUIA_PERMISSOES_RBAC.md):** Matriz de autorizações por perfil, liberação dinâmica de módulos por usuário e escopos de segurança.
* 👑 **[Estrutura de Papéis](./docs/Estrutura%20de%20Pap%C3%A9is.md):** Detalhamento dos papéis operacionais e poderes de governança do `SUPER_ADMIN`.
* 🛡️ **[Auditoria e Rastreabilidade](./docs/AUDITORIA_E_RASTREABILIDADE.md):** Registro imutável de ações sensíveis (append-only) e auditoria no Firestore.
* 📅 **[Guia de Agendamentos e Conflitos](./docs/GUIA_AGENDAMENTOS_E_CONFLITOS.md):** Criação de grade, replicação de semanas, respeito automático a feriados, reservas diretas e Hub de Conflitos.
* 🧭 **[Fluxo de Acompanhamento Docente](./docs/FLUXO_ACOMPANHAMENTO_DOCENTE.md):** Metodologia pedagógica SENAI MSEP, observação em sala de aula, prazos regulamentares (SLAs) e sigilo LGPD.
* 📆 **[Integração com Google Agenda](./docs/INTEGRACAO_GOOGLE_AGENDA_ALERTAS.md):** Sincronização via Web Intent de 1 clique, padrão iCal/RFC 5545 e alertas para devolutivas e planos de ação.
* 📋 **[PRD: Excelência em Agendamento](./docs/PRD_AGENDAMENTO_MELHORIAS.md):** Requisitos de evolução para o motor de agendamento, UX e operação docente em oficinas.
* 📋 **[PRD Corretivo: Governança e LGPD](./docs/PRD_Corretivo_Macro_Micro_Schedule.md):** Formalização da governança corporativa, papel Super Admin e saneamento de dados.

---

## 🛠️ Stack Tecnológica (100% Google Cloud / Firebase)

* **Frontend:** React 18 + TypeScript + Vite + TailwindCSS
* **Componentes UI & Design System:** Radix UI / Shadcn/ui + Lucide React
* **Banco de Dados:** Google Cloud Firestore NoSQL (Multi-Tenant Lógico, tempo real com regras Zero Trust)
* **Autenticação:** Firebase Authentication (Tokens JWT e claims de segurança)
* **Backend Serverless:** Google Cloud Functions v2 (Node.js 22 / TypeScript em `us-central1`)
* **Hospedagem:** Firebase Hosting (CDN global de alta performance)
* **Armazenamento:** Firebase Cloud Storage (Regras de acesso granulares)
* **Calendário & Agendas:** Google Agenda (Web Intent 1-clique) + Arquivos `.ics` (RFC 5545)
* **Tratamento de Datas & Fusos:** `date-fns` (Fuso horário oficial UTC-4 Cuiabá/Mato Grosso)
* **Relatórios:** Central com 10 relatórios e exportação para planilhas Excel (`.xlsx`) com dimensionamento automático

---

## ⚡ Firebase Cloud Functions & Regras de Negócio Serverless

O backend do sistema opera inteiramente sob a infraestrutura **Google Cloud Functions v2 (Node.js 22 / TypeScript)** na região `us-central1`. O ecossistema adota uma arquitetura híbrida: consultas e sincronizações reativas ocorrem via Firestore SDK no cliente, enquanto validações de alta integridade, transações atômicas, cálculos de colisão e processos em segundo plano são executados com segurança nas Cloud Functions.

### 📋 Catálogo das 12 Cloud Functions em Operação

| # | Nome da Função | Tipo / Gatilho | Origem no Código | Consumo no Frontend | Responsabilidade e Regras de Negócio |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | **`createScheduleBatch`** | `onCall` (Callable) | `functions/src/index.ts` | `ScheduleCreationModal.tsx`, `reservationService.ts`, `scheduleService.ts` | **Criação Atômica de Grade:** Insere lotes de agendamentos e reservas de sala, validando teto de 5h/turno por sala e colisões prévias via cache. Suporta `direct_booking` para eventos institucionais sem professor. |
| 2 | **`updateSchedule`** | `onCall` (Callable) | `functions/src/index.ts` | `ScheduleEditDialog.tsx`, `scheduleService.ts` | **Edição Segura:** Atualiza horários, salas ou professores recalculando colisões server-side e invalidando caches de agendamento. |
| 3 | **`deleteSchedule`** | `onCall` (Callable) | `functions/src/index.ts` | `scheduleService.ts` | **Exclusão Controlada:** Remove agendamentos individuais, limpa pendências associadas na fila de conflitos e atualiza dados da unidade. |
| 4 | **`resolveScheduleConflict`** | `onCall` (Callable) | `functions/src/copySchedules.ts` | `ConflictResolutionDialog.tsx`, `scheduleService.ts` | **Resolução no Hub de Conflitos:** Permite ignorar, aceitar ou resolver colisões, validando previamente se novos recursos (sala/professor) estão realmente disponíveis antes de efetivar. |
| 5 | **`executeScheduleSwap`** | `onCall` (Callable) | `functions/src/index.ts` | `swapService.ts` | **Permuta Transacional de Aulas (Swaps):** Executa a troca de horários entre docentes sob transação ACID (`runTransaction`), garantindo que nenhuma aula fique em estado inconsistente. |
| 6 | **`createUser`** | `onCall` (Callable) | `functions/src/index.ts` | `UserManagementModule.tsx`, `ProfessorModule.tsx` | **Gestão de Identidade RBAC:** Cria o usuário no Firebase Auth, gera o documento correspondente na coleção `users` do Firestore e sincroniza com a coleção `teachers`. Restrito a `ADMIN` e `SUPER_ADMIN`. |
| 7 | **`runScheduleGenerator`** | `onCall` (Callable) | `functions/src/index.ts` | Motor de Otimização (PRD 2) | **Geração Automática de Horários:** Distribui automaticamente Unidades Curriculares por turma, respeitando carga horária diária, dias úteis, competências docentes e rate limiting de 1 req/min. |
| 8 | **`onScheduleWritten`** | `Firestore Trigger` (`schedules/{id}`) | `functions/src/notifications.ts` | ⚡ Automático (Background) | **Sentinela de Conflitos:** Monitora toda inserção ou modificação de aula, detecta colisões no nível do banco e alimenta a coleção `schedule_conflicts` com alertas em tempo real. |
| 9 | **`onRoomUpdated`** | `Firestore Trigger` (`rooms/{id}`) | `functions/src/notifications.ts` | ⚡ Automático (Background) | **Gestão de Manutenção de Ambientes:** Se uma sala entra em manutenção (`available: false`), sinaliza agendamentos futuros como `conflict_flagged` e alerta docentes. Ao término da manutenção, normaliza a grade automaticamente. |
| 10 | **`onTeacherDeleted`** | `Firestore Trigger` (`teachers/{id}`) | `functions/src/notifications.ts` | ⚡ Automático (Background) | **Safe-Delete Docente:** Exclui a conta no Firebase Auth, limpa o registro em `users` e sinaliza todas as aulas futuras do docente como `teacher_missing` para que a coordenação realize a substituição. |
| 11 | **`onTeacherStatusUpdated`** | `Firestore Trigger` (`teachers/{id}`) | `functions/src/notifications.ts` | ⚡ Automático (Background) | **Sincronização de Acesso:** Ao desativar um professor (`isActive: false`), define imediatamente `disabled: true` no Firebase Auth para revogação instantânea de sessão. |
| 12 | **`cleanupOldAuditLogs`** | `Scheduled Cron` (`0 0 * * *`) | `functions/src/FinOps_CleanupLogs_Prototype.ts` | ⚡ Diário (00:00 UTC) | **FinOps & Governança de Logs:** Expurgador automático de logs no Firestore. Retém logs operacionais comuns por 7 dias e eventos críticos (segurança, exclusões) por 90 dias em lotes atômicos. |

---

### 🛡️ Regras de Negócio e Proteções Implementadas no Backend

1. **Unicidade e Anti-Colisão Server-Side:**
   * Nenhum professor pode ter mais de uma aula no mesmo turno/horário em qualquer sala ou unidade.
   * Nenhuma sala pode abrigar duas turmas simultaneamente (com exceção de reservas diretas institucionais em salas distintas).
   * Verificações baseadas em interseção temporal rigorosa de intervalos `(startA < endB && endA > startB)`.
2. **Fuso Horário Oficial (UTC-4 Cuiabá / Mato Grosso):**
   * Toda manipulação de turno nas funções converte explicitamente timestamps UTC para o fuso local (`getShiftInfo`), classificando com precisão os turnos:
     * **Matutino:** 07:00 às 13:00 (UTC-4)
     * **Vespertino:** 13:00 às 18:00 (UTC-4)
     * **Noturno:** 18:00 às 23:00 (UTC-4)
3. **Teto de Ocupação por Sala (Capacidade de Turno):**
   * Uma sala não pode ultrapassar 5 horas de aula em um mesmo turno (`checkRoomShiftLimit`), prevenindo sobrecarga física e respeitando pausas pedagógicas, exceto se a flag administrativa `ignoreLimits` for expressamente fornecida por um coordenador.
4. **Reservas Diretas Institucionais (`direct_booking`):**
   * Eventos escolares, manutenções, reuniões pedagógicas e datas comemorativas que não possuem professor gravam `teacherId: 'direct_booking'`, preservando o nome do solicitante em `teacherName` e evitando falsos positivos de "docente inexistente".
5. **Transações ACID para Permutas (*Swaps*):**
   * O módulo de permutas executa a troca de alocações via `db.runTransaction()`. Se qualquer gravação falhar, ambas as aulas retornam intactas ao estado original, eliminando estados intermediários órfãos.
6. **Integridade de Contas e Zero Trust:**
   * Exclusões ou inativações de docentes no Firestore refletem imediatamente no Firebase Authentication, invalidando tokens JWT para impedir acessos residuais não autorizados.
7. **Otimização de Custos e FinOps:**
   * **Cache em Memória (`cache.ts`):** Reduz leituras repetitivas no Firestore durante verificações intensivas de colisão.
   * **Rate Limiting (`rateLimiter.ts`):** Impede requisições concorrentes ou ataques de negação de serviço na geração de cronogramas.
   * **Lifecycle de Dados:** Limpeza automatizada diária mantendo o Firestore enxuto e dentro dos limites de custo da instituição.

---

## 📊 Relatórios e Exportação para Excel

O sistema dispõe de uma Central de Relatórios com **10 tipos de relatórios operacionais**, com visualização em tela e exportação direta em 1 clique para Excel (`.xlsx`), com dimensionamento automático de colunas:
1. **Agendamentos Gerais:** Grade detalhada de aulas no período selecionado.
2. **Carga Horária Docente:** Total de horas, aulas ministradas, turmas e ambientes por professor.
3. **Uso de Ambientes:** Horas de ocupação e taxa de utilização de salas e laboratórios.
4. **Cronograma por Turma:** Grade de horários completa de uma turma específica.
5. **Saldo de Estoque:** Posição física consolidada de Uniformes e EPIs por item e tamanho.
6. **Inventário de Ativos:** Máquinas, ferramentas e insumos mapeados por sala com status operacional.
7. **Trocas de Horário:** Histórico de solicitações e aprovações de permutas docentes.
8. **Auditoria de Estoque:** Ledger histórico de movimentações e baixas de materiais com justificativa.
9. **Atividade de Usuários (Admin):** Rastreabilidade de ações críticas dos operadores no sistema.
10. **Acompanhamento Docente (Coordenação):** Indicadores pedagógicos SLI e conformidade de entregas.

---

## 💻 Desenvolvimento Local

O projeto conta com o utilitário interativo `menu.bat` no terminal Windows ou execução via scripts npm:

```bash
# 1. Instalar dependências da aplicação
npm install

# 2. Instalar dependências das Cloud Functions
cd functions && npm install && cd ..

# 3. Executar o servidor de desenvolvimento
npm run dev
# Ou pelo menu interativo:
.\menu.bat 1
```

---

## 🚀 Publicação e Deploy no Firebase

Você pode utilizar o assistente interativo `menu.bat` para compilar e publicar os recursos:

```bash
# Executar o menu interativo:
.\menu.bat

# Atalhos diretos do menu.bat:
.\menu.bat build     # Executa build do frontend
.\menu.bat hosting   # Deploy apenas do frontend no Firebase Hosting
.\menu.bat functions # Deploy das Cloud Functions
.\menu.bat rules     # Deploy de regras de Firestore e Storage
.\menu.bat deploy    # Deploy completo (Hosting + Functions + Regras)

# Ou diretamente via Firebase CLI:
npm run build
$env:FUNCTIONS_DISCOVERY_TIMEOUT="120000"; firebase deploy
```

---
*Documentação atualizada em Novembro de 2026.*
