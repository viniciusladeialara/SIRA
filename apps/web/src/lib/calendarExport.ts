/**
 * @file calendarExport.ts
 * @description Utilitário de interoperabilidade para exportação de agendamentos
 * para o Google Calendar e geração de arquivos no formato padrão iCalendar (.ics - RFC 5545).
 */

export interface CalendarEventItem {
  id: string;
  className?: string;
  roomName?: string;
  teacherName?: string;
  courseName?: string;
  startTime: Date | { toDate: () => Date };
  endTime: Date | { toDate: () => Date };
  observation?: string;
  block?: string;
}

/**
 * Converte data para formato iCal UTC: YYYYMMDDTHHMMSSZ
 */
function toIcsDateUtc(dateInput: Date | { toDate: () => Date }): string {
  const date = dateInput instanceof Date ? dateInput : dateInput.toDate();
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Gera URL direta para adicionar o evento ao Google Calendar com 1 clique
 */
export function generateGoogleCalendarUrl(event: CalendarEventItem): string {
  const startDate = event.startTime instanceof Date ? event.startTime : event.startTime.toDate();
  const endDate = event.endTime instanceof Date ? event.endTime : event.endTime.toDate();

  const title = event.className && event.className !== 'direct_booking'
    ? `${event.className} - ${event.roomName || 'Sala de Aula'}`
    : `Reserva: ${event.roomName || 'Ambiente'}`;

  const detailsParts: string[] = [];
  if (event.teacherName && event.teacherName !== 'direct_booking') {
    detailsParts.push(`Docente: ${event.teacherName}`);
  }
  if (event.className && event.className !== 'direct_booking') {
    detailsParts.push(`Turma: ${event.className}`);
  }
  if (event.courseName) {
    detailsParts.push(`Curso: ${event.courseName}`);
  }
  if (event.observation) {
    detailsParts.push(`Observações: ${event.observation}`);
  }
  detailsParts.push('Gerado via Macro Micro Schedule SENAI');

  const location = [event.roomName, event.block ? `Bloco ${event.block}` : ''].filter(Boolean).join(' - ');

  const datesParam = `${toIcsDateUtc(startDate)}/${toIcsDateUtc(endDate)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: datesParam,
    details: detailsParts.join('\n'),
    location: location || 'SENAI',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Gera o conteúdo no formato iCalendar (.ics RFC 5545) para um ou mais eventos
 */
export function generateIcsContent(events: CalendarEventItem[], calendarTitle = 'Horários SENAI'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Macro Micro Schedule//SENAI MT//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarTitle}`,
    'X-WR-TIMEZONE:America/Cuiaba',
  ];

  const nowIcs = toIcsDateUtc(new Date());

  events.forEach((event) => {
    const startDate = event.startTime instanceof Date ? event.startTime : event.startTime.toDate();
    const endDate = event.endTime instanceof Date ? event.endTime : event.endTime.toDate();

    const title = event.className && event.className !== 'direct_booking'
      ? `${event.className} - ${event.roomName || 'Sala'}`
      : `Reserva: ${event.roomName || 'Ambiente'}`;

    const location = [event.roomName, event.block ? `Bloco ${event.block}` : ''].filter(Boolean).join(' - ');

    const description = [
      event.teacherName && event.teacherName !== 'direct_booking' ? `Docente: ${event.teacherName}` : '',
      event.className && event.className !== 'direct_booking' ? `Turma: ${event.className}` : '',
      event.courseName ? `Curso: ${event.courseName}` : '',
      event.observation ? `Observação: ${event.observation}` : '',
    ].filter(Boolean).join(' \\n ');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id || Math.random().toString(36).substring(2)}@macromicro.senai.br`,
      `DTSTAMP:${nowIcs}`,
      `DTSTART:${toIcsDateUtc(startDate)}`,
      `DTEND:${toIcsDateUtc(endDate)}`,
      `SUMMARY:${title.replace(/[,;]/g, ' ')}`,
      `DESCRIPTION:${description.replace(/[,;]/g, ' ')}`,
      `LOCATION:${(location || 'SENAI').replace(/[,;]/g, ' ')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Dispara o download de um arquivo .ics no navegador do usuário
 */
export function downloadIcsFile(events: CalendarEventItem[], filename = 'grade_horarios.ics', calendarTitle = 'Horários SENAI') {
  if (!events || events.length === 0) return;

  const icsString = generateIcsContent(events, calendarTitle);
  const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
