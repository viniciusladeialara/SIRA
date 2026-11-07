# PRD COMPLEMENTAR — EXCELÊNCIA EM AGENDAMENTO
## Macro Micro Schedule — Motor de Agendamento Inteligente, UX e Operação de Campo
**Versão:** 1.0
**Data:** 19/09/2026
**Escopo:** Análise crítica do sistema como *sistema de agendamento* (não apenas como plataforma arquitetural)

---

# 1. Resumo Executivo

Avaliando os três documentos (`ONDE_ESTAMOS.md`, `PRD_Corretivo`, `README`), o **Macro Micro Schedule** é, do ponto de vista arquitetural, **muito acima da média** de sistemas internos educacionais: micro-kernel, isolamento de falhas, RBAC dinâmico, multi-tenant lógico e stack moderna.

**Porém, como sistema de agendamento especificamente, ele é apenas "bom" — não "ótimo".**

O PRD Corretivo existente trata corretamente de **segurança, governança, LGPD e escalabilidade**, mas **não endereça o coração do domínio**: a qualidade do agendamento em si. Há lacunas críticas em:

- Geração automática de horários (otimização por restrições)
- Prevenção de conflitos em tempo de booking (hoje só detecta depois)
- Notificações e lembretes
- Experiência mobile do docente em campo
- Interoperabilidade de calendário (iCal/Google/Outlook)
- Portal do aluno
- Versionamento e simulação "what-if"
- Templates e recorrência

Este PRD propõe as **modificações** e **adições** necessárias para elevar o sistema de "bom agendador" a "ótimo agendador".

---

# 2. Avaliação por Dimensão

| Dimensão | Nota Atual | Nota Alvo | Comentário |
|:---|:---:|:---:|:---|
| Arquitetura | 9/10 | 9/10 | Excelente — manter |
| Modularidade | 10/10 | 10/10 | Excelente — manter |
| **Motor de Agendamento** | **5/10** | **9/10** | **Lacuna crítica — foco deste PRD** |
| **UX de Agendamento** | **5/10** | **9/10** | Sem drag-and-drop, sem mobile de campo |
| **Notificações** | **3/10** | **9/10** | Praticamente ausente |
| **Interoperabilidade** | **3/10** | **8/10** | Sem iCal/CalDAV/Google sync real |
| Escalabilidade | 8/10 | 9/10 | OK |
| Segurança | 6/10 | 9/10 | Coberto pelo PRD Corretivo |
| LGPD | 6/10 | 9/10 | Coberto pelo PRD Corretivo |
| Governança | 7/10 | 9/10 | Coberto pelo PRD Corretivo |
| **Acessibilidade (a11y)** | **?/10** | **8/10** | Não mencionado — instituição pública exige |
| **Testes/CI-CD** | **?/10** | **8/10** | Não mencionado |
| **Observabilidade** | **4/10** | **8/10** | Parcial no Corretivo |

---

# 3. O QUE MUDARIA (Modificações no Existente)

## M01 — De "Detecção" para "Prevenção" de Conflitos (P0)
**Situação atual:** O módulo `conflicts` faz *detecção atômica de colisões* com badge pulsante — ou seja, o conflito já aconteceu e o sistema aponta.
**Mudança:** Implementar **prevenção em tempo de booking** via transação Firestore com lock otimista no slot `(tenantId, ambienteId, data, turno, horario)`. O usuário não consegue salvar um agendamento que colide — o botão fica desabilitado com explicação inline ("Sala X ocupada pela Turma Y neste horário").
**Razão:** Detectar conflito depois é reativo; prevenir é o padrão de sistemas de agendamento de classe mundial.

## M02 — Motor de Otimização de Horários (Constraint Solver) (P0)
**Situação atual:** Agendamentos são criados manualmente. Não há geração automática.
**Mudança:** Introduzir um **motor de geração automática de grade horária** baseado em restrições (constraint satisfaction). Entradas: disponibilidade de professores, capacidade de salas, requisitos de cursos, turnos, carga horária. Saída: grade otimizada proposta, com score de qualidade e conflitos residuais. Implementar como Cloud Function pesada ou job assíncrono (não no cliente).
**Razão:** É o diferencial entre um "caderno digital de horários" e um "sistema de agendamento inteligente".

