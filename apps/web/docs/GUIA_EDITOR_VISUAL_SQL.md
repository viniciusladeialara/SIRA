# 🎨 Guia de Conexão: Editor Visual de Banco de Dados SQL (Estilo Supabase)

Este guia orienta a configuração do **Beekeeper Studio** ou **TablePlus** para visualizar e gerenciar o banco de dados PostgreSQL do projeto em uma interface gráfica em formato de planilha visual, substituindo o pgAdmin.

---

## 🐝 Opção Recomendada 1: Beekeeper Studio (Mais Parecido com o Supabase)

### 1. Download e Instalação
- Faça o download gratuito da versão Community Edition no site oficial:  
  👉 **[https://www.beekeeperstudio.io/download](https://www.beekeeperstudio.io/download)**

### 2. Configurando a Conexão no Beekeeper Studio
Ao abrir o Beekeeper Studio, escolha a opção **PostgreSQL** na tela inicial de conexão e preencha os dados abaixo:

| Campo | Valor |
| :--- | :--- |
| **Connection Type** | `PostgreSQL` |
| **Host / Server** | `localhost` (ou `127.0.0.1`) |
| **Port** | `5432` |
| **Database Name** | `agendamento_db` (ou `postgres`) |
| **User / Username** | `postgres` |
| **Password** | `postgres` |

> 💡 *Dica:* Clique em **"Test Connection"** para confirmar e depois em **"Save & Connect"**.

### 3. Como Navegar pelas Tabelas (Estilo Supabase)
1. No painel esquerdo, você verá todas as tabelas: `users`, `units`, `teachers`, `rooms`, `courses`, `classes`, `patrimonies`, `inventory_items`.
2. Clique duas vezes em qualquer tabela para abrir a grade visual de dados.
3. Você pode filtrar colunas, ordenar registros e editar valores clicando direto na célula e pressionando `Ctrl + S`.

---

## ⚡ Opção Recomendada 2: TablePlus (Mais Rápido e Elegante)

### 1. Download e Instalação
- Faça o download gratuito no site oficial:  
  👉 **[https://tableplus.com](https://tableplus.com)**

### 2. Configurando a Conexão no TablePlus
1. Clique em **Create a new connection...** ➔ Selecione **PostgreSQL**.
2. Preencha os campos de conexão:
   - **Host:** `localhost`
   - **Port:** `5432`
   - **User:** `postgres`
   - **Password:** `postgres`
   - **Database:** `agendamento_db`
3. Clique em **Test** e depois em **Connect**.

---

## 📜 Executando Scripts de Carga (Seeds) no Editor Visual

Para rodar scripts SQL (como o `docs/db/seed_teste_completo.sql`):
1. No **Beekeeper Studio** ou **TablePlus**, abra a aba de **Query Editor** (`Ctrl + T` ou ícone de raio/lápis).
2. Abra ou cole o conteúdo do arquivo [docs/db/seed_teste_completo.sql](file:///c:/Users/VINICIUS/Documents/GitHub/agendamento-ambiente/docs/db/seed_teste_completo.sql).
3. Pressione `Ctrl + Enter` ou o botão **Run / Execute** para rodar a carga.
