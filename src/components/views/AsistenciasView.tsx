import type { WorkerDaySummary } from '../../types';
import { VisualDatePicker } from '../VisualDatePicker';
import { CustomDropdown } from '../CustomDropdown';
import { formatDisplayDate, formatTime } from '../../utils/dateUtils';
import { Icon } from '../Icon';

interface AsistenciasViewProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  availableDates: string[];
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
  onSort: (field: string) => void;
  sortField: string;
  sortDir: 'asc' | 'desc';
}

export function AsistenciasView({
  selectedDate,
  setSelectedDate,
  availableDates,
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
  onSort,
  sortField,
  sortDir,
}: AsistenciasViewProps) {
  return (
    <>
      <div className="metrics-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2"><Icon name="calendar_today" /> Día Seleccionado</h3>
          <p className="metric-value text-xl font-extrabold text-sky-600">
            {selectedDate ? formatDisplayDate(selectedDate) : 'Ninguno'}
          </p>
        </div>
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2"><Icon name="groups" /> Trabajadores Registrados</h3>
          <p className="metric-value text-xl font-extrabold text-slate-900">{filteredSummaries.length}</p>
        </div>
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2"><Icon name="calendar_view_day" /> Programados a Trabajar</h3>
          <p className="metric-value text-xl font-extrabold text-emerald-600">{scheduledWorkersCount}</p>
        </div>
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2"><Icon name="filter_list" /> Filtrados</h3>
          <p className="metric-value text-xl font-extrabold text-slate-900">{filteredSummaries.length}</p>
        </div>
      </div>

      <div className="controls-bar flex flex-wrap items-start gap-4 mb-6">
        <div className="visual-date-picker w-[260px] mb-0">
          <label className="vdp-label">
            Buscar por Nombre o No.
          </label>
          <div className="vdp-header-bar">
            <input
              type="text"
              placeholder="Buscar:"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-transparent text-slate-800 font-semibold text-base outline-none placeholder:text-slate-400"
            />
            <Icon name="search" className="asist-search-icon" />
          </div>
        </div>

        <div className="w-[220px]">
          <CustomDropdown
            label="Filtrar por Turno:"
            value={selectedAttendanceShiftFilter}
            onChange={(val) => {
              setSelectedAttendanceShiftFilter(val);
              setCurrentPage(1);
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
            label="Estado de Asistencia:"
            value={selectedAttendanceStatusFilter}
            onChange={(val) => {
              setSelectedAttendanceStatusFilter(val);
              setCurrentPage(1);
            }}
            options={[
              { label: 'Todos', value: 'ALL' },
              { label: 'Presentes', value: 'PRESENT' },
              { label: 'Ausentes', value: 'ABSENT' }
            ]}
            width="w-full"
          />
        </div>

        <div className="w-[220px] ml-auto">
          <VisualDatePicker
            label="Día de Asistencia:"
            value={selectedDate}
            availableDates={availableDates}
            onChange={(dateStr) => {
              setSelectedDate(dateStr);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="nomina-table asistencias-table">
          <thead>
            <tr>
              <th onClick={() => onSort('no')} className="cursor-pointer select-none hover:text-sky-400">
                No. {sortField === 'no' ? (sortDir === 'asc' ? ' ▲ (Asc)' : ' ▼ (Desc)') : ' ↕'}
              </th>
              <th>Nombre</th>
              <th>Turno</th>
              <th>Entrada</th>
              <th>Salida</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSummaries.length > 0 ? (
              paginatedSummaries.map((worker, idx) => {
                const status = worker.status;
                const withMarks = status === 'presente' || status === 'incompleto' || status === 'fuera_de_turno';

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td>{worker.no || '-'}</td>
                    <td className="font-weight-bold">{worker.nombre}</td>
                    <td>
                      <span className="badge-turno">{worker.turno}</span>
                    </td>
                    {withMarks ? (
                      <>
                        <td>
                          <div className="flex flex-col justify-center min-h-[50px] gap-1">
                            {worker.entradaMañana && (
                              <span className="badge-dept" title="Entrada por la Mañana">
                                <Icon name="light_mode" /> {formatTime(worker.entradaMañana)}
                              </span>
                            )}
                            {worker.entradaTarde && (
                              <span className="badge-dept" title="Entrada por la Tarde">
                                <Icon name="dark_mode" /> {formatTime(worker.entradaTarde)}
                              </span>
                            )}
                            {!worker.entradaMañana && !worker.entradaTarde && (
                              <span className="badge-missing">
                                —
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col justify-center min-h-[50px] gap-1">
                            {worker.salidaMañana && (
                              <span className="badge-verif" title="Salida por la Mañana">
                                <Icon name="light_mode" /> {formatTime(worker.salidaMañana)}
                              </span>
                            )}
                            {worker.salidaTarde && (
                              <span className="badge-verif" title="Salida por la Tarde">
                                <Icon name="dark_mode" /> {formatTime(worker.salidaTarde)}
                              </span>
                            )}
                            {!worker.salidaMañana && !worker.salidaTarde && (
                              <span className="badge-missing">
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      </>
                    ) : status === 'descanso' ? (
                      <td colSpan={2} className="text-center py-4">
                        <span className="badge-rest-attendance">
                          <Icon name="bed" /> Descanso
                        </span>
                      </td>
                    ) : status === 'pendiente' ? (
                      <td colSpan={2} className="text-center py-4">
                        <span className="badge-missing">
                          —
                        </span>
                      </td>
                    ) : (
                      <td colSpan={2} className="text-center py-4">
                        <span className="badge-absent">
                          <Icon name="person_off" /> Ausente
                        </span>
                      </td>
                    )}
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
