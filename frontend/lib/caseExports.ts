import type { Case } from '@/types';

const csvColumns = [
  ['Case title', 'case_title'],
  ['Case number', 'case_number'],
  ['Court', 'court_name'],
  ['Status', 'status'],
  ['Next hearing date', 'next_hearing_date'],
] as const;

function csvCell(value: string): string {
  // Keep user-entered text from being interpreted as a spreadsheet formula.
  const safe = /^[\t\r\n]|^\s*[=+\-@＝＋－＠]/u.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function casesCsv(cases: Case[]): string {
  const rows = [
    csvColumns.map(([label]) => label),
    ...cases.map(caseItem => csvColumns.map(([, key]) => caseItem[key] ?? '')),
  ];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

function calendarText(value: string): string {
  return value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n')
    .replaceAll(';', '\\;').replaceAll(',', '\\,')
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
}

function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  let bytes = 0;
  let folded = '';
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      folded += '\r\n ';
      bytes = 1;
    }
    folded += character;
    bytes += size;
  }
  return folded;
}

type ScheduledCase = Pick<Case, 'id' | 'case_title' | 'case_number' | 'court_name'> & {
  next_hearing_date: string;
};

export function hearingCalendar(caseItem: ScheduledCase, now = new Date()): string {
  const start = caseItem.next_hearing_date;
  const end = new Date(start + 'T00:00:00Z');
  end.setUTCDate(end.getUTCDate() + 1);
  const stamp = now.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LawPro//Case Hearings//EN',
    'BEGIN:VEVENT',
    `UID:case-${caseItem.id}-${start}@lawpro-five.vercel.app`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start.replaceAll('-', '')}`,
    `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replaceAll('-', '')}`,
    `SUMMARY:Hearing - ${calendarText(caseItem.case_title)}`,
  ];
  if (caseItem.court_name) lines.push(`LOCATION:${calendarText(caseItem.court_name)}`);
  if (caseItem.case_number) lines.push(`DESCRIPTION:Case number: ${calendarText(caseItem.case_number)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}

export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
