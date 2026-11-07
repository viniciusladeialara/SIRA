# PRD CORRETIVO ENTERPRISE
## Macro Micro Schedule – Segurança, Governança e Evolução Arquitetural
**Versão:** 1.0
**Data:** 19/09/2026

---

# 1. Resumo Executivo

Após análise da documentação da arquitetura atual, o sistema apresenta uma base técnica sólida:

- Arquitetura Micro-Kernel modular.
- Isolamento de falhas por módulo.
- RBAC com concessão dinâmica.
- Firebase Authentication.
- Firestore multi-tenant lógico.
- Cloud Functions para operações críticas.

Entretanto, foram identificados riscos arquiteturais, operacionais, de segurança, LGPD e escalabilidade que devem ser tratados antes da ampliação da plataforma para múltiplas unidades SENAI.

---

# 2. Principais Pontos Fortes

## Arquitetura

- Core desacoplado.
- Registro centralizado de módulos.
- Lazy Loading.
- Error Boundaries por módulo.
- Separação clara entre Core e Plugins.

## Operação

- Multiunidade.
- Permissões dinâmicas.
- Governança centralizada.

## Escalabilidade

- Cloud Functions.
- Firestore.
- React Query.

---

# 3. Riscos Críticos Encontrados

## CRÍTICO 01 – SUPER_ADMIN Hardcoded

### Situação Atual

A documentação informa:

SUPER_ADMIN = viniciusladeialara@gmail.com

### Risco

- Escalada de privilégios.
- Dependência de pessoa.
- Violação de governança.
- Impossibilidade de sucessão operacional.

### Correção

Criar Role:

SUPER_ADMIN

e armazenar apenas em:

users/{uid}.role

Jamais utilizar e-mail como mecanismo de autorização.

Prioridade: P0

---

## CRÍTICO 02 – Multi-Tenant Apenas Lógico

### Situação Atual

Todas as unidades compartilham o mesmo Firestore.

### Riscos

- Vazamento de dados entre unidades.
- Erro de filtro.
- Violação LGPD.
- Consultas indevidas.

### Correção

Implementar:

tenantId obrigatório

em:

- usuários
- turmas
- cursos
- ambientes
- agendamentos
- ativos
- uniformes
- auditoria

Criar regras de segurança baseadas em tenantId.

Prioridade: P0

---

## CRÍTICO 03 – Falta de Auditoria Imutável

### Situação Atual

Documentação menciona auditoria mas não evidencia mecanismo imutável.

### Correção

Criar coleção:

audit_logs

Campos:

- id
- timestamp
- tenantId
- uid
- ação
- módulo
- entidade
- valorAnterior
- valorNovo
- ip
- userAgent

Bloquear edição e exclusão.

Prioridade: P0

---

## CRÍTICO 04 – Permissões Dinâmicas Sem Aprovação

### Situação Atual

allowedModules e blockedModules podem ser alterados em tempo real.

### Correção

Fluxo:

Administrador
→ Solicita alteração

Administrador Master
→ Aprova

Cloud Function
→ Executa

Registrar auditoria obrigatória.

Prioridade: P1

---

## CRÍTICO 05 – Dados Pedagógicos Sensíveis

Módulo:

teacher-monitoring

contém informações pedagógicas e potencialmente sensíveis.

### Correção

Implementar:

- Criptografia de campos sensíveis.
- Logs de acesso.
- Justificativa obrigatória para consulta.
- Auditoria específica LGPD.

Prioridade: P0

---

# 4. Melhorias de Segurança

## Autenticação

Implementar:

- MFA obrigatório para ADMIN.
- MFA obrigatório para SUPER_ADMIN.
- Bloqueio por tentativas.
- Sessão máxima 8h.

---

## Firestore Rules

Criar política Zero Trust.

Exemplo:

request.auth != null
AND
request.auth.token.tenantId == resource.data.tenantId

---

## Cloud Functions

Mover para backend:

- concessão de módulos
- troca de perfil
- exclusão de usuários
- alterações críticas

---

## Secrets

Migrar chaves para:

Google Secret Manager

Nunca armazenar:

- API Keys
- Tokens
- Secrets

em frontend.

---

# 5. Melhorias de Arquitetura

## Introduzir Camada BFF

Criar:

Backend For Frontend

Responsável por:

- autorização
- auditoria
- cache
- integração externa

---

## Event Driven

Implementar eventos:

- ScheduleCreated
- ScheduleUpdated
- UserCreated
- AssetUpdated
- TeacherMonitoringCreated

---

## Feature Flags

Criar:

feature_flags

para ativação gradual de módulos.

---

# 6. Melhorias Operacionais

## Dashboard de Saúde

Indicadores:

- usuários online
- erros por módulo
- falhas de login
- consumo Firestore
- consumo Functions

---

## Monitoramento

Integrar:

- Google Cloud Monitoring
- Error Reporting
- Crash Analytics

---

## Backup

Implementar:

- Backup diário
- Retenção 90 dias
- Teste mensal de restauração

---

# 7. Melhorias LGPD

## Necessárias

Implementar:

- Consentimento.
- Política de retenção.
- Anonimização.
- Exclusão programada.
- Registro de tratamento.

---

# 8. Roadmap Corretivo

## Sprint 1

- Remover SUPER_ADMIN hardcoded.
- MFA.
- Auditoria imutável.
- tenantId obrigatório.

## Sprint 2

- Regras Firestore.
- Cloud Functions críticas.
- Logs LGPD.

## Sprint 3

- Dashboard operacional.
- Monitoramento.
- Backup.

## Sprint 4

- BFF.
- Feature Flags.
- Event Driven.

---

# 9. Classificação Geral

## Arquitetura
9/10

## Modularidade
10/10

## Escalabilidade
8/10

## Segurança
6/10

## LGPD
6/10

## Governança
7/10

## Maturidade Geral
8/10

---

# Conclusão

A arquitetura atual está muito acima da média de sistemas internos educacionais e demonstra excelente evolução para um modelo modular moderno. Os principais riscos concentram-se em governança de acesso, isolamento multi-tenant, auditoria imutável e conformidade LGPD. A execução das ações P0 e P1 elevará significativamente a segurança e a capacidade de expansão institucional do Macro Micro Schedule.