## M03 — Trocas (Swaps) com Fluxo de Aprovação Completo (P1)
**Situação atual:** `swaps` tem "histórico e aprovação de permutas no mesmo dia e turno".
**Mudança:** Ampliar para permutas **entre dias/turnos** (não só mesmo dia), com fluxo de aprovação multi-etapa (professor solicita → coordenador aprova → sistema valida conflitos → aplica), notificações em cada etapa e auditoria.

## M04 — Relatórios: além do Excel (P1)
**Situação atual:** Exportação `.xlsx` com auto-width.
**Mudança:** Adicionar PDF (com template institucional SENAI), relatórios agendados (envio automático por email semanal/mensal), e dashboards BI em tempo real (Recharts já está no stack) com taxa de ocupação de salas,利用率 docente, conflitos recorrentes.

## M05 — Multi-tenant: de Lógico para Híbrido com Row-Level Security Forte (P0)
**Situação atual:** Multi-tenant lógico no mesmo Firestore (risco de vazamento entre unidades).
**Mudança:** (Concorda com CRÍTICO 02 do Corretivo) `tenantId` obrigatório em todas as coleções + regras Firestore Zero Trust. **Adicional:** considerar particionamento físico por unidade para dados pedagógicos sensíveis (teacher-monitoring).

## M06 — SUPER_ADMIN: de e-mail hardcoded para role + separação de poderes (P0)
**Situação atual:** `viniciusladeialara@gmail.com` hardcoded como SUPER_ADMIN.
**Mudança:** (Concorda com CRÍTICO 01) Role `SUPER_ADMIN` em `users/{uid}.role`. **Adicional:** aplicar **separation of duties** — SUPER_ADMIN não pode ser a mesma pessoa que audita; criar papel `AUDITOR` somente-leitura com acesso a logs.

## M07 — Permissões Dinâmicas com Fluxo de Aprovação (P1)
**Situação atual:** `allowedModules`/`blockedModules` alterados em tempo real por ADMIN.
**Mudança:** (Concorda com CRÍTICO 04) Fluxo solicita→aprova→executa. **Adicional:** concessão temporária com expiração automática (ex: acesso a um módulo por 30 dias).

## M08 — teacher-monitoring: criptografia + justificativa + minimização (P0)
**Situação atual:** Dados pedagógicos sensíveis (MSEP/SLI) sem proteção específica evidenciada.
**Mudança:** (Concorda com CRÍTICO 05) Criptografia de campos, logs de acesso, justificativa obrigatória. **Adicional:** princípio da minimização — dados anonimizados para relatórios agregados; retenção definida; direito de acesso do titular (LGPD art. 18).

---

# 4. O QUE ADICIONARIA (Novos Módulos / Capacidades)

## A01 — Sistema de Notificações Multicanal (P0)
**Hoje:** Inexistente nos módulos catalogados.
**Proposta:** Módulo transversal de notificações:
- **In-app:** sino de notificações com badge
- **Email:** lembretes de aula (24h antes), alterações de horário, aprovações de troca
- **Push (PWA/mobile):** para professores em campo
- **WhatsApp (opcional):** via integração para alertas críticos
Eventos: `ScheduleCreated`, `ScheduleChanged`, `SwapRequested`, `SwapApproved`, `ConflictDetected`, `ClassReminder`.

## A02 — Integração Real de Calendário (P0)
**Hoje:** README menciona doc "Integração Google Agenda & Alertas" mas não há módulo no catálogo.
**Proposta:**
- Sincronização bidirecional com Google Calendar (connector disponível na plataforma)
- Exportação **iCal/.ics** por turma, por professor, por ambiente (padrão interoperável)
- Assinatura CalDAV para clientes externos
- Cada agendamento gera evento de calendário com convidados (professor)

