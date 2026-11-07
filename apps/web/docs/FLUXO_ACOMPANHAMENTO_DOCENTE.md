# Fluxo Operacional e Pedagógico: Acompanhamento Docente (MSEP / SLI)

Este documento descreve o fluxo de trabalho ponta a ponta para o **Acompanhamento Docente** no SENAI MT, baseado na **Metodologia SENAI de Educação Profissional (MSEP)** e governado por **Indicadores de Nível de Serviço (SLI/SLA)**.

---

## 1. Visão Geral do Fluxo

O processo de acompanhamento docente tem como objetivo garantir a excelência pedagógica, o suporte contínuo aos professores e a conformidade com as diretrizes educacionais do SENAI. O fluxo ocorre em **6 etapas sequenciais**, integrando a base nominal de professores, observação presencial, devolutiva estruturada, planos de ação e indicadores de fechamento mensal.

```mermaid
flowchart TD
    Start([Início da Competência / Mês]) --> Step1[Etapa 1: Planejamento & Fila de Atenção<br/>• Sincronização da lista nominal de docentes<br/>• Alertas SLI: > 30 dias sem visita ou pendências]
    
    Step1 --> Step2[Etapa 2: Observação Pedagógica em Sala/Lab<br/>• Presença física da coordenação na aula agendada<br/>• Análise dos 3 eixos da Metodologia MSEP]
    
    Step2 --> Step3[Etapa 3: Registro Pedagógico no Sistema<br/>• Preenchimento do formulário MSEP<br/>• Práticas exitosas, melhorias e conformidade<br/>• Status muda para 'Em Andamento' (Amarelo)]
    
    Step3 --> Step4[Etapa 4: Devolutiva Individual / Feedback<br/>• SLA-01: Prazo máximo de 5 dias úteis<br/>• Canal: Presencial, Teams ou Reunião<br/>• Status muda para 'Concluído' (Verde)]
    
    Step4 --> CheckAction{Necessita Plano<br/>de Ação?}
    
    CheckAction -- Sim --> Step5[Etapa 5: Gestão do Plano de Ação<br/>• Metas pedagógicas com prazo definido<br/>• Alertas diários SLI-03 (vencimento em 3 dias)<br/>• Monitoramento e baixa de conclusão]
    CheckAction -- Não --> Step6
    Step5 --> Step6[Etapa 6: Fechamento Mensal & Prestação de Contas<br/>• Auditoria dos SLIs (Cobertura 100%, Fila 0)<br/>• Exportação de Relatório Executivo (.xlsx)]
    
    Step1 -. Casos excepcionais (licença/afastamento) .-> Waiver[Registro de Dispensa Justificada<br/>Auditável no Sistema]
    Waiver --> Step6
    
    Step6 --> End([Fechamento da Competência])

    classDef step fill:#f0f9ff,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef alert fill:#fef2f2,stroke:#ef4444,stroke-width:2px,color:#991b1b;
    classDef success fill:#f0fdf4,stroke:#22c55e,stroke-width:2px,color:#15803d;
    class Step1,Step2,Step3,Step4,Step5 step;
    class Waiver alert;
    class Step6 success;
```

---

## 2. Detalhamento das Etapas

### Etapa 1: Planejamento & Fila de Atenção Operacional

* **Responsável:** Coordenação Pedagógica (`viniciusladeialara@gmail.com`).
* **Periodicidade:** Início do mês (competência `YYYY-MM`) e revisão semanal.
* **Ações:**
  1. Acessar a [Central de Acompanhamento Docente](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/src/components/modules/TeacherMonitoringModule.tsx) no sistema.
  2. O sistema consome automaticamente a lista nominal de professores ativos (`teachers`) cadastrados na unidade, sincronizando com a competência selecionada sem duplicação de dados.
  3. A coordenação visualiza os **Cartões de Alerta Operacional** gerados pelo motor analítico:
     * 🔴 **Alerta Crítico:** Docentes com mais de 30 dias sem acompanhamento pedagógico.
     * 🟡 **Alerta de Urgência:** Pendências na fila nos últimos 7 dias do mês (risco ao SLO).
     * 🟠 **Alerta de Prazos:** Planos de ação com vencimento em até 3 dias ou expirados.
     * 🔵 **Alerta de Devolutiva:** Acompanhamentos realizados aguardando feedback próximo do prazo de 5 dias.
