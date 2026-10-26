import { useEffect, useState } from 'react';
import type { UniqueWorker, DayConfig, WorkerDaySummary } from '../../types';
import { getTurnoOnDate } from '../../utils/dateUtils';
import { API_BASE } from '../../constants';

interface WorkerCalendarModalProps {
  worker: UniqueWorker;
  monthYear: string; // "YYYY-MM"
  onClose: () => void;
  shiftTemplates: Record<string, DayConfig[]>;
}

export function WorkerCalendarModal({ worker, monthYear, onClose, shiftTemplates }: WorkerCalendarModalProps) {
  const [dailyStatus, setDailyStatus] = useState<Record<string, 'verde' | 'amarillo' | 'rojo' | 'gris'>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchMonthData = async () => {
      setLoading(true);
      try {
        const [yearStr, monthStr] = monthYear.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const daysInMonth = new Date(year, month, 0).getDate();

        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yYyyy = yesterday.getFullYear();
        const yMm = String(yesterday.getMonth() + 1).padStart(2, '0');
        const yDd = String(yesterday.getDate()).padStart(2, '0');
        const yesterdayStr = `${yYyyy}-${yMm}-${yDd}`;

        const statusMap: Record<string, 'verde' | 'amarillo' | 'rojo' | 'gris'> = {};

        for (let d = 1; d <= daysInMonth; d++) {
          const dStr = String(d).padStart(2, '0');
          const dateStr = `${monthYear}-${dStr}`;
          const dayIndex = (d - 1) % 31;

          const currentTurno = getTurnoOnDate(worker.defaultTurno, worker.rules, dateStr);
          const template = shiftTemplates[currentTurno];
          const isRestDay = template && Array.isArray(template) && template[dayIndex] && String(template[dayIndex].hours).toLowerCase() === 'p';

          if (dateStr > yesterdayStr || isRestDay) {
            statusMap[dateStr] = 'gris';
            continue;
          }

          // Consultar asistencia para este día y este trabajador
          try {
            const res = await fetch(`${API_BASE}/api/attendance?date=${dateStr}`);
            const summaries: WorkerDaySummary[] = await res.json();
            const wSummary = summaries.find(s => s.no === worker.no || s.nombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase());

            if (!wSummary) {
              statusMap[dateStr] = 'rojo';
            } else {
              const marks = [
                wSummary.marca1,
                wSummary.marca2,
                wSummary.entradaMañana,
                wSummary.salidaMañana,
                wSummary.entradaTarde,
                wSummary.salidaTarde
              ].filter(Boolean);

              if (marks.length >= 2) {
                statusMap[dateStr] = 'verde';
              } else if (marks.length === 1) {
                statusMap[dateStr] = 'amarillo';
              } else {
                statusMap[dateStr] = 'rojo';
              }
            }
          } catch (err) {
            statusMap[dateStr] = 'gris';
          }
        }

        setDailyStatus(statusMap);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchMonthData();
  }, [worker, monthYear, shiftTemplates]);

  const [yearStr, monthStr] = monthYear.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Domingo

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Calendario de Asistencia: {worker.nombre}</h2>
            <p className="text-xs text-slate-300">No. {worker.no || 'N/A'} • {monthNames[month - 1]} {year}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl font-bold px-2 py-1 rounded-lg hover:bg-slate-800 transition"
          >
            &times;
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex flex-wrap gap-4 mb-6 text-xs font-bold justify-center bg-slate-100 p-4 rounded-xl border border-slate-300 text-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-emerald-600 inline-block shadow-sm"></span>
              <span className="text-slate-900 font-extrabold">Asistencia Completa (Verde)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-amber-500 inline-block shadow-sm"></span>
              <span className="text-slate-900 font-extrabold">Una Sola Marca (Amarillo)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-rose-600 inline-block shadow-sm"></span>
              <span className="text-slate-900 font-extrabold">Ausente (Rojo)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-slate-400 inline-block shadow-sm"></span>
              <span className="text-slate-900 font-extrabold">Descanso / Futuro (Gris)</span>
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
                  <div key={`empty-${i}`} className="h-20 bg-slate-50 rounded-xl border border-dashed border-slate-200 opacity-40"></div>
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dStr = String(dayNum).padStart(2, '0');
                  const dateStr = `${monthYear}-${dStr}`;
                  const status = dailyStatus[dateStr] || 'gris';

                  let bgClass = 'bg-slate-100 text-slate-500 border-slate-200';
                  if (status === 'verde') bgClass = 'bg-emerald-500 text-white border-emerald-600 shadow-sm';
                  else if (status === 'amarillo') bgClass = 'bg-amber-400 text-slate-900 border-amber-500 shadow-sm';
                  else if (status === 'rojo') bgClass = 'bg-rose-500 text-white border-rose-600 shadow-sm';

                  return (
                    <div
                      key={dateStr}
                      className={`h-24 rounded-xl border p-2 flex flex-col justify-between transition transform hover:scale-[1.02] ${bgClass}`}
                    >
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span>{dayNum}</span>
                        <span className="text-[10px] opacity-80">{dStr}/{monthStr}</span>
                      </div>
                      <div className="text-center text-[11px] font-medium uppercase tracking-tight">
                        {status === 'verde' && 'Presente'}
                        {status === 'amarillo' && '1 Marca'}
                        {status === 'rojo' && 'Ausente'}
                        {status === 'gris' && 'Libre/Futuro'}
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