## A03 — Portal do Aluno (P1)
**Hoje:** Só existem perfis ADMIN, USER, PROFESSOR, PARTNER_SCHOOL, SUPER_ADMIN. **Aluno não existe.**
**Proposta:** Perfil `STUDENT` com visão somente-leitura do seu cronograma, presenças, avisos de turma. Login via e-mail institucional. Essencial para uma instituição de ensino — o aluno é o usuário final do agendamento.

## A04 — App Mobile / PWA para Professores (P0)
**Hoje:** Web only. Professores em campo (oficinas, laboratórios) precisam consultar horário no celular.
**Proposta:** PWA offline-first com:
- "Minha Semana" offline (cached)
- Check-in de aula via QR code / geolocalização opcional
- Abertura de chamado (report-issue) com foto
- Notificações push
A plataforma publica para iOS/Android do mesmo código — aproveitar.

## A05 — Construtor de Grade Drag-and-Drop (P0)
**Hoje:** Não mencionado. Provavelmente formulários.
**Proposta:** Grade visual semanal/mensal com drag-and-drop (biblioteca `@hello-pangea/dnd` já instalada):
- Arrastar aula entre slots/salas
- Validação inline de conflitos durante o arraste
- Coloração por curso/professor/ambiente
- Visões: dia, semana, mês, matriz professor×ambiente

## A06 — Templates e Recorrência (P1)
**Hoje:** Não mencionado.
**Proposta:**
- Templates de grade semanal reutilizáveis por curso/semestre
- "Copiar semana" para replicar cronograma
- Agendamentos recorrentes com regras (semanal, quinzenal, feriados excluídos)
- Importação de calendário letivo oficial SENAI

## A07 — Simulação "What-If" e Versionamento (P1)
**Hoje:** Não mencionado.
**Proposta:**
- **Branch de simulação:** clonar a grade atual, fazer alterações hipotéticas, ver impacto (conflitos gerados, ocupação), descartar ou publicar
- **Versionamento:** histórico de versões da grade com diff visual e rollback
- Útil para planejamento de semestre e resposta a imprevistos

## A08 — Analytics de Ocupação e Otimização de Recursos (P1)
**Hoje:** `overview` tem "métricas e indicadores operacionais" (genérico).
**Proposta:** Dashboard dedicado de utilização:
- Taxa de ocupação por sala/laboratório (heatmap)
- Carga horária por professor (detectar ociosidade/sobrecarga)
- Salas subutilizadas → sugestão de realocação
- Previsão de demanda por curso

## A09 — Lista de Espera e Reserva de Ambientes (P2)
**Hoje:** Reservas diretas sem fila.
**Proposta:** Quando ambiente está ocupado no slot desejado:
- Lista de espera ordenada
- Notificação automática se liberar
- Priorização por curso/urgência

## A10 — API Pública Contratada (P2)
**Hoje:** Não mencionado.
**Proposta:** API REST documentada (OpenAPI) para integração com sistemas acadêmicos externos (SIE, SGA), com:
- Rate limiting
- API keys por tenant
- Webhooks para eventos (`ScheduleCreated`, etc.)
- Documentação auto-gerada

## A11 — Auditoria Imutável + Trilha Completa (P0)
**Hoje:** README menciona doc de auditoria, mas PRD Corretivo aponta que não há mecanismo imutável evidenciado.
**Proposta:** (Concorda com CRÍTICO 03) Coleção `audit_logs` append-only com hash encadeado (blockchain-like) para garantir integridade. Campos: timestamp, tenantId, uid, ação, módulo, entidade, antes, depois, ip, userAgent.

## A12 — Acessibilidade (a11y) (P1)
**Hoje:** Não mencionado.
**Proposta:** Conformidade WCAG 2.1 AA (instituição pública):
- Navegação por teclado em todos os módulos
- Leitores de tela (ARIA labels via Radix — já parcial)
- Contraste adequado
- Testes automatizados com axe-core