* **Saída:** Definição do cronograma semanal de visitas às salas e laboratórios.

---

### Etapa 2: Observação Pedagógica em Sala / Laboratório (MSEP)

* **Responsável:** Coordenação Pedagógica / Especialista de Ensino.
* **Local:** Sala de aula, oficina técnica ou laboratório de informática da unidade.
* **Critérios de Observação (Metodologia SENAI MSEP):**
  1. **Estratégias de Ensino-Aprendizagem:** Aplicação de metodologias ativas, contextualização com a prática profissional da indústria, problematização e estímulo à autonomia do estudante.
  2. **Domínio Técnico e Mediação Pedagógica:** Clareza conceitual, comunicação assertiva, esclarecimento de dúvidas e condução segura do conteúdo programático.
  3. **Gestão do Ambiente e Recursos:** Organização do espaço físico, cumprimento de normas de segurança (EPIs/EPCs), disciplina da turma, pontualidade e uso adequado de materiais e simuladores.

---

### Etapa 3: Registro Pedagógico no Sistema

* **Responsável:** Coordenação Pedagógica.
* **Momento:** Imediatamente após a observação ou no mesmo dia útil.
* **Ações no Sistema:**
  1. Localizar o docente na tabela e clicar em **"Registrar"** (ou **"Editar"**).
  2. Preencher os campos do formulário MSEP:
     * **Data da Observação:** Data e horário da aula observada.
     * **Avaliador / Observador:** Nome do coordenador responsável.
     * **Unidade Curricular & Ambiente:** Componente curricular e sala/laboratório.
     * **Práticas Exitosas (Pontos Fortes):** Reconhecimento de técnicas assertivas e engajamento da turma.
     * **Oportunidades de Melhoria:** Aspectos que requerem evolução didática, técnica ou de postura pedagógica.
     * **Nível de Conformidade MSEP:** Selecionar `Conforme (Total)`, `Parcial` ou `Em Adequação`.
  3. Ao salvar, o status do docente transita automaticamente de `Pendente` (Vermelho) para **`Em Andamento`** (Amarelo).
  4. O sistema calcula e ativa automaticamente o **SLA-01** (Prazo de Devolutiva de 5 dias úteis).

---

### Etapa 4: Devolutiva Individual Estruturada (Feedback Pedagógico)

* **Responsável:** Coordenação Pedagógica e Docente.
* **Prazo (SLA-01):** Até **5 dias úteis** após a data da observação (Meta corporativa: $\ge 95\%$).
* **Dinâmica da Devolutiva:**
  * Reunião individualizada (Presencial, Microsoft Teams ou Reunião Pedagógica).
  * Diálogo construtivo: iniciar pelos pontos fortes e reconhecimentos, apresentar as oportunidades de evolução com base nas evidências coletadas e pactuar melhorias.
* **Ações no Sistema:**
  1. Clicar em **"Devolutiva"** na linha do professor.
  2. Informar a **Data da Devolutiva**, o **Canal Utilizado** (Presencial, Teams, E-mail, Reunião) e as **Notas / Síntese do Alinhamento**.
  3. Confirmar o envio. O status do docente transita para **`Concluído`** (Verde).

---

### Etapa 5: Construção e Monitoramento do Plano de Ação (SLI-03)

* **Quando se aplica:** Sempre que houver conformidade `Parcial`, `Em Adequação` ou necessidade de capacitação/alinhamento de entrega.
* **Ações no Sistema:**
  1. Clicar em **"Planos de Ação"** na linha do docente.
  2. Cadastrar as ações pactuadas com descrição detalhada (ex.: *"Participar do alinhamento de rubricas de avaliação por competências"*, *"Revisar o plano de aula com foco em contextualização industrial"*).
  3. Estabelecer o **Prazo Limite (`dueDate`)** para conclusão.
