import type { UniqueWorker, DayConfig } from '../../types';
import { getTurnoOnDate } from '../../utils/dateUtils';
import { useState, useEffect, useMemo } from 'react';
import { API_BASE } from '../../constants';
import { WorkerCalendarModal } from '../modals/WorkerCalendarModal';
import { CustomDropdown } from '../CustomDropdown';

interface TrabajadoresViewProps {
  uniqueWorkers: UniqueWorker[];
  filteredWorkers: UniqueWorker[];
  paginatedWorkers: UniqueWorker[];
  workerSearchTerm: string;
  setWorkerSearchTerm: (term: string) => void;
  selectedTurno: string;
  setSelectedTurno: (turno: string) => void;
  selectedWorkerStatusFilter: string;
  setSelectedWorkerStatusFilter: (s: string) => void;
  selectedDate: string;
  availableTurnos: string[];
  workerCurrentPage: number;
  setWorkerCurrentPage: (p: number | ((prev: number) => number)) => void;
  workerTotalPages: number;
  onEditWorker: (worker: UniqueWorker, currentTurno: string) => void;
  onSort: (field: string) => void;
  sortField: string;
  sortDir: 'asc' | 'desc';
  workerMonthYear: string;
  setWorkerMonthYear: (m: string) => void;
  shiftTemplates: Record<string, DayConfig[]>;
}

export function TrabajadoresView({
  uniqueWorkers,
  filteredWorkers,
  paginatedWorkers: _paginatedWorkers,
  workerSearchTerm,
  setWorkerSearchTerm,
  selectedTurno,
  setSelectedTurno,
  selectedWorkerStatusFilter,
  setSelectedWorkerStatusFilter,
  selectedDate,
  availableTurnos,
  workerCurrentPage,
  setWorkerCurrentPage,
  workerTotalPages: _workerTotalPages,
  onEditWorker,
  onSort,
  sortField,
  sortDir,
  workerMonthYear,
  setWorkerMonthYear,
  shiftTemplates,
}: TrabajadoresViewProps) {
  const [workerStats, setWorkerStats] = useState<Record<string, { singleMarks: number; absences: number }>>({});
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [calendarWorker, setCalendarWorker] = useState<UniqueWorker | null>(null);
  const [workerPeriodFilter, setWorkerPeriodFilter] = useState<string>('FULL');

  // Obtener estadísticas mensuales/quincenales calculadas por el backend
  useEffect(() => {
    const fetchStats = async () => {
      if (!workerMonthYear) return;
      setLoadingStats(true);
      try {
        const res = await fetch(`${API_BASE}/api/workers/stats?monthYear=${workerMonthYear}&period=${workerPeriodFilter}`);
        const data = await res.json();
        setWorkerStats(data || {});
      } catch (e) {
        console.error(e);
        setWorkerStats({});
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [workerMonthYear, workerPeriodFilter]);

  // Filtrar trabajadores adicionales por estado de asistencia (Todos, Una sola marca, Ausentes)
  const statusFilteredWorkers = useMemo(() => {
    return filteredWorkers.filter((worker) => {
      if (selectedWorkerStatusFilter === 'ALL') return true;
      const stats = workerStats[worker.nombre] || { singleMarks: 0, absences: 0 };
      if (selectedWorkerStatusFilter === 'SINGLE_MARK') return stats.singleMarks > 0;
      if (selectedWorkerStatusFilter === 'ABSENT') return stats.absences > 0;
      return true;
    });
  }, [filteredWorkers, selectedWorkerStatusFilter, workerStats]);

  const pageSize = 15;
  const workerTotalPages = Math.ceil(statusFilteredWorkers.length / pageSize) || 1;
  const paginatedWorkers = useMemo(() => {
    const start = (workerCurrentPage - 1) * pageSize;
    return statusFilteredWorkers.slice(start, start + pageSize);
  }, [statusFilteredWorkers, workerCurrentPage, pageSize]);

  return (
    <>
      <div className="metrics-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Trabajadores</h3>
          <p className="metric-value text-xl font-extrabold text-slate-900">{uniqueWorkers.length}</p>
        </div>
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Trabajadores Filtrados</h3>
          <p className="metric-value text-xl font-extrabold text-sky-600">{statusFilteredWorkers.length}</p>
        </div>
      </div>

      <div className="controls-bar flex flex-wrap items-start gap-4 mb-6">
        <div className="visual-date-picker w-[260px] mb-0">
          <label className="vdp-label">
            🔍 Buscar por Nombre o No.
          </label>
          <input
            type="text"
            placeholder="Buscar:"
            value={workerSearchTerm}
            onChange={(e) => {
              setWorkerSearchTerm(e.target.value);
              setWorkerCurrentPage(1);
            }}
            className="w-full bg-white border-2 border-[#94a3b8] rounded-lg px-4 py-3 text-slate-900 text-sm font-semibold outline-none focus:border-green-600 placeholder:text-slate-400"
          />
        </div>

        <div className="w-[220px]">
          <CustomDropdown
            label="🔄 Filtrar por Turno:"
            value={selectedTurno}
            onChange={(val) => {
              setSelectedTurno(val);
              setWorkerCurrentPage(1);
            }}
            options={[
              { label: 'Todos los turnos', value: 'ALL' },
              ...availableTurnos.map((t) => ({ label: t, value: t }))
            ]}
            width="w-full"
          />
        </div>

        <div className="w-[220px]">
          <CustomDropdown
            label="👤 Estado de Asistencia:"
            value={selectedWorkerStatusFilter}
            onChange={(val) => {
              setSelectedWorkerStatusFilter(val);
              setWorkerCurrentPage(1);
            }}
            options={[
              { label: 'Todos', value: 'ALL' },
              { label: 'Una sola marca', value: 'SINGLE_MARK' },
              { label: 'Ausentes', value: 'ABSENT' }
            ]}
            width="w-full"
          />
        </div>

        <div className="w-[200px] ml-auto">
          <CustomDropdown
            label="📅 Periodo:"
            value={workerPeriodFilter}
            onChange={(val) => {
              setWorkerPeriodFilter(val);
              setWorkerCurrentPage(1);
            }}
            options={[
              { label: 'Mes completo', value: 'FULL' },
              { label: '1ª Quincena (1-15)', value: 'Q1' },
              { label: '2ª Quincena (16-fin)', value: 'Q2' }
            ]}
            width="w-full"
          />
        </div>

        <div className="visual-date-picker w-[220px]">
          <label className="vdp-label">📅 Mes de Estadísticas:</label>
          <input
            type="month"
            value={workerMonthYear}
            onChange={(e) => setWorkerMonthYear(e.target.value)}
            className="vdp-header-bar w-full bg-white text-slate-800 font-semibold text-base outline-none cursor-pointer"
          />
        </div>
      </div>

      <p className="hint-text mb-6">💡 Haz clic en cualquier trabajador para configurar reglas de turno, o usa el botón de calendario para ver su detalle mensual.</p>

      <div className="table-responsive">
        <table className="nomina-table">
          <thead>
            <tr>
              <th onClick={() => onSort('no')} className="cursor-pointer select-none hover:text-green-700">
                No. {sortField === 'no' ? (sortDir === 'asc' ? ' ▲ (Asc)' : ' ▼ (Desc)') : ' ↕'}
              </th>
              <th>
                Nombre del Trabajador
              </th>
              <th>Turno Base</th>
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