## A13 — Estratégia de Testes e CI/CD (P1)
**Hoje:** Não mencionado.
**Proposta:**
- Testes unitários (Vitest) para Core e serviços
- Testes de integração para Cloud Functions
- E2E (Playwright) para fluxos críticos (agendar, trocar, aprovar)
- Pipeline CI/CD com gates de qualidade
- Cobertura mínima no Core (motor crítico)

## A14 — Observabilidade e Telemetria (P1)
**Hoje:** Parcial no Corretivo (dashboard de saúde).
**Proposta:**
- OpenTelemetry / tracing distribuído
- Métricas de negócio (tempo para agendar, taxa de conflito, NPS docente)
- Alertas proativos (pico de erros, lentidão)
- SLOs definidos (ex: agendamento < 2s p99)

## A15 — Internacionalização (i18n) (P2)
**Hoje:** Português hardcoded.
**Proposta:** Estrutura i18n (react-i18next) preparando para inglês/espanhol — útil para parcerias internacionais do SENAI e futura expansão.

## A16 — Gestão de Disponibilidade e Preferências do Docente (P1)
**Hoje:** `professors` tem "disponibilidade de turnos".
**Proposta:** Ampliar para:
- Calendário de disponibilidade granular (não só turno)
- Preferências declaradas (ambientes preferidos, restrições)
- O motor de otimização (A02) respeita essas preferências
- Docente auto-gerencia (self-service)

## A17 — Gestão de Feriados e Calendário Letivo (P1)
**Hoje:** Não mencionado.
**Proposta:** Cadastro de feriados estaduais/municipais de MT, calendário letivo oficial, recessos. O motor de agendamento e recorrência respeita automaticamente.

---

# 5. Roadmap Proposto (Complementar ao Corretivo)

## Sprint A — Núcleo de Agendamento (P0)
- M01 Prevenção de conflitos em booking
- M02 Motor de otimização de horários
- A05 Construtor drag-and-drop
- A01 Notificações (in-app + email)
- A02 Integração Google Calendar + iCal
- A04 PWA offline para professores

## Sprint B — Segurança e Governança (P0) — alinhado ao Corretivo
- M05 tenantId obrigatório + Firestore Rules
- M06 SUPER_ADMIN por role + AUDITOR
- M08 teacher-monitoring criptografado
- A11 Auditoria imutável

## Sprint C — Experiência e Operação (P1)
- A03 Portal do aluno
- A06 Templates e recorrência
- A07 Simulação what-if + versionamento
- A08 Analytics de ocupação
- A16 Disponibilidade/preferências docente
- A17 Calendário letivo e feriados
- M03 Swaps multi-etapa
- M04 Relatórios PDF + agendados

## Sprint D — Qualidade e Escala (P1-P2)
- A12 Acessibilidade WCAG
- A13 Testes + CI/CD
- A14 Observabilidade
- M07 Permissões com aprovação + expiração
- A09 Lista de espera
- A10 API pública
- A15 i18n

---

# 6. Priorização Resumida

| Prioridade | Itens |
|:---|:---|
| **P0 (bloqueante para "ótimo")** | M01, M02, M05, M06, M08, A01, A02, A04, A05, A11 |
| **P1 (diferencial competitivo)** | M03, M04, M07, A03, A06, A07, A08, A12, A13, A14, A16, A17 |
| **P2 (maturidade)** | A09, A10, A15 |

---

# 7. Conclusão

O **Macro Micro Schedule** é arquiteturalmente exemplar, mas opera hoje como um **"caderno digital sofisticado de horários"** em vez de um **"sistema de agendamento inteligente"**. O PRD Corretivo existente cobre bem segurança e governança, mas **deixa inteiramente de fora o domínio funcional de agendamento**.

As mudanças e adições propostas aqui transformam o sistema de *passivo* (registra e detecta) para *proativo* (previne, otimiza, notifica, simula), com foco no usuário final (professor em campo, aluno) e na interoperabilidade padrão de mercado (iCal, Google, API).

Com a execução combinada do **PRD Corretivo** (segurança/LGPD) + **este PRD Complementar** (agendamento/UX), o sistema alcançaria **maturidade geral 9.5/10** e estaria pronto para expansão institucional multi-unidade com confiança.