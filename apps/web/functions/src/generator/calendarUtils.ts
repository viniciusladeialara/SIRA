import { db } from "../db.js";

/**
 * Verifica se uma data é feriado consultando a coleção 'holidays'
 */
export async function isHoliday(date: Date): Promise<boolean> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const holidaysSnap = await db.collection("holidays")
    .where("date", ">=", startOfDay)
    .where("date", "<=", endOfDay)
    .get();

  return !holidaysSnap.empty;
}

/**
 * Verifica se uma data é final de semana (Sábado ou Domingo)
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Domingo, 6 = Sábado
}

/**
 * Retorna a próxima data útil (pula fins de semana e feriados)
 */
export async function getNextWorkDay(currentDate: Date): Promise<Date> {
  let nextDate = new Date(currentDate);
  nextDate.setDate(nextDate.getDate() + 1);

  while (isWeekend(nextDate) || await isHoliday(nextDate)) {
    nextDate.setDate(nextDate.getDate() + 1);
  }

  return nextDate;
}

/**
 * Gera uma lista de N dias úteis a partir de uma data de início
 */
export async function generateWorkDays(startDate: Date, daysNeeded: number): Promise<Date[]> {
  const workDays: Date[] = [];
  let current = new Date(startDate);

  // Se a data de início já for fim de semana ou feriado, busca o primeiro útil
  if (isWeekend(current) || await isHoliday(current)) {
    current = await getNextWorkDay(current);
  }

  while (workDays.length < daysNeeded) {
    workDays.push(new Date(current));
    current = await getNextWorkDay(current);
  }

  return workDays;
}
