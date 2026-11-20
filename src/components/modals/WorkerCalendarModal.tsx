import { useEffect, useState } from 'react';
import type { UniqueWorker } from '../../types';
import { apiFetch } from '../../utils/api';
import { VisualMonthPicker } from '../VisualMonthPicker';

interface DayInfo {
  status: 'verde' | 'amarillo' | 'rojo' | 'gris' | 'fuera_de_turno';
  turno: string;
  expectedHours: number;
  times: string[];
  workedHours: number;
  overtimeHours: number;
}

interface WorkerCalendarModalProps {
  worker: UniqueWorker;
  monthYear: string; // "YYYY-MM"
  onClose: () => void;
  shiftTemplates?: any;
}

export function WorkerCalendarModal({ worker, monthYear, onClose }: WorkerCalendarModalProps) {
  const [currentMonthYear, setCurrentMonthYear] = useState<string>(monthYear || new Date().toISOString().substring(0, 7));
  const [dailyStatus, setDailyStatus] = useState<Record<string, DayInfo>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (monthYear) {
      setCurrentMonthYear(monthYear);
    }
  }, [monthYear]);

  useEffect(() => {
    const fetchCalendarData = async () => {
      if (!worker || !currentMonthYear) return;
      setLoading(true);
      try {
        const res = await apiFetch(`/api/workers/calendar?workerNo=${worker.no}&monthYear=${currentMonthYear}`);
        const data = await res.json();
        setDailyStatus(data || {});
      } catch (e) {
        console.error(e);
        setDailyStatus({});
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [worker, currentMonthYear]);

  const [yearStr, monthStr] = (currentMonthYear || '2026-10').split('-');
  const year = parseInt(yearStr, 10) || 2026;
  const month = parseInt(monthStr, 10) || 10;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Domingo

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Calendario Detallado de Asistencia: {worker.nombre}</h2>
            <p className="text-xs text-slate-300">No. {worker.no || 'N/A'} • {monthNames[month - 1]} {year}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded-lg hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Controls: Month Picker & Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-slate-100 p-4 rounded-xl border border-slate-300">
            <div className="w-[245px]">
              <VisualMonthPicker
                label="Cambiar Mes:"
                value={currentMonthYear}
                onChange={setCurrentMonthYear}
              />
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-bold items-center text-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 inline-block"></span>
                <span>Presente (Vino)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-500 inline-block"></span>
                <span>1 Marca</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-rose-600 inline-block"></span>
                <span>Ausente (Faltó)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-purple-600 inline-block"></span>
                <span>Fuera Turno</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-slate-400 inline-block"></span>
                <span>Libre / Futuro</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 font-medium">Cargando calendario mensual...</div>
          ) : (
            <div>
              <div className="grid grid-cols-7 gap-2 mb-2 text-center font-bold text-xs text-slate-600">
                <div>Dom</div>
                <div>Lun</div>
                <div>Mar</div>
                <div>Mié</div>
                <div>Jue</div>
                <div>Vie</div>
                <div>Sáb</div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-24 bg-slate-50 rounded-xl border border-dashed border-slate-200 opacity-40"></div>
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dStr = String(dayNum).padStart(2, '0');
                  const dateStr = `${currentMonthYear}-${dStr}`;
                  const dayInfo = dailyStatus[dateStr] || { status: 'gris', turno: '', expectedHours: 8, times: [], workedHours: 0, overtimeHours: 0 };
                  const status = dayInfo.status;

                  let bgClass = 'bg-slate-100 text-slate-500 border-slate-200';
                  if (status === 'verde') bgClass = 'bg-emerald-500 text-white border-emerald-600 shadow-sm';
                  else if (status === 'amarillo') bgClass = 'bg-amber-400 text-slate-900 border-amber-500 shadow-sm';
                  else if (status === 'rojo') bgClass = 'bg-rose-500 text-white border-rose-600 shadow-sm';
                  else if (status === 'fuera_de_turno') bgClass = 'bg-purple-600 text-white border-purple-700 shadow-sm';

                  return (
                    <div
                      key={dateStr}
                      className={`h-28 rounded-xl border p-2 flex flex-col justify-between transition transform hover:scale-[1.02] ${bgClass}`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span>{dayNum}</span>
                        <span className="text-[10px] opacity-90">{dStr}/{monthStr}</span>
                      </div>

                      <div className="text-center space-y-0.5">
                        <div className="text-[11px] font-extrabold uppercase tracking-tight">
                          {status === 'verde' && '✓ Presente'}
                          {status === 'amarillo' && '⚠ 1 Marca'}
                          {status === 'rojo' && '✗ Ausente'}
                          {status === 'gris' && '• Libre'}
                          {status === 'fuera_de_turno' && '⚡ Fuera Turno'}
                        </div>

                        {/* Punch times */}
                        {dayInfo.times && dayInfo.times.length > 0 ? (
                          <div className="text-[10px] font-mono opacity-95 bg-black/10 rounded px-1 py-0.5 truncate" title={dayInfo.times.join(' - ')}>
                            {dayInfo.times.length === 1 ? dayInfo.times[0] : `${dayInfo.times[0]} → ${dayInfo.times[dayInfo.times.length - 1]}`}
                          </div>
                        ) : (
                          <div className="text-[10px] opacity-60 italic">Sin marcas</div>
                        )}

                        {/* Overtime */}
                        {dayInfo.overtimeHours > 0 && (
                          <div className="text-[10px] font-bold text-amber-200 bg-amber-900/40 rounded px-1">
                            +{dayInfo.overtimeHours}h Extra
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-100 px-6 py-4 flex justify-end border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
