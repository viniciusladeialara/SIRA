# SIRA – Arquitetura do Sistema
## Documento de Especificação Técnica & Arquitetural

---

### Metadados do Documento

| Atributo | Detalhe |
| :--- | :--- |
| **Projeto** | SIRA – Sistema Integrado de Recursos Acadêmicos |
| **Versão** | `1.0.0` |
| **Padrão Arquitetural** | Clean Architecture + Monorepo Modular (Feature-Based) |
| **Responsável** | Vinicius Lara |
| **Data** | Novembro / 2026 |

---

## 1. Visão Geral & Princípios Norteadores

O **SIRA** adota princípios sólidos de engenharia de software para garantir escalabilidade, testabilidade e manutenibilidade a longo prazo:

1. **Separação Estrita de Responsabilidades (SoC):** Regras de negócio desacopladas de frameworks de apresentação e mecanismos de persistência.
2. **Independência de Frameworks:** O núcleo de domínio não possui dependências de NestJS, Express ou Prisma.
3. **Multiunidade Nativa (Tenant Isolation):** Todo o fluxo de dados respeita o isolamento por unidade operacional do SENAI via discriminador `unidade_id UUID`.
4. **Segurança por Padrão (Secure by Default):** Modelo RBAC granular atômico (`modulo.acao`), tokens stateless efêmeros e renovação com rotação de refresh tokens.
5. **Rastreabilidade e Imutabilidade:** Toda alteração de dados gera trilha imutável no schema `auditoria` com payloads em `JSONB`.

---

## 2. Topologia do Sistema (C4 Model - Nível 2: Containers)

```mermaid
flowchart TB
    User["Docente / Coordenador / Gestor / Aluno"]

    subgraph ClientLayer ["Camada de Apresentação (Frontend)"]
        Web["Next.js 14+ (Web SPA / SSR)\nTailwindCSS + Shadcn/UI"]
    end

    subgraph APILayer ["Camada de Serviços & APIs (Backend)"]
        API["NestJS Core API\n(TypeScript, Clean Architecture)"]
        Optimizer["Horários Optimizer Service\n(Engine de Otimização e Restrições)"]
    end

    subgraph StorageLayer ["Persistência & Cache"]
        Redis[("Redis 7\n(Cache de Sessões, Permissões e Rate Limit)")]
        PG[("PostgreSQL 16\nMulti-Schema: core, academico, planejamento, producao, relatorios, auditoria")]
    end

    subgraph MonitoringAdmin ["Administração & Observabilidade"]
        PgAdmin["pgAdmin 4 Web Console"]
    end

    User -->|HTTPS / Navegador| Web
    Web -->|JSON REST / GraphQL| API
    API -->|Key-Value Store| Redis
    API -->|Prisma Client / Pooling| PG
    Optimizer -->|Batch Queries| PG
    PgAdmin -->|SQL Direct Connection| PG
```

---

## 3. Arquitetura em Camadas do Backend (Clean Architecture)

A aplicação no backend (`apps/api`) é organizada em 4 círculos concêntricos:

```mermaid
flowchart TD
    subgraph Presentation ["1. Presentation Layer (Apresentação)"]
        Controllers["Controllers REST"]
        Pipes["Validation Pipes (class-validator)"]
        Guards["AuthGuard & RolesGuard"]
        Filters["GlobalExceptionFilter (RFC 7807)"]
        Interceptors["AuditInterceptor & TenantContextInterceptor"]
    end

    subgraph Application ["2. Application Layer (Casos de Uso)"]
        UseCases["Use Cases / Command & Query Handlers"]
        AppServices["Application Services"]
        DTOs["Request & Response DTOs"]
        Mappers["Data Mappers"]
    end

    subgraph Domain ["3. Domain Layer (Núcleo de Negócio Puro)"]
        Entities["Domain Entities"]
        ValueObjects["Value Objects"]
        DomainEvents["Domain Events"]
        RepoInterfaces["Repository Interfaces (Contratos)"]
    end

    subgraph Infrastructure ["4. Infrastructure Layer (Persistência & Conectores)"]
        PrismaRepo["Prisma Repositories Implementations"]
        BcryptAdapter["Bcrypt Hashing Adapter"]
        JwtAdapter["JWT & Crypto Token Service"]
        RedisCache["Redis Cache Manager"]
    end

    Presentation --> Application
    Application --> Domain
    Infrastructure --> Domain
    Application --> Infrastructure
```

### 3.1 Responsabilidades de Cada Camada

| Camada | Diretório Típico | Responsabilidade | Proibições |
| :--- | :--- | :--- | :--- |
| **Domain** | `src/domain/` ou `core/` | Entidades puras, regras invariantes e contratos de repositórios | Nunca importar pacotes externos como NestJS, Prisma ou HTTP |
| **Application** | `src/application/` | Orquestração dos fluxos de negócio, casos de uso, DTOs e validação lógica | Não tratar detalhes de transporte HTTP ou queries SQL diretas |
| **Infrastructure** | `src/infrastructure/` | Acesso ao PostgreSQL via Prisma, Redis, envio de email e integrações | Não conter regras de negócio essenciais |
| **Presentation** | `src/presentation/` | Controllers HTTP, rotas REST, DTOs de entrada e serialização de saída | Não executar lógica de banco ou cálculos de domínio |

---

## 4. Estratégia de Isolamento Multiunidade (Multi-tenancy)

O SENAI opera com unidades regionais independentes (ex: Cuiabá, Cáceres, Rondonópolis, Sinop).

```mermaid
sequenceDiagram
    autonumber
    actor Client as Cliente (Navegador)
    participant Guard as TenantGuard / AuthGuard
    participant Context as TenantContext (AsyncLocalStorage)
    participant Service as Application Service
    participant Repo as Prisma Repository
    participant DB as PostgreSQL (Multi-Schema)

    Client->>Guard: Requisição HTTP com Bearer JWT + Header X-Unidade-Id
    Guard->>Guard: Valida JWT e checa se o usuário possui acesso à unidade solicitada
    Guard->>Context: Define unidade_id ativo no contexto assíncrono da requisição
    Guard->>Service: Encaminha execução do Caso de Uso
    Service->>Repo: Solicita dados do domínio
    Repo->>Context: Obtém unidade_id corrente
    Repo->>DB: Executa query aplicando 'WHERE unidade_id = $1'
    DB-->>Repo: Retorna registros segregados
    Repo-->>Service: Retorna entidades
    Service-->>Client: Resposta JSON filtrada
```

### Regras Mandatórias de Multiunidade:
1. **Restrição por Tenant:** Toda consulta em tabelas de domínio (`academico`, `planejamento`, `producao`) deve conter o filtro `WHERE unidade_id = context.getTenantId()`.
2. **Superusuário (Administrador):** Apenas usuários com perfil `administrador` possuem permissão para trocar o `unidade_id` no cabeçalho ou consultar todas as unidades.
3. **Chave Estrangeira Obrigatória:** Nenhuma tabela transacional é criada sem chave estrangeira para `core.unidades(id)`.

---

## 5. Modelo de Segurança, Autenticação e RBAC

```mermaid
classDiagram
    class Usuario {
        +UUID id
        +UUID unidade_id
        +String nome
        +String email
        +String senha_hash
        +Boolean ativo
        +List~Perfil~ perfis
    }

    class Perfil {
        +UUID id
        +String slug
        +String nome
        +String descricao
        +List~Permissao~ permissoes
    }

    class Permissao {
        +UUID id
        +String modulo
        +String acao
        +String chave
        +String descricao
    }

    class Unidade {
        +UUID id
        +String codigo
        +String nome
        +String sigla
        +String cidade
    }

    Usuario "many" -- "1" Unidade : pertence a
    Usuario "many" <..> "many" Perfil : associado via usuario_perfis
    Perfil "many" <..> "many" Permissao : associado via perfil_permissoes
```

### 5.1 Ciclo de Vida do Token (JWT + Refresh Token)
- **Access Token:** JWT assinado com chave secreta (`HS256` ou `RS256`), tempo de vida curto (**15 a 60 minutos**), contendo `sub`, `email`, `unidade_id` e roles básicas.
- **Refresh Token:** Token opaco de alta entropia armazenado no Redis / PostgreSQL com tempo de vida de **7 dias**.
- **Rotação de Refresh Token:** A cada emissão de um novo access token, o refresh token anterior é revogado e substituído.

