import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Formata uma data para exibição sempre no fuso horário de Cuiabá (UTC-4), 
 * independente do fuso horário local do navegador do usuário.
 * 
 * Isso resolve o problema de professores em fusos diferentes (ex: Brasília) 
 * vendo horários deslocados em +1 hora.
 */
export function formatInTimeZone(date: Date | number, pattern: string = "HH:mm"): string {
  const d = typeof date === "number" ? new Date(date) : date;
  
  // Opções para o Intl.DateTimeFormat em Cuiabá
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Cuiaba',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  };

  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(d);
  
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";
  
  // Criar um objeto de data fictício que representa a hora em Cuiabá como se fosse local
  // Isso nos permite continuar usando o `format` do date-fns com todos os seus padrões (EEE, dd, etc)
  const year = parseInt(getPart('year'));
  const month = parseInt(getPart('month')) - 1;
  const day = parseInt(getPart('day'));
  const hour = parseInt(getPart('hour'));
  const minute = parseInt(getPart('minute'));
  const second = parseInt(getPart('second'));
  
  const tzDate = new Date(year, month, day, hour, minute, second);
  
  return format(tzDate, pattern, { locale: ptBR });
}

/**
 * Obtém a hora (0-23) de uma data no fuso de Cuiabá.
 */
export function getHoursInTimeZone(date: Date): number {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Cuiaba',
    hour: '2-digit',
    hourCycle: 'h23',
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  return parseInt(formatter.format(date));
}

/**
 * Converte com segurança qualquer formato de data (Date, Timestamp Firestore/SIRA,
 * objeto serializado { seconds, nanoseconds }, string ISO, milissegundos) para uma instância válida de Date.
 */
export function toSafeDate(d: any): Date {
  if (!d) return new Date();
  if (typeof d?.toDate === 'function') {
    try {
      const res = d.toDate();
      if (res instanceof Date && !isNaN(res.getTime())) return res;
    } catch {
      // fallback
    }
  }
  if (d instanceof Date) return isNaN(d.getTime()) ? new Date() : d;
  if (typeof d?.seconds === 'number') {
    return new Date(d.seconds * 1000 + (d.nanoseconds || 0) / 1e6);
  }
  if (typeof d === 'string' || typeof d === 'number') {
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/**
 * Converte com segurança para milissegundos desde o epoch.
 */
export function toSafeMillis(d: any): number {
  if (!d) return 0;
  if (typeof d?.toMillis === 'function') {
    try {
      return d.toMillis();
    } catch {
      // fallback
    }
  }
  return toSafeDate(d).getTime();
}

