import type { ShiftRule } from '../types';

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getYesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(isoString: string | null): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

export function getTurnoOnDate(defaultTurno: string, rules: ShiftRule[] | undefined, dateStr: string): string {
  if (!rules || rules.length === 0) return defaultTurno;
  let resolved = defaultTurno;
  const sorted = [...rules].sort((a, b) => a.start_date.localeCompare(b.start_date));

  for (const rule of sorted) {
    if (rule.type === 'total') {
      if (dateStr >= rule.start_date) {
        resolved = rule.turno;
      }
    } else if (rule.type === 'parcial') {
      const end = rule.end_date || rule.start_date;
      if (dateStr >= rule.start_date && dateStr <= end) {
        resolved = rule.turno;
      }
    }
  }
  return resolved;
}

export const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
