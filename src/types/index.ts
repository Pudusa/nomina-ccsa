export interface WorkerDaySummary {
  no: string;
  nombre: string;
  marca1: string | null;
  marca2: string | null;
  entradaMañana?: string | null;
  salidaMañana?: string | null;
  entradaTarde?: string | null;
  salidaTarde?: string | null;
  turno: string;
  isRest?: boolean;
}

export interface ShiftRule {
  id: number;
  type: 'total' | 'parcial';
  turno: string;
  start_date: string;
  end_date?: string;
}

export interface UniqueWorker {
  no: string;
  nombre: string;
  defaultTurno: string;
  rules: ShiftRule[];
}

export interface DayConfig {
  hours: number | string;
  markDirection: 'entrada' | 'salida';
}

export interface VisualDatePickerProps {
  label: string;
  value: string;
  onChange: (dateStr: string) => void;
  minDate?: string;
  availableDates?: string[];
}
