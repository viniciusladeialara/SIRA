# 🛡️ Supervisor e Monitor do Banco de Dados PostgreSQL (Docker + Grafana + PgHero)

Este módulo adiciona uma infraestrutura completa de monitoramento do PostgreSQL em tempo real usando **Docker**, **Grafana**, **Prometheus**, **postgres_exporter** e **PgHero**.

---

## 📊 Endereços dos Painéis de Monitoramento

| Serviço | Descrição | Endereço (URL) | Credenciais Padrão |
| :--- | :--- | :--- | :--- |
| 📊 **Grafana Dashboard** | Dashboard visual estilo Dark Mode em tempo real | 👉 [http://localhost:3001](http://localhost:3001) | **Usuário:** `admin`<br>**Senha:** `admin` |
| ⚡ **PgHero** | Monitor de Consultas Lentas/Travadas & Matar Processos | 👉 [http://localhost:8090](http://localhost:8090) | Sem senha |
| 📈 **Prometheus** | Coletor de Métricas e Séries Temporais | 👉 [http://localhost:9090](http://localhost:9090) | N/A |
| 🔌 **Postgres Exporter** | Exportador Nativo de Métricas SQL | 👉 [http://localhost:9187/metrics](http://localhost:9187/metrics) | N/A |

---

## 🚀 Principais Recursos do Supervisor

### 1. Monitor de Consultas Travadas / Locks (PgHero em http://localhost:8090)
- **Live Queries:** Exibe todas as consultas em execução em tempo real no banco de dados.
- **Kill Query:** Botão instantâneo para derrubar consultas travadas ou bloqueantes com 1 clique.
- **Space & Cache:** Exibe a taxa de acerto de cache (*Cache Hit Rate*) e o tamanho individual de cada tabela.
- **Index Tuning:** Identifica automaticamente tabelas com falta de índices.

### 2. Painel Visual Grafana (http://localhost:3001)
- Conexão pré-configurada com a fonte de dados Prometheus.
- Medição de conexões ativas, transações por segundo e tempo de resposta de queries.

---

## 🛠️ Comandos de Gestão do Docker Monitoring Stack

- **Iniciar o Supervisor:**
  ```powershell
  docker compose -f docker-compose.monitoring.yml up -d
  ```

- **Verificar o Status dos Contêineres:**
  ```powershell
  docker compose -f docker-compose.monitoring.yml ps
  ```

- **Parar o Supervisor:**
  ```powershell
  docker compose -f docker-compose.monitoring.yml down
  ```
