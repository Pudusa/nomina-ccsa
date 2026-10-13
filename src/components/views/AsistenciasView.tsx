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
          <p className="metric-value" style={{ fontSize: '1.4rem' }}>
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

      <div className="controls-bar" style={{ justifyContent: 'flex-start', alignItems: 'flex-start', gap: '2rem', flexWrap: 'wrap' }}>
        <div className="filter-box" style={{ width: '280px' }}>
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

        <div className="filter-box" style={{ width: '220px', alignSelf: 'center', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 500, color: '#cbd5e1' }}>
            🔄 Filtrar por Turno:
          </label>
          <select
            value={selectedAttendanceShiftFilter}
            onChange={(e) => {
              setSelectedAttendanceShiftFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#f8fafc', outline: 'none', fontSize: '0.95rem' }}
          >
            <option value="ALL">Todos los turnos</option>
            {availableTurnos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-box" style={{ width: '200px', alignSelf: 'center', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 500, color: '#cbd5e1' }}>
            👤 Estado de Asistencia:
          </label>
          <select
            value={selectedAttendanceStatusFilter}
            onChange={(e) => {
              setSelectedAttendanceStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#f8fafc', outline: 'none', fontSize: '0.95rem' }}
          >
            <option value="ALL">Todos</option>
            <option value="PRESENT">Presentes</option>
            <option value="ABSENT">Ausentes</option>
          </select>
        </div>

        <div className="search-box" style={{ alignSelf: 'center' }}>
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
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {hasMark ? (
                          <>
                            {worker.entradaMañana && (
                              <span className="badge-dept" title="Entrada por la Mañana">
                                🟢 {formatTime(worker.entradaMañana)} <small style={{ color: '#38bdf8' }}>(Mañana)</small>
                              </span>
                            )}
                            {worker.entradaTarde && (
                              <span className="badge-dept" title="Entrada por la Tarde">
                                🟡 {formatTime(worker.entradaTarde)} <small style={{ color: '#fbbf24' }}>(Tarde)</small>
                              </span>
                            )}
                            {!worker.entradaMañana && !worker.entradaTarde && worker.marca1 && (
                              <span>{formatTime(worker.marca1)}</span>
                            )}
                          </>
                        ) : worker.isRest ? (
                          <span style={{ color: '#94a3b8', fontWeight: 500, backgroundColor: '#334155', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                            💤 Descanso
                          </span>
                        ) : (
                          <span style={{ color: '#dc2626', fontWeight: 600, backgroundColor: '#fee2e2', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-block', width: 'fit-content' }}>
                            ❌ Ausente
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {hasMark ? (
                          <>
                            {worker.salidaMañana && (
                              <span className="badge-verif" title="Salida por la Mañana">
                                🌙 {formatTime(worker.salidaMañana)} <small style={{ color: '#38bdf8' }}>(Mañana)</small>
                              </span>
                            )}
                            {worker.salidaTarde && (
                              <span className="badge-verif" title="Salida por la Tarde">
                                🔴 {formatTime(worker.salidaTarde)} <small style={{ color: '#f87171' }}>(Tarde)</small>
                              </span>
                            )}
                            {!worker.salidaMañana && !worker.salidaTarde && worker.marca2 && (
                              <span className="badge-muted">{formatTime(worker.marca2)}</span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>-</span>
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
