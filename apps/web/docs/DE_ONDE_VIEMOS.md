# De Onde Viemos: Histórico, Desafios Iniciais e Evolução da Engenharia

Este documento registra a trajetória técnica e organizacional do sistema **Macro Micro Schedule**, explicando as origens do projeto, as dores que motivaram cada decisão de engenharia e os marcos de evolução que transformaram a ferramenta em uma plataforma multi-unidades com arquitetura modular e motor de agendamento inteligente.

---

## 1. O Ponto de Partida: A Dor Inicial

Antes da criação do sistema, o planejamento e alocação de aulas, docentes e ambientes nas unidades do SENAI enfrentavam desafios operacionais complexos:

* **Planilhas Fragmentadas:** Cada coordenação e setor mantinha planilhas isoladas (Excel/Google Sheets) para turmas, professores e salas.
* **Colisões de Recursos Frequentes:** Era comum professores serem alocados simultaneamente em duas turmas diferentes, ou dois cursos serem agendados na mesma sala/laboratório no mesmo horário.
* **Falta de Rastreabilidade e Auditoria:** Quando ocorria uma alteração ou cancelamento de horário, não havia histórico de quem realizou a modificação, em qual momento ou por qual motivo.
* **Fricção nas Trocas de Horário (*Swaps*):** Quando um docente precisava permutar aulas com um colega, o processo envolvia trocas manuais de mensagens e e-mails, com alto risco de desatualização da grade oficial.
* **Consumo Ineficiente de Ambientes:** Dificuldade em metrificar a ociosidade ou sobrecarga de laboratórios técnicos e oficinas industriais.

A iniciativa **Macro Micro Schedule** nasceu para centralizar, automatizar e blindar a grade de agendamento escolar com regras de consistência em tempo real.

---

## 2. Primeira Fase: O Protótipo Mono-Unidade

O desenvolvimento inicial focou em uma prova de conceito (PoC) para resolver o problema na unidade de **Cáceres (MT)**.

### Características do MVP:
1. **Frontend Rápido:** Aplicação SPA em React com TypeScript e componentes visuais do ecossistema Shadcn/Radix UI.
2. **Backend Serverless:** Adoção do Firebase (Firestore + Firebase Authentication) para prototipação veloz sem necessidade de gerenciar servidores dedicados.
3. **Modelagem Direta:**
   * Coleções simples e planas: `schedules`, `teachers`, `rooms`, `classes`, `courses`.
   * Agendamentos armazenando referências diretas a IDs de turmas e salas.
   * Validações básicas de não sobreposição diretamente no cliente.

### Lições Aprendidas na Fase 1:
* O sistema comprovou de imediato seu valor: o índice de salas duplicadas caiu a zero nas semanas iniciais.
* O fuso horário de **Cuiabá/Mato Grosso (UTC-4)** exigiu padronização rigorosa nos timestamps para evitar que aulas matutinas fossem renderizadas como vespertinas devido a conversões de timezone local do navegador.

---

## 3. Segunda Fase: A Expansão Multi-Unidades (Multi-Tenant Lógico)

Com o sucesso em Cáceres, surgiu a demanda de implantar o sistema em outras unidades do SENAI Mato Grosso (como **Várzea Grande** e **Barra do Bugres**).

### A Decisão Arquitetural: Multi-Tenant Lógico
Em vez de instanciar bancos separados para cada escola (o que multiplicaria custos e manutenção), optamos pelo **Multi-Tenant Lógico**:
* Documentos das coleções receberam os campos `unitId` e `unitName`.
* O perfil do usuário (`users/{uid}`) passou a conter um array `unitIds` (unidades autorizadas) e o campo `selectedUnitId` (unidade em visualização ativa).
* Foi desenvolvido o componente de troca rápida de unidade na barra lateral com persistência em tempo real e tela de transição de dados.
* Regras rígidas no [firestore.rules](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/firestore.rules) foram criadas para garantir que usuários de uma unidade jamais pudessem ler ou gravar dados de outra.

---

## 4. Terceira Fase: Consolidação dos Módulos Operacionais

