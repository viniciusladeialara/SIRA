# 🚀 Guia Passo a Passo: Pós Subir os Serviços (API, PostgreSQL e Dashboard)

Este guia orienta o acesso à aplicação, testes de saúde da API, ferramentas visuais de SQL e monitoramento em tempo real do banco de dados.

---

## 🛠️ 1. Serviços Ativos e Portas

Ao executar o menu principal (`.\menu.bat` ➔ Opção `1`), os seguintes serviços estarão operacionais:

- **Frontend (Vite / React):** 👉 [http://localhost:8080](http://localhost:8080)
- **API REST (Node.js / Express):** 👉 [http://localhost:3000](http://localhost:3000)
- **PostgreSQL (Banco de Dados):** `localhost:5432` (`agendamento_db`)
- **PgHero (Monitor de Queries / Kill Processos):** 👉 [http://localhost:8090](http://localhost:8090)
- **Grafana (Dashboard Visual de Performance):** 👉 [http://localhost:3001](http://localhost:3001)

---

## 🌐 2. Verificação de Saúde da API (Healthcheck)

Abra seu navegador no endereço:

👉 **[http://localhost:3000/health](http://localhost:3000/health)**

Você verá o retorno JSON confirmando a API ativa:
```json
{
  "status": "ok",
  "message": "API SQL Macro-Micro Schedule PDR Enterprise ativa"
}
```

---

## 🔑 3. Credencial Inicial do Super Admin

Acesse o frontend em [http://localhost:8080](http://localhost:8080) e faça login:

- **E-mail Super Admin:** `viniciusladeiala@gmail.com`
- **Senha:** `abcd@321**`

> 💡 *A partir do Super Admin, você pode criar e parametrizar usuários para 1, 2 ou as 3 Unidades Institucionais (`SENAI Cáceres`, `SENAI Barra do Bugres` e `SENAI Várzea Grande`).*

---

## 🎨 4. Gerenciador Visual de Banco de Dados (Estilo Supabase)

Recomendamos o uso do **Beekeeper Studio** ou **TablePlus** para visualizar o banco como planilha:

1. Baixe o **Beekeeper Studio**: 👉 [https://www.beekeeperstudio.io/download](https://www.beekeeperstudio.io/download)
2. Conecte com:
   - **Host:** `localhost` | **Porta:** `5432`
   - **User:** `postgres` | **Password:** `postgres` | **Database:** `agendamento_db`
3. Dê **duplo clique** em qualquer tabela (`users`, `units`, `rooms`, `classes`) para ver e editar os dados em tempo real.

---

## 🛡️ 5. Monitoramento de Queries e Performance (PgHero & Grafana)

- **PgHero ([http://localhost:8090](http://localhost:8090)):** Veja queries em tempo real e encerre consultas travadas com 1 clique.
- **Grafana ([http://localhost:3001](http://localhost:3001)):** Login `admin` / `admin` para visualizar gráficos de conexões e carga de transações.