* **Acompanhamento Contínuo:**
  * O motor de SLI monitora os prazos diariamente. Se faltarem 3 dias ou menos, ou se a data expirar, um alerta visual é emitido na Fila de Atenção.
  * Ao cumprir a meta, a coordenação marca o item como **Concluído**, registrando a data de conclusão para cômputo do **SLI-03** ($\ge 90\%$).

---

### Etapa 6: Fechamento Mensal, Auditoria & Exportação

* **Responsável:** Coordenação e Gestão Escolar.
* **Periodicidade:** Última semana da competência.
* **Casos Excepcionais (Dispensa Justificada):**
  * Para docentes afastados por atestado médico, licença-maternidade ou formalmente liberados no mês, a coordenação clica em **"Dispensar"** e insere a justificativa detalhada.
  * O docente dispensado é excluído da meta mensal de observação sem penalizar a cobertura (SLI-01).
* **Exportação para Excel (.xlsx):**
  * O sistema permite a exportação com 1 clique (`XLSX`) contendo duas planilhas formatadas:
    1. `Agenda_<Competencia>`: Relação completa de professores, vínculos, status, datas, aspectos MSEP e planos de ação.
    2. `Indicadores_SLI`: Resumo consolidado dos 4 indicadores (SLI-01, SLI-02, SLA-01, SLI-03) e alertas operacionais.

---

## 3. Matriz de Indicadores (SLI / SLA / SLO)

| Indicador | Lógica de Cálculo | Meta (SLO) | Faixas de Alerta |
|---|---|:---:|---|
| **SLI-01: Cobertura Mensal** | $\frac{\text{Docentes Acompanhados}}{\text{Docentes Previstos (Ativos - Dispensados)}} \times 100$ | **100%** | 🟢 $\ge 100\%$<br/>🟡 $90\% \text{ a } 99.9\%$<br/>🔴 $< 90\%$ |
| **SLI-02: Fila de Pendências** | Contagem de docentes com status `Pendente` na competência | **0 no fechamento** | 🔴 Alerta crítico nos últimos 7 dias do mês se houver pendências ativas |
| **SLA-01: Prazo de Devolutiva** | $\frac{\text{Devolutivas Realizadas em até 5 dias}}{\text{Total de Devolutivas Realizadas}} \times 100$ | $\ge \mathbf{95\%}$ | 🟢 $\ge 95\%$<br/>🟡 $85\% \text{ a } 94.9\%$<br/>🔴 $< 85\%$ |
| **SLI-03: Planos de Ação no Prazo** | $\frac{\text{Planos de Ação Concluídos no Prazo}}{\text{Total de Planos Concluídos}} \times 100$ | $\ge \mathbf{90\%}$ | 🟢 $\ge 90\%$<br/>🟡 $80\% \text{ a } 89.9\%$<br/>🔴 Alerta diário para planos vencendo em $\le 3$ dias |

---

## 4. Governança e Regras de Segurança

1. **Controle de Acesso Rígido (LGPD e Confidencialidade):**
   * Por conter apontamentos pedagógicos individuais e feedbacks profissionais confidenciais, este módulo e a coleção `teacherMonitoringRecords` são acessíveis **exclusivamente pelo e-mail autorizado da coordenação**: `viniciusladeialara@gmail.com`.
   * Outros perfis (`ADMIN` geral, `USER`, `PROFESSOR`, `PARTNER_SCHOOL`) não visualizam a rota, não têm acesso ao item de navegação no menu e são bloqueados em nível de banco de dados pelas regras do [firestore.rules](file:///c:/Users/VINICIUS/Documents/GitHub/macro-micro-schedule/firestore.rules).
2. **Auditoria e Rastreabilidade:**
   * Todas as criações, edições, devoluções, dispensa e conclusão de planos gravam carimbos de data/hora (`updatedAt`, `createdAt`) no Firestore.