### 5.2 Avaliação de Permissões (RBAC Guard)
```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('usuarios.criar')
@Post()
async criarUsuario(@Body() dto: CreateUserDto) { ... }
```

---

## 6. Trilha de Auditoria Automatizada

A trilha de auditoria é tratada através de um **Interceptor Global de Auditoria** combinado com triggers de consistência no PostgreSQL:

```mermaid
flowchart LR
    Req["Requisição de Mutação\n(POST / PUT / PATCH / DELETE)"]
    Interceptor["AuditInterceptor"]
    UseCase["Execução do Caso de Uso"]
    AuditLog["Gravação em auditoria.logs\n(JSONB diff, IP, User, Timestamp)"]

    Req --> Interceptor
    Interceptor --> UseCase
    UseCase --> Interceptor
    Interceptor -->|Assíncrono / Fire-and-Forget| AuditLog
```

### Estrutura do Delta Gravado em `JSONB`:
```json
{
  "dados_anteriores": {
    "nome": "João da Silva",
    "ativo": false
  },
  "dados_novos": {
    "nome": "João da Silva",
    "ativo": true
  }
}
```

---

## 7. Estratégia de Caching e Resiliência (Redis)

O Redis 7 atua em três frentes fundamentais:

1. **Cache de Permissões do Usuário:** Armazenamento das permissões resolvidas por usuário sob a chave `sira:perms:{usuarioId}` com TTL de 30 minutos (invalidação sob alteração de perfil).
2. **Lista Negra de Tokens Revogados (Denylist):** Bloqueio imediato de tokens em caso de logout ou alteração de senha.
3. **Rate Limiting Distribuído:** Proteção de rotas sensíveis (`/auth/login`, `/auth/esqueci-senha`) limitando requisições abusivas por IP.

---

## 8. Tratamento Global de Erros & Padrão de Resposta

Erros na API devem seguir a especificação **RFC 7807 (Problem Details for HTTP APIs)**:

```json
{
  "type": "https://sira.senai.br/errors/unauthorized",
  "title": "Acesso Negado",
  "status": 403,
  "detail": "O usuário não possui a permissão 'turmas.editar' na unidade SENAI Cuiabá.",
  "instance": "/api/v1/turmas/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "timestamp": "2026-11-06T23:45:00.000Z",
  "traceId": "req-98f2b3e1-4c62-411a-82cf-e83c07641f92"
}
```

---

## 9. Observabilidade e Logging Estruturado

- **Logger:** Winston configurado com saída em JSON nos ambientes de produção e saída colorida formatada em desenvolvimento.
- **Trace Context:** Cada requisição recebe um cabeçalho `X-Trace-Id` que trafega entre os logs da aplicação, do banco e de auditoria para correlação direta de incidentes.


---

## 10. Arquitetura de Sincronização, Homologação e Promoção (Prod <-> Teste)

O SIRA adota um modelo de **Ambientes Gêmeos Isolados com Promoção Transacional de Cenários**. Este padrão resolve o desafio crítico de permitir que coordenadores simulem semestres letivos, organizem matrizes curriculares e testem grades horárias sem qualquer risco de corromper ou indisponibilizar a produção ativa.

```mermaid
flowchart TD
    subgraph PROD_ENV ["Ambiente de Produção (sira)"]
        PROD_DB[("PostgreSQL: sira\n(Multi-Schema: core, academico, planejamento)")]
        LIVE_USERS["Usuários Vivos / Diários / Chamadas / Auditoria"]
        LIVE_USERS --> PROD_DB
    end

    subgraph SYNC_ENGINE ["SIRA Sync Engine (SyncModule)"]
        MIRROR["1. Espelhamento Periódico / Sob Demanda\n(Snapshot pg_dump + Sanitização LGPD)"]
        VALIDATOR["2. Pre-flight Conflict Validator\n(Detecção Estrita de Choques)"]
        AUTH_GATE["3. Gatekeeper de Segurança\n(Validação de Senha Admin + RBAC)"]
        TRANSACTION["4. Promoção Atômica ($transaction)\n(Upsert Idempotente + Log Auditoria)"]
    end

    subgraph TEST_ENV ["Ambiente de Homologação / Sandbox (sira_teste)"]
        TEST_DB[("PostgreSQL: sira_teste\n(Cópia fiel para simulação)")]
        COORDINATOR["Coordenador / Gestor\n(Criação e Teste de Grades)"]
        COORDINATOR --> TEST_DB
    end

    PROD_DB -->|pg_dump snapshot| MIRROR
    MIRROR -->|Restore limpo| TEST_DB
    TEST_DB -->|Leitura do cenário testado| VALIDATOR
    VALIDATOR -->|0 Conflitos| AUTH_GATE
    AUTH_GATE -->|Autorização confirmada| TRANSACTION
    TRANSACTION -->|Escrita atômica idempotente| PROD_DB
```

