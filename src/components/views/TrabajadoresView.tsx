import type { UniqueWorker } from '../../types';
import { formatDisplayDate, getTurnoOnDate } from '../../utils/dateUtils';

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
}: TrabajadoresViewProps) {
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

      <div className="controls-bar flex flex-wrap items-start justify-start gap-8 mb-6">
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
          <label htmlFor="turno-select">🕒 Turno ({selectedDate ? formatDisplayDate(selectedDate) : 'General'}):</label>
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

      <p className="hint-text">💡 Haz clic en cualquier trabajador para agregar o modificar reglas de turno, incluyendo si su primera marca del día es Entrada o Salida.</p>

      <div className="table-responsive">
        <table className="nomina-table clickable-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Nombre del Trabajador</th>
              <th>Turno Actual ({selectedDate ? formatDisplayDate(selectedDate) : ''})</th>
              <th>Reglas Activas</th>
            </tr>
          </thead>
          <tbody>
            {paginatedWorkers.length > 0 ? (
              paginatedWorkers.map((worker, idx) => {
                const currentTurno = selectedDate ? getTurnoOnDate(worker.defaultTurno, worker.rules, selectedDate) : worker.defaultTurno;
                return (
                  <tr
                    key={idx}
                    onClick={() => onEditWorker(worker, currentTurno)}
                    title="Haz clic para configurar turno"
                  >
                    <td>{worker.no || '-'}</td>
                    <td className="font-weight-bold">{worker.nombre}</td>
                    <td>
                      <span className="badge-verif">{currentTurno}</span>
                    </td>
                    <td>
                      <span className="badge-muted-rule">
                        {worker.rules.length} regla(s)
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="no-data">
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
    </>
  );
}
