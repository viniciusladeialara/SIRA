# SIRA – Manual de Arquitetura do Duplo Banco de Dados
## Espelhamento Produção ➔ Teste e Promoção Transacional Teste ➔ Produção

Este documento detalha o funcionamento técnico, os protocolos de segurança e o passo a passo operacional da **Arquitetura de Duplo Banco de Dados do SIRA**, atendendo ao fluxo de simulação, homologação e publicação segura de recursos acadêmicos para as unidades do SENAI.

---

## 📌 Sumário
1. [Por que Dois Bancos de Dados Isolados?](#1-por-que-dois-bancos-de-dados-isolados)
2. [O Modelo Arquitetural em Detalhes](#2-o-modelo-arquitetural-em-detalhes)
3. [Fluxo 1: Produção ➔ Teste (Espelhamento Constante)](#3-fluxo-1-produção--teste-espelhamento-constante)
4. [Fluxo 2: Homologação no Sandbox (Testes sem Risco)](#4-fluxo-2-homologação-no-sandbox-testes-sem-risco)
5. [Fluxo 3: Teste ➔ Produção (Promoção com Senha de Admin)](#5-fluxo-3-teste--produção-promoção-com-senha-de-admin)
6. [Pre-flight Conflict Check (A Barreira contra Conflitos)](#6-pre-flight-conflict-check-a-barreira-contra-conflitos)
7. [Transação Atômica & Trilha Imutável de Auditoria](#7-transação-atômica--trilha-imutável-de-auditoria)
8. [Como Operar na Prática (Menu, Terminal e API)](#8-como-operar-na-prática-menu-terminal-e-api)
9. [Guia de Migração para Nuvem (Alta Escala)](#9-guia-de-migração-para-nuvem-alta-escala)

---

## 1. Por que Dois Bancos de Dados Isolados?

Em sistemas educacionais e de gestão de recursos físicos como o SIRA, o maior desafio operacional é a **montagem e reformulação de grades horárias semestrais**:
- Coordenadores precisam simular dezenas de alocações: testar novas salas, trocar turmas de turno, alocar professores e verificar limites de carga horária.
- **Se essa simulação for feita diretamente no banco de produção:**
  1. Professores e alunos veriam turmas incompletas ou erradas em tempo real.
  2. Um clique errado poderia apagar históricos ou agendamentos ativos.
  3. Relatórios gerenciais e diários de classe ficariam corrompidos.
- **Se usarmos bancos isolados (`sira` e `sira_teste`):**
  * O coordenador tem um ambiente idêntico à realidade da unidade para experimentar livremente.
  * A operação real do SENAI continua rodando com 100% de estabilidade e segurança.

---

## 2. O Modelo Arquitetural em Detalhes

```mermaid
flowchart TD
    subgraph BANCO_PRODUCAO ["PostgreSQL: sira (Produção Oficial)"]
        PROD_DATA["• Unidades, Perfis, Usuários Oficiais\n• Cursos e Turmas Ativas\n• Agendamentos em Andamento\n• Trilha Imutável de Auditoria (auditoria.logs)"]
    end

    subgraph ENGINE_SIRA ["Engine SIRA Sync (SyncModule)"]
        A_MIRROR["ETAPA 1: Espelhamento não bloqueante\n(pg_dump snapshot REPEATABLE READ)"]
        B_TEST["ETAPA 2: Sandbox de Simulação\n(Coordenador ajusta horários)"]
        C_CHECK["ETAPA 3: Pre-flight Conflict Validator\n(Detecção Estrita: 0 Choques de Horário)"]
        D_AUTH["ETAPA 4: Gatekeeper de Segurança\n(Validação de Senha Admin com Bcrypt)"]
        E_ATOMIC["ETAPA 5: Transação Atômica ($transaction)\n(Upsert idempotente + Gravação em auditoria.logs)"]
    end

    subgraph BANCO_TESTE ["PostgreSQL: sira_teste (Sandbox / Testes)"]
        TEST_DATA["• Cópia fiel de Produção\n• Permite criar/editar/excluir sem risco\n• Sanitização de dados confidenciais (LGPD)"]
    end

    BANCO_PRODUCAO -->|1. Snapshot seguro| A_MIRROR
    A_MIRROR -->|2. Restauração limpa| BANCO_TESTE
    BANCO_TESTE -->|3. Coordenador simula| B_TEST
    B_TEST -->|4. Solicita publicação| C_CHECK
    C_CHECK -->|5. Aprovado (0 conflitos)| D_AUTH
    D_AUTH -->|6. Senha confirmada| E_ATOMIC
    E_ATOMIC -->|7. Gravação segura sem afetar dados vivos| BANCO_PRODUCAO
```

---

## 3. Fluxo 1: Produção ➔ Teste (Espelhamento Constante)

> **Objetivo:** Manter o banco de testes atualizado com as unidades, salas e professores reais do SENAI.

### Como funciona:
1. O comando é acionado pelo administrador.
2. O sistema executa um `pg_dump` no banco `sira` utilizando o nível de transação `REPEATABLE READ`.
   * **Vantagem:** Não trava tabelas, não bloqueia inserções de chamada e não causa lentidão para os usuários logados no SIRA.
3. O banco `sira_teste` é recriado e os schemas (`core`, `academico`, `planejamento`) são restaurados.
4. **Proteção LGPD:** Senhas de usuários e dados pessoais sensíveis podem ser mascarados automaticamente para que operadores de teste não tenham acesso a credenciais reais.

---

## 4. Fluxo 2: Homologação no Sandbox (Testes sem Risco)

No banco `sira_teste`, os coordenadores e gestores possuem liberdade total para:
- Cadastrar novas turmas e cursos que iniciarão no próximo semestre.
- Alocar docentes nas salas físicas e laboratórios de informática.
- Simular trocas de professores substitutos.
- Ajustar os feriados municipais de cada unidade (Cuiabá, Cáceres, Rondonópolis).

---

## 5. Fluxo 3: Teste ➔ Produção (Promoção com Senha de Admin)

> **Objetivo:** Promover o planejamento validado para a produção sem risco de inconsistências.

*Por que NÃO usar uma sincronização cega de tabelas do banco de dados?*  
Porque enquanto o coordenador passava dias preparando o planejamento no banco de testes, a produção continuou recebendo novos cadastros de alunos, apontamentos de diário de classe e registros de auditoria. Se fizéssemos um espelhamento bruto de volta, esses dados vivos seriam **destruídos**.

### As 4 Etapas de Segurança da Promoção:

#### 1ª Etapa: Validação Prévia de Conflitos (Pre-flight Conflict Check)
Antes de qualquer envio, o motor do SIRA inspeciona toda a grade montada no banco de testes:
- Checa se há duas turmas agendadas na mesma sala no mesmo horário.
- Checa se há um professor alocado em duas salas ao mesmo tempo.
- **Se houver 1 único conflito:** A operação é cancelada imediatamente com retorno HTTP 409 (Conflict), listando os nomes das turmas, professores e horários em conflito.

#### 2ª Etapa: Gatekeeper de Segurança com Senha de Administrador
- Apenas usuários com perfil `administrador` ou `gestor` podem solicitar a promoção.
- O sistema exige a digitação da senha master do administrador.
- A senha é checada usando hash Bcrypt contra a tabela `core.usuarios` de produção. Se a senha estiver errada, a requisição é rejeitada com HTTP 401 (Unauthorized).

#### 3ª Etapa: Transação Atômica no Banco de Produção (`$transaction`)
O NestJS abre uma transação atômica única no banco `sira`. Dentro dessa transação:
- Executa `upsert` idempotente de `cursos`.
- Executa `upsert` idempotente de `ambientes`.
- Executa `upsert` idempotente de `docentes`.
- Executa `upsert` idempotente de `turmas`.
- Executa `upsert` idempotente de `feriados`.
- Executa `upsert` idempotente de `agendamentos`.
- **Garantia ACID:** Se a conexão cair ou houver qualquer erro de integridade referencial, o PostgreSQL faz **ROLLBACK TOTAL**, deixando a produção intacta.

#### 4ª Etapa: Registro Imutável em `auditoria.logs`
A transação grava um registro imutável contendo:
- Email e UUID do Administrador que autorizou.
- Endereço IP do cliente.
- Justificativa / Motivo da publicação (ex: *"Publicação da Matriz Curricular 2026/1 - SENAI Cuiabá"*).
- Contadores detalhados de quantos registros foram promovidos em JSONB.

---

## 6. Pre-flight Conflict Check (A Barreira contra Conflitos)

A fórmula matemática de colisão de intervalos temporais utilizada pelo SIRA é:
$$\text{Colisão} \iff (\text{Início}_A < \text{Fim}_B) \land (\text{Fim}_A > \text{Início}_B)$$

O motor analisa pares de agendamentos dentro da mesma sala física e para o mesmo docente. Somente quando $\text{Colisões} = 0$, o sistema libera a passagem para o gatekeeper de senha.

---

## 7. Como Operar na Prática (Menu, Terminal e API)

### Opção 1: Pelo Painel Interativo `menu.bat` (Mais Simples)
Basta abrir o `menu.bat`:
- **Digite `[14]`**: O sistema espelha instantaneamente Produção para Teste (`sira -> sira_teste`).
- **Digite `[15]`**: O sistema solicita o e-mail, senha de admin e motivo, valida os conflitos e promove o cenário para Produção.

### Opção 2: Pela Linha de Comando (npm)
```bash
# 1. Espelhar Produção -> Teste
npm run db:mirror

# 2. Promover Cenário de Teste -> Produção com Senha
npm run db:promote

# 3. Rodar a bateria de testes automatizados dos dois bancos
npm run test:sync
```

### Opção 3: Pela API REST NestJS
- `GET /api/v1/sync/status` (Exibe contagens comparativas entre `sira` e `sira_teste`).
- `GET /api/v1/sync/validate?unidadeId=...` (Verifica choques no banco de testes).
- `POST /api/v1/sync/mirror` (Dispara espelhamento com payload `{ adminPassword, sanitize }`).
- `POST /api/v1/sync/promote` (Dispara promoção com payload `{ adminPassword, motivo, unidadeId }`).

---

## 8. Guia de Migração para Nuvem (Alta Escala)

Se no futuro o SENAI implementar essa plataforma em escala estadual ou nacional:
1. **Configuração 12-Factor:** As variáveis `DATABASE_URL` e `DATABASE_TEST_URL` no `.env` apontarão para dois clusters gerenciados (ex: AWS RDS Multi-AZ em instâncias separadas).
2. **Zero Mudança no Código:** Como os scripts e services utilizam abstrações sobre as variáveis de ambiente e conexões padrão do PostgreSQL, o sistema funciona de forma idêntica em Docker local, instâncias EC2 ou pods Kubernetes (EKS / GKE).
