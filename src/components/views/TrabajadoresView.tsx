import type { UniqueWorker, DayConfig, WorkerDaySummary } from '../../types';
import { getTurnoOnDate } from '../../utils/dateUtils';
import { useState, useEffect } from 'react';
import { API_BASE } from '../../constants';
import { WorkerCalendarModal } from '../modals/WorkerCalendarModal';

interface TrabajadoresViewProps {
  uniqueWorkers: UniqueWorker[];
  filteredWorkers: UniqueWorker[];
  paginatedWorkers: UniqueWorker[];
  workerSearchTerm: string;
  setWorkerSearchTerm: (term: string) => void;
  selectedTurno: string;
  setSelectedTurno: (turno: string) => void;
  selectedDate: string;
  availableTurnos: string[];
  workerCurrentPage: number;
  setWorkerCurrentPage: (p: number | ((prev: number) => number)) => void;
  workerTotalPages: number;
  onEditWorker: (worker: UniqueWorker, currentTurno: string) => void;
  onSort: (field: string) => void;
  workerMonthYear: string;
  setWorkerMonthYear: (m: string) => void;
  shiftTemplates: Record<string, DayConfig[]>;
}

export function TrabajadoresView({
  uniqueWorkers,
  filteredWorkers,
  paginatedWorkers,
  workerSearchTerm,
  setWorkerSearchTerm,
  selectedTurno,
  setSelectedTurno,
  selectedDate,
  availableTurnos,
  workerCurrentPage,
  setWorkerCurrentPage,
  workerTotalPages,
  onEditWorker,
  onSort,
  workerMonthYear,
  setWorkerMonthYear,
  shiftTemplates,
}: TrabajadoresViewProps) {
  const [workerStats, setWorkerStats] = useState<Record<string, { singleMarks: number; absences: number }>>({});
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [calendarWorker, setCalendarWorker] = useState<UniqueWorker | null>(null);

  // Calcular estadísticas mensuales (días 1 marca y ausencias) para todos los trabajadores filtrados o paginados en el mes seleccionado
  useEffect(() => {
    const fetchMonthlyStats = async () => {
      if (!workerMonthYear) return;
      setLoadingStats(true);
      try {
        const [yearStr, monthStr] = workerMonthYear.split('-');
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

        const statsMap: Record<string, { singleMarks: number; absences: number }> = {};

        // Recorrer días del mes hasta ayer (o fin de mes si el mes ya pasó)
        const dateStrs: string[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
          const dStr = String(d).padStart(2, '0');
          const dateStr = `${workerMonthYear}-${dStr}`;
          if (dateStr <= yesterdayStr) {
            dateStrs.push(dateStr);
          }
        }

        // Para cada fecha, obtener la asistencia
        const dailyDataCache: Record<string, WorkerDaySummary[]> = {};
        for (const dateStr of dateStrs) {
          try {
            const res = await fetch(`${API_BASE}/api/attendance?date=${dateStr}`);
            const summaries: WorkerDaySummary[] = await res.json();
            dailyDataCache[dateStr] = summaries;
          } catch (e) {
            dailyDataCache[dateStr] = [];
          }
        }

        // Evaluar por cada trabajador
        uniqueWorkers.forEach((worker) => {
          let singleMarks = 0;
          let absences = 0;

          dateStrs.forEach((dateStr, idx) => {
            const dayNum = idx + 1;
            const dayIndex = (dayNum - 1) % 31;
            const currentTurno = getTurnoOnDate(worker.defaultTurno, worker.rules, dateStr);
            const template = shiftTemplates[currentTurno];
            const isRestDay = template && Array.isArray(template) && template[dayIndex] && String(template[dayIndex].hours).toLowerCase() === 'p';

            if (isRestDay) return;

            const summaries = dailyDataCache[dateStr] || [];
            const wSummary = summaries.find(s => s.no === worker.no || s.nombre.trim().toLowerCase() === worker.nombre.trim().toLowerCase());

            if (!wSummary) {
              absences++;
            } else {
              const marks = [
                wSummary.marca1,
                wSummary.marca2,
                wSummary.entradaMañana,
                wSummary.salidaMañana,
                wSummary.entradaTarde,
                wSummary.salidaTarde
              ].filter(Boolean);

              if (marks.length === 1) {
                singleMarks++;
              } else if (marks.length === 0) {
                absences++;
              }
            }
          });

          statsMap[worker.nombre] = { singleMarks, absences };
        });

        setWorkerStats(statsMap);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchMonthlyStats();
  }, [workerMonthYear, uniqueWorkers, shiftTemplates]);

  return (
    <>
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Trabajadores</h3>
          <p className="metric-value">{uniqueWorkers.length}</p>
        </div>
        <div className="metric-card">
          <h3>Trabajadores Filtrados</h3>
          <p className="metric-value">{filteredWorkers.length}</p>
        </div>
      </div>

      <div className="controls-bar flex flex-wrap items-center justify-between gap-6 mb-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="search-box">
            <input
              type="text"
              placeholder="Buscar trabajador por Nombre o No..."
              value={workerSearchTerm}
              onChange={(e) => {
                setWorkerSearchTerm(e.target.value);
                setWorkerCurrentPage(1);
              }}
            />
          </div>

          <div className="filter-box">
            <label htmlFor="turno-select">🕒 Turno:</label>
            <select
              id="turno-select"
              value={selectedTurno}
              onChange={(e) => {
                setSelectedTurno(e.target.value);
                setWorkerCurrentPage(1);
              }}
            >
              <option value="ALL">Todos los Turnos</option>
              {availableTurnos.map((turno) => (
                <option key={turno} value={turno}>
                  {turno}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filter-box">
          <label htmlFor="worker-month-select">📅 Mes de Estadísticas:</label>
          <input
            id="worker-month-select"
            type="month"
            value={workerMonthYear}
            onChange={(e) => setWorkerMonthYear(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      <p className="hint-text">💡 Haz clic en cualquier trabajador para configurar reglas de turno, o usa el botón de calendario para ver su detalle mensual.</p>

      <div className="table-responsive">
        <table className="nomina-table">
          <thead>
            <tr>
              <th onClick={() => onSort('no')} className="cursor-pointer select-none hover:text-sky-400">No. ↕</th>
              <th onClick={() => onSort('nombre')} className="cursor-pointer select-none hover:text-sky-400">Nombre del Trabajador ↕</th>
              <th onClick={() => onSort('defaultTurno')} className="cursor-pointer select-none hover:text-sky-400">Turno Base ↕</th>
              <th className="text-center">Días 1 Marca</th>
              <th className="text-center">Días Ausentes</th>
              <th className="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedWorkers.length > 0 ? (
              paginatedWorkers.map((worker, idx) => {
                const currentTurno = selectedDate ? getTurnoOnDate(worker.defaultTurno, worker.rules, selectedDate) : worker.defaultTurno;
                const stats = workerStats[worker.nombre] || { singleMarks: 0, absences: 0 };

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td>{worker.no || '-'}</td>
                    <td
                      className="font-weight-bold cursor-pointer hover:text-sky-600"
                      onClick={() => onEditWorker(worker, currentTurno)}
                      title="Haz clic para configurar turno"
                    >
                      {worker.nombre}
                    </td>
                    <td>
                      <span className="badge-verif">{currentTurno}</span>
                    </td>
                    <td className="text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${stats.singleMarks > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                        {loadingStats ? '...' : stats.singleMarks}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${stats.absences > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>
                        {loadingStats ? '...' : stats.absences}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => setCalendarWorker(worker)}
                        className="px-3 py-1.5 bg-sky-600 text-white text-xs font-semibold rounded-xl hover:bg-sky-700 transition shadow-sm inline-flex items-center gap-1.5"
                        title="Ver calendario mensual de asistencia"
                      >
                        📅 Calendario
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="no-data">
                  No se encontraron trabajadores con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <button
          onClick={() => setWorkerCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={workerCurrentPage === 1}
        >
          Anterior
        </button>
        <span>
          Página {workerCurrentPage} de {workerTotalPages}
        </span>
        <button
          onClick={() => setWorkerCurrentPage((p) => Math.min(p + 1, workerTotalPages))}
          disabled={workerCurrentPage === workerTotalPages}
        >
          Siguiente
        </button>
      </div>

      {calendarWorker && (
        <WorkerCalendarModal
          worker={calendarWorker}
          monthYear={workerMonthYear}
          onClose={() => setCalendarWorker(null)}
          shiftTemplates={shiftTemplates}
        />
      )}
    </>
  );
}