### 10.1. Fluxo A: Produção ➔ Teste ("Espelhamento Constante")
- **Objetivo:** Fornecer um ambiente de testes 100% fiel à realidade operacional do SENAI.
- **Mecanismo:**
  1. Criação de snapshot do banco `sira` via `pg_dump` com nível de isolamento `REPEATABLE READ` (sem locks de leitura em produção).
  2. Restauração limpa no banco `sira_teste`.
  3. Sanitização de credenciais e dados sensíveis (LGPD), garantindo que dados confidenciais não fiquem expostos no ambiente de simulação.
- **Acionamento:** Via API (`POST /sync/mirror`), via CLI (`npm run db:mirror`) ou via `menu.bat [14]`.

### 10.2. Fluxo B: Teste ➔ Produção ("Envio com Senha e Autorização ADMIN")
- **Por que NÃO usar replicação física bidirecional:**
  Em produção ativa, novos dados são criados continuamente (notas, frequências, acessos, registros de auditoria). Um espelhamento bruto de volta destruiria dados vivos criados durante o período de planejamento.
- **A Solução Enterprise (Promoção Transacional de Cenários):**
  1. **Pre-flight Conflict Validation:** O sistema analisa a grade montada no banco de testes. Se houver qualquer conflito de sala ou sobrecarga de professor, o envio é **bloqueado imediatamente** (HTTP 409).
  2. **Validação de Credenciais Admin (2FA / Senha Master):** O endpoint exige a senha do administrador, validada criptograficamente via `bcrypt`.
  3. **Transação Atômica (`$transaction`):** O backend abre uma transação única no banco de produção. Todos os cursos, ambientes, docentes, turmas, feriados e agendamentos testados sofrem `upsert` idempotente. Se qualquer item falhar, ocorre `ROLLBACK` total.
  4. **Auditoria Imutável:** Um registro detalhado é gravado em `auditoria.logs` contendo o usuário responsável, IP, data/hora, justificativa/motivo e contagem dos registros promovidos.

---

## 11. Estratégia de Escalabilidade Enterprise & Migração de Infraestrutura

Se a plataforma SIRA for expandida para nível estadual ou nacional (milhares de docentes e centenas de unidades operacionais), a arquitetura foi desenhada para migrar suavemente sem necessidade de reescrever código:

### 11.1. Desacoplamento via Configuração 12-Factor
A aplicação consome conexões via variáveis de ambiente (`DATABASE_URL` e `DATABASE_TEST_URL`). Em um ambiente de alta escala:
- `sira` pode residir em um cluster **AWS RDS PostgreSQL Multi-AZ** ou **GCP Cloud SQL**.
- `sira_teste` pode residir em uma instância isolada de menor custo ou cluster de Staging.
- **Zero linhas de código do backend precisam ser alteradas**, apenas os endpoints nas variáveis de ambiente.

### 11.2. Escalabilidade Horizontal da API NestJS
- Como a API é **stateless** (sessões mantidas no Redis e tokens JWT), basta subir múltiplas instâncias da API atrás de um **Load Balancer (NGINX, AWS ALB ou Traefik)**.
- O rate limiting e a lista de revogação de tokens continuam centralizados no Redis Cluster compartilhado.

### 11.3. Réplicas de Leitura (Read Replicas)
Para relatórios pesados e visões analíticas da diretoria:
- Provisionam-se réplicas de leitura assíncronas do PostgreSQL (`sira-read-replica`).
- O Prisma ORM suporta extensões de read/write splitting, direcionando consultas pesadas de dashboards analíticos para a réplica, preservando 100% da CPU do banco principal para agendamentos e transações acadêmicas.
