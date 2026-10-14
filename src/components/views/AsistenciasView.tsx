import type { WorkerDaySummary } from '../../types';
import { VisualDatePicker } from '../VisualDatePicker';
import { formatDisplayDate, formatTime } from '../../utils/dateUtils';

interface AsistenciasViewProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  availableDates: string[];
  workerSummaries: WorkerDaySummary[];
  filteredSummaries: WorkerDaySummary[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  currentPage: number;
  setCurrentPage: (p: number | ((prev: number) => number)) => void;
  totalPages: number;
  paginatedSummaries: WorkerDaySummary[];
  selectedAttendanceShiftFilter: string;
  setSelectedAttendanceShiftFilter: (s: string) => void;
  selectedAttendanceStatusFilter: string;
  setSelectedAttendanceStatusFilter: (s: string) => void;
  availableTurnos: string[];
  scheduledWorkersCount: number;
}

export function AsistenciasView({
  selectedDate,
  setSelectedDate,
  availableDates,
  workerSummaries,
  filteredSummaries,
  searchTerm,
  setSearchTerm,
  currentPage,
  setCurrentPage,
  totalPages,
  paginatedSummaries,
  selectedAttendanceShiftFilter,
  setSelectedAttendanceShiftFilter,
  selectedAttendanceStatusFilter,
  setSelectedAttendanceStatusFilter,
  availableTurnos,
  scheduledWorkersCount,
}: AsistenciasViewProps) {
  return (
    <>
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Día Seleccionado</h3>
          <p className="metric-value text-2xl font-bold text-sky-400">
            {selectedDate ? formatDisplayDate(selectedDate) : 'Ninguno'}
          </p>
        </div>
        <div className="metric-card">
          <h3>Trabajadores Registrados</h3>
          <p className="metric-value">{workerSummaries.length}</p>
        </div>
        <div className="metric-card">
          <h3>Programados a Trabajar</h3>
          <p className="metric-value">{scheduledWorkersCount}</p>
        </div>
        <div className="metric-card">
          <h3>Filtrados</h3>
          <p className="metric-value">{filteredSummaries.length}</p>
        </div>
      </div>

      <div className="controls-bar flex flex-wrap items-start justify-start gap-8 mb-6">
        <div className="filter-box w-[280px]">
          <VisualDatePicker
            label="📅 Día de Asistencia:"
            value={selectedDate}
            availableDates={availableDates}
            onChange={(dateStr) => {
              setSelectedDate(dateStr);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="filter-box flex flex-col items-start gap-1.5 w-[220px] self-center">
          <label className="text-sm font-medium text-slate-300">
            🔄 Filtrar por Turno:
          </label>
          <select
            value={selectedAttendanceShiftFilter}
            onChange={(e) => {
              setSelectedAttendanceShiftFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-4 py-3 text-slate-100 text-sm outline-none focus:border-sky-400"
          >
            <option value="ALL">Todos los turnos</option>
            {availableTurnos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-box flex flex-col items-start gap-1.5 w-[200px] self-center">
          <label className="text-sm font-medium text-slate-300">
            👤 Estado de Asistencia:
          </label>
          <select
            value={selectedAttendanceStatusFilter}
            onChange={(e) => {
              setSelectedAttendanceStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-4 py-3 text-slate-100 text-sm outline-none focus:border-sky-400"
          >
            <option value="ALL">Todos</option>
            <option value="PRESENT">Presentes</option>
            <option value="ABSENT">Ausentes</option>
          </select>
        </div>

        <div className="search-box self-center">
          <input
            type="text"
            placeholder="Buscar por Nombre o No. de empleado..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="nomina-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Nombre</th>
              <th>Turno</th>
              <th>Entrada (Mañana / Tarde)</th>
              <th>Salida (Mañana / Tarde)</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSummaries.length > 0 ? (
              paginatedSummaries.map((worker, idx) => {
                const hasMark = Boolean(
                  worker.marca1 ||
                  worker.marca2 ||
                  worker.entradaMañana ||
                  worker.salidaMañana ||
                  worker.entradaTarde ||
                  worker.salidaTarde
                );

                return (
                  <tr key={idx}>
                    <td>{worker.no || '-'}</td>
                    <td className="font-weight-bold">{worker.nombre}</td>
                    <td>
                      <span className="badge-turno">{worker.turno}</span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {hasMark ? (
                          <>
                            {worker.entradaMañana && (
                              <span className="badge-dept" title="Entrada por la Mañana">
                                🟢 {formatTime(worker.entradaMañana)} <small className="text-sky-400">(Mañana)</small>
                              </span>
                            )}
                            {worker.entradaTarde && (
                              <span className="badge-dept" title="Entrada por la Tarde">
                                🟡 {formatTime(worker.entradaTarde)} <small className="text-amber-400">(Tarde)</small>
                              </span>
                            )}
                            {!worker.entradaMañana && !worker.entradaTarde && worker.marca1 && (
                              <span>{formatTime(worker.marca1)}</span>
                            )}
                          </>
                        ) : worker.isRest ? (
                          <span className="inline-block w-fit bg-slate-700 text-slate-300 font-medium px-2 py-0.5 rounded text-xs">
                            💤 Descanso
                          </span>
                        ) : (
                          <span className="inline-block w-fit bg-rose-100 text-rose-600 font-semibold px-2 py-0.5 rounded text-xs">
                            ❌ Ausente
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {hasMark ? (
                          <>
                            {worker.salidaMañana && (
                              <span className="badge-verif" title="Salida por la Mañana">
                                🌙 {formatTime(worker.salidaMañana)} <small className="text-sky-400">(Mañana)</small>
                              </span>
                            )}
                            {worker.salidaTarde && (
                              <span className="badge-verif" title="Salida por la Tarde">
                                🔴 {formatTime(worker.salidaTarde)} <small className="text-rose-400">(Tarde)</small>
                              </span>
                            )}
                            {!worker.salidaMañana && !worker.salidaTarde && worker.marca2 && (
                              <span className="badge-muted">{formatTime(worker.marca2)}</span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="no-data">
                  No hay registros de trabajadores para este día.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-bar">
        <button
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          disabled={currentPage === 1}
        >
          Anterior
        </button>
        <span>
          Página {currentPage} de {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          Siguiente
        </button>
      </div>
    </>
  );
}
