import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { differenceInDays, parseISO, isAfter, isBefore, addDays, endOfMonth } from "date-fns";

export type MonitoringStatus = "pendente" | "em_andamento" | "concluido" | "dispensado";
export type TeacherVinculo = "quadro" | "extraquadro";
export type MSEPCompliance = "total" | "parcial" | "adequando";

export interface ActionPlanItem {
  id: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  status: "pendente" | "concluido";
  completedAt?: string;
}

export interface TeacherMonitoringRecord {
  id?: string;
  teacherId: string;
  teacherName: string;
  teacherEmail?: string;
  unitId: string;
  competence: string; // "YYYY-MM"
  vinculo: TeacherVinculo;
  area: string;
  status: MonitoringStatus;

  // Aspectos Pedagógicos (Metodologia SENAI MSEP)
  observationDate?: string; // YYYY-MM-DD
  observerName?: string;
  curricularUnit?: string;
  roomName?: string;
  pedagogicalAspects?: string;
  strengths?: string;
  improvements?: string;
  msepCompliance?: MSEPCompliance;

  // Devolutiva (Feedback & SLA)
  feedbackDate?: string; // YYYY-MM-DD
  feedbackSent: boolean;
  feedbackDeadline?: string; // YYYY-MM-DD
  feedbackChannel?: string; // Presencial, Teams, E-mail, Reunião Pedagógica
  feedbackNotes?: string;

  // Planos de Ação
  actionPlans?: ActionPlanItem[];

  // Justificativa de Dispensa
  waiverReason?: string;

  createdAt?: any;
  updatedAt?: any;
}

export interface SLIMetrics {
  // SLI-01: Cobertura Mensal
  coveragePercent: number;
  totalExpected: number;
  totalMonitored: number;
  coverageStatus: "green" | "yellow" | "red";

  // SLI-02: Fila de Pendências
  pendingCount: number;
  pendingIsCritical: boolean;

  // SLA-01: Prazo de Devolutiva
  feedbackSlaPercent: number;
  feedbackSlaStatus: "green" | "yellow" | "red";
  totalFeedbacksSent: number;
  onTimeFeedbacks: number;

  // SLI-03: Planos de Ação no Prazo
  actionPlansOnTimePercent: number;
  actionPlansStatus: "green" | "yellow" | "red";
  totalActionPlans: number;
  onTimeActionPlans: number;
  pendingActionPlans: number;
}

export interface OperationalAlert {
  id: string;
  type: "critical" | "warning" | "info";
  teacherId?: string;
  teacherName?: string;
  title: string;
  description: string;
  badgeText: string;
  actionType?: "observation" | "feedback" | "action_plan";
}

const COLLECTION_NAME = "teacher_monitoring";