Para atender à rotina escolar completa, novos domínios funcionais foram acoplados ao sistema:

1. **Hub de Conflitos:** Detecção atômica de colisões de turmas, docentes e salas, permitindo à coordenação visualizar e resolver pendências pontuais.
2. **Replicador Mensal de Grade:** Cópia de cronogramas de um mês para o outro com suporte a reversão (*Undo*).
3. **Logística & Estoque:** Inclusão dos módulos de **Uniformes & EPIs** e **Gestão de Ativos/Manutenção de Salas**.
4. **Central de Relatórios:** Geração de 10 relatórios consolidados com exportação direta para planilhas Excel (.xlsx) com auto-ajuste de colunas.
5. **Acompanhamento Docente (MSEP / SLIs Pedagógicos):** Sistema estruturado de observação de sala de aula e planos de ação individuais, com regras confidenciais protegidas por LGPD.
6. **Controle de Acesso RBAC:** Criação dos papéis `ADMIN`, `USER`, `PROFESSOR` e `PARTNER_SCHOOL`.

---

## 5. Os Três Grandes Gargalos que Exigiram a Reestruturação

Com o crescimento para mais de 15 módulos operacionais, três problemas críticos emergiram e exigiram intervenção definitiva da engenharia:

### Gargalo 1: Fragilidade Monolítica do Frontend
* **Acoplamento Extremo:** O arquivo [Dashboard.tsx](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/Dashboard.tsx) acumulava mais de 25 imports diretos e um switch/case com mais de 20 casos.
* **Ausência de Tolerância a Falhas:** Um erro de execução (runtime exception) em qualquer módulo secundário (como um relatório ou gráfico) provocava a quebra de toda a aplicação (tela branca da morte), derrubando a sessão de todos os usuários.
* **Menus Inflexíveis:** Para liberar uma tela para um colaborador, era necessário alterar o código-fonte ou alterar seu papel global (`role`).

### Gargalo 2: O Falso Positivo das "Reservas Diretas" (Professor Fantasma)
* **Origem do Problema:** Ao agendar eventos institucionais (como *Reuniões Pedagógicas*, *Setembro Amarelo* ou *Manutenções*), o sistema gravava o UID do usuário administrador no campo `teacherId`.
* **Consequência:** A rotina de diagnóstico do Super Admin comparava o `teacherId` exclusivamente com a coleção `teachers`. Como os administradores eram cadastrados na coleção `users`, a ferramenta listava 22 agendamentos válidos como "professores fantasmas" e oferecia um botão destrutivo que apagaria dados institucionais reais.

### Gargalo 3: Governança Rígida e Débito de Agendamento
* O papel de `SUPER_ADMIN` estava acoplado a um e-mail hardcoded (`viniciusladeialara@gmail.com`), violando boas práticas de segurança e governança.
* O agendamento funcionava como um "caderno digital manual" — faltavam recursos de produtividade essenciais: replicação de semana em 1 clique, sincronização com o Google Calendar dos professores, respeito automático a feriados cadastrados e interface amigável para professores em oficinas mecânicas e laboratórios.

---

## 6. O Ponto de Virada: A Nova Engenharia

Diante desse diagnóstico, realizamos a reestruturação profunda dividida em três frentes:
1. **Implantação do Core Modular (Micro-Kernel):** Isolamento total de falhas com `<ModuleErrorBoundary>` e catálogo centralizado de módulos liberados dinamicamente no Firestore.
2. **Medidas Corretivas de Governança (PRD Corretivo):** Formalização de `SUPER_ADMIN` como role de primeira classe, auditoria corporativa imutável append-only e normalização atômica das reservas diretas.
3. **Motor de Excelência em Agendamento (PRD Agendamento):** Cópia inteligente de semanas, integração com Google Agenda / iCal `.ics`, pulo automático de feriados e taxas de ocupação em tempo real.

*(Para a documentação completa do ecossistema atual, arquitetura e instruções técnicas, consulte [ONDE_ESTAMOS.md](./ONDE_ESTAMOS.md)).*