export const teacherMonitoringService = {
  /**
   * Assina em tempo real todos os registros de monitoramento para a unidade
   */
  subscribeToMonitoring(
    unitId: string,
    callback: (records: TeacherMonitoringRecord[]) => void
  ) {
    const q = query(collection(db, COLLECTION_NAME), where("unitId", "==", unitId));
    return onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as TeacherMonitoringRecord[];
        callback(records);
      },
      (error) => {
        console.error("Erro ao assinar registros de acompanhamento:", error);
        callback([]);
      }
    );
  },

  /**
   * Salva ou atualiza um registro de acompanhamento docente
   */
  async saveRecord(record: Partial<TeacherMonitoringRecord>, recordId?: string) {
    if (recordId) {
      const docRef = doc(db, COLLECTION_NAME, recordId);
      await updateDoc(docRef, {
        ...record,
        updatedAt: serverTimestamp(),
      });
      return recordId;
    } else {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    }
  },

  /**
   * Registra a devolutiva (feedback) realizada para o docente
   */
  async registerFeedback(
    recordId: string,
    data: {
      feedbackDate: string;
      feedbackChannel: string;
      feedbackNotes?: string;
    }
  ) {
    const docRef = doc(db, COLLECTION_NAME, recordId);
    await updateDoc(docRef, {
      feedbackSent: true,
      feedbackDate: data.feedbackDate,
      feedbackChannel: data.feedbackChannel,
      feedbackNotes: data.feedbackNotes || "",
      status: "concluido",
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Registra a dispensa justificada para o mês corrente
   */
  async waiveMonitoring(recordId: string, waiverReason: string) {
    const docRef = doc(db, COLLECTION_NAME, recordId);
    await updateDoc(docRef, {
      status: "dispensado",
      waiverReason,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Cria registro inicial de dispensa se ainda não existia registro
   */
  async createWaiver(
    baseRecord: Omit<TeacherMonitoringRecord, "id" | "createdAt" | "updatedAt">
  ) {
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...baseRecord,
      status: "dispensado",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Atualiza os itens de plano de ação
   */
  async updateActionPlans(recordId: string, actionPlans: ActionPlanItem[]) {
    const docRef = doc(db, COLLECTION_NAME, recordId);
    await updateDoc(docRef, {
      actionPlans,
      updatedAt: serverTimestamp(),
    });
  },

  /**
   * Deleta um registro
   */
  async deleteRecord(recordId: string) {
    const docRef = doc(db, COLLECTION_NAME, recordId);
    await deleteDoc(docRef);
  },

  /**
   * Calcula indicadores SLI e gera alertas operacionais conforme o PRD
   */
  calculateMetricsAndAlerts(
    teachers: any[],
    monitoringRecords: TeacherMonitoringRecord[],
    competence: string,
    allHistoricalRecords: TeacherMonitoringRecord[] = []
  ): { metrics: SLIMetrics; alerts: OperationalAlert[] } {
    const today = new Date();
    const currentMonthEnd = endOfMonth(today);
    const daysUntilEndOfMonth = differenceInDays(currentMonthEnd, today);
    const isLast7Days = daysUntilEndOfMonth <= 7 && daysUntilEndOfMonth >= 0;

    // Registros da competência selecionada
    const compRecords = monitoringRecords.filter((r) => r.competence === competence);
    const recordMapByTeacher = new Map<string, TeacherMonitoringRecord>();
    compRecords.forEach((r) => recordMapByTeacher.set(r.teacherId, r));

    // Docentes previstos: docentes ativos que não foram dispensados
    const activeTeachers = teachers.filter((t) => t.isActive !== false);
    
    let totalExpected = 0;
    let totalMonitored = 0;
    let pendingCount = 0;
    const alerts: OperationalAlert[] = [];

    activeTeachers.forEach((t) => {
      const record = recordMapByTeacher.get(t.id);
      const isDispensado = record?.status === "dispensado";

      if (!isDispensado) {
        totalExpected++;
        if (record && (record.status === "concluido" || record.status === "em_andamento")) {
          totalMonitored++;
        } else {
          pendingCount++;
        }
      }
    });

    // SLI-01: Cobertura Mensal = DIVIDE([Docentes Acompanhados], [Docentes Previstos], 0)
    const coveragePercent =
      totalExpected > 0 ? Math.round((totalMonitored / totalExpected) * 100) : 100;

    let coverageStatus: "green" | "yellow" | "red" = "red";
    if (coveragePercent === 100) {
      coverageStatus = "green";
    } else if (coveragePercent >= 90) {
      coverageStatus = "yellow";
    }

    // SLI-02: Fila de Pendências
    const pendingIsCritical = isLast7Days && pendingCount > 0;
    if (pendingIsCritical) {
      alerts.push({
        id: "alert-critical-month-end",
        type: "critical",
        title: "Fechamento Mensal em Risco",
        description: `Faltam ${daysUntilEndOfMonth} dias para o encerramento do mês e ainda restam ${pendingCount} docentes com acompanhamento pendente.`,
        badgeText: "ALERTA CRÍTICO",
      });
    }

    // SLA-01: Prazo de Devolutiva = DIVIDE([Devolutivas no Prazo], [Total Enviadas], 0)
    let totalFeedbacksSent = 0;
    let onTimeFeedbacks = 0;

    compRecords.forEach((r) => {
      if (r.feedbackSent && r.feedbackDate) {
        totalFeedbacksSent++;
        if (r.feedbackDeadline) {
          const sentDate = parseISO(r.feedbackDate);
          const deadline = parseISO(r.feedbackDeadline);
          if (isBefore(sentDate, deadline) || r.feedbackDate === r.feedbackDeadline) {
            onTimeFeedbacks++;
          }
        } else {
          onTimeFeedbacks++;
        }
      } else if (r.status === "em_andamento" && r.observationDate) {
        // Acompanhamento feito mas devolutiva ainda não enviada
        const obsDate = parseISO(r.observationDate);
        const daysSinceObs = differenceInDays(today, obsDate);
        const deadline = r.feedbackDeadline
          ? parseISO(r.feedbackDeadline)
          : addDays(obsDate, 5);

        if (isAfter(today, deadline)) {
          alerts.push({
            id: `alert-overdue-feedback-${r.teacherId}`,
            type: "critical",
            teacherId: r.teacherId,
            teacherName: r.teacherName,
            title: `Devolutiva Atrasada: ${r.teacherName}`,
            description: `Observação realizada há ${daysSinceObs} dias e o prazo de envio da devolutiva expirou.`,
            badgeText: "SLA EXPIRADO",
            actionType: "feedback",
          });
        } else {
          const daysToDeadline = differenceInDays(deadline, today);
          if (daysToDeadline <= 2) {
            alerts.push({
              id: `alert-feedback-near-${r.teacherId}`,
              type: "warning",
              teacherId: r.teacherId,
              teacherName: r.teacherName,
              title: `Devolutiva Próxima do Prazo: ${r.teacherName}`,
              description: `Prazo para envio da devolutiva encerra em ${daysToDeadline === 0 ? "hoje" : `${daysToDeadline} dias`}.`,
              badgeText: "ATENÇÃO",
              actionType: "feedback",
            });
          }
        }
      }
    });

    const feedbackSlaPercent =
      totalFeedbacksSent > 0 ? Math.round((onTimeFeedbacks / totalFeedbacksSent) * 100) : 100;

    let feedbackSlaStatus: "green" | "yellow" | "red" = "red";
    if (feedbackSlaPercent >= 95) {
      feedbackSlaStatus = "green";
    } else if (feedbackSlaPercent >= 85) {
      feedbackSlaStatus = "yellow";
    }

    // SLI-03: Planos de Ação no Prazo = DIVIDE([Concluídos no Prazo], [Total Concluídos], 0)
    let totalActionPlans = 0;
    let onTimeActionPlans = 0;
    let pendingActionPlans = 0;

    const recordsToScanPlans = compRecords;

    recordsToScanPlans.forEach((r) => {
      if (r.actionPlans && r.actionPlans.length > 0) {
        r.actionPlans.forEach((plan) => {
          totalActionPlans++;
          if (plan.status === "concluido") {
            if (plan.completedAt && plan.dueDate) {
              if (
                isBefore(parseISO(plan.completedAt), parseISO(plan.dueDate)) ||
                plan.completedAt === plan.dueDate
              ) {
                onTimeActionPlans++;
              }
            } else {
              onTimeActionPlans++;
            }
          } else {
            pendingActionPlans++;
            if (plan.dueDate) {
              const due = parseISO(plan.dueDate);
              const daysToDue = differenceInDays(due, today);
              if (isBefore(due, today)) {
                alerts.push({
                  id: `alert-plan-overdue-${plan.id}`,
                  type: "critical",
                  teacherId: r.teacherId,
                  teacherName: r.teacherName,
                  title: `Plano de Ação Vencido: ${r.teacherName}`,
                  description: `Ação "${plan.description}" venceu em ${plan.dueDate}.`,
                  badgeText: "VENCIDO",
                  actionType: "action_plan",
                });
              } else if (daysToDue <= 3) {
                alerts.push({
                  id: `alert-plan-near-${plan.id}`,
                  type: "warning",
                  teacherId: r.teacherId,
                  teacherName: r.teacherName,
                  title: `Plano de Ação Vence em Breve: ${r.teacherName}`,
                  description: `Ação "${plan.description}" vence em ${daysToDue === 0 ? "hoje" : `${daysToDue} dias`}.`,
                  badgeText: "ATENÇÃO",
                  actionType: "action_plan",
                });
              }
            }
          }
        });
      }
    });

    const actionPlansOnTimePercent =
      totalActionPlans > 0
        ? Math.round(
            (onTimeActionPlans /
              (totalActionPlans - pendingActionPlans || (totalActionPlans > 0 ? totalActionPlans : 1))) *
              100
          )
        : 100;

    let actionPlansStatus: "green" | "yellow" | "red" = "red";
    if (actionPlansOnTimePercent >= 90) {
      actionPlansStatus = "green";
    } else if (actionPlansOnTimePercent >= 75) {
      actionPlansStatus = "yellow";
    }

    // Alerta de docentes sem acompanhamento há mais de 30 dias
    activeTeachers.forEach((t) => {
      const teacherAllRecords = allHistoricalRecords
        .filter((r) => r.teacherId === t.id && r.observationDate)
        .sort((a, b) => (b.observationDate || "").localeCompare(a.observationDate || ""));

      const latestObservation = teacherAllRecords[0];
      if (latestObservation?.observationDate) {
        const obsDate = parseISO(latestObservation.observationDate);
        const daysSinceLast = differenceInDays(today, obsDate);
        if (daysSinceLast > 30) {
          alerts.push({
            id: `alert-gap-${t.id}`,
            type: "warning",
            teacherId: t.id,
            teacherName: t.name,
            title: `Sem Acompanhamento Recente: ${t.name}`,
            description: `${daysSinceLast} dias sem acompanhamento pedagógico registrado.`,
            badgeText: `${daysSinceLast} DIAS`,
            actionType: "observation",
          });
        }
      }
    });

    return {
      metrics: {
        coveragePercent,
        totalExpected,
        totalMonitored,
        coverageStatus,
        pendingCount,
        pendingIsCritical,
        feedbackSlaPercent,
        feedbackSlaStatus,
        totalFeedbacksSent,
        onTimeFeedbacks,
        actionPlansOnTimePercent,
        actionPlansStatus,
        totalActionPlans,
        onTimeActionPlans,
        pendingActionPlans,
      },
      alerts,
    };
  },
};
