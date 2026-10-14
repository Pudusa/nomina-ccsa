import type { IncidentItem } from '../../types';
import { formatDisplayDate } from '../../utils/dateUtils';

interface IncidenciasViewProps {
  selectedMonthYear: string;
  setSelectedMonthYear: (ym: string) => void;
  incidentPeriod: 'full' | 'q1' | 'q2';
  setIncidentPeriod: (p: 'full' | 'q1' | 'q2') => void;
  incidentTypeFilter: string;
  setIncidentTypeFilter: (t: string) => void;
  incidentSearchTerm: string;
  setIncidentSearchTerm: (s: string) => void;
  incidentShiftFilter: string;
  setIncidentShiftFilter: (s: string) => void;
  availableTurnos: string[];
  incidents: IncidentItem[];
  filteredIncidents: IncidentItem[];
  paginatedIncidents: IncidentItem[];
  currentPage: number;
  setCurrentPage: (p: number | ((prev: number) => number)) => void;
  totalPages: number;
  totalIncidentsCount: number;
  absentCount: number;
}

export function IncidenciasView({
  selectedMonthYear,
  setSelectedMonthYear,
  incidentPeriod,
  setIncidentPeriod,
  incidentTypeFilter,
  setIncidentTypeFilter,
  incidentSearchTerm,
  setIncidentSearchTerm,
  incidentShiftFilter,
  setIncidentShiftFilter,
  availableTurnos,
  filteredIncidents,
  paginatedIncidents,
  currentPage,
  setCurrentPage,
  totalPages,
  totalIncidentsCount,
  absentCount,
}: IncidenciasViewProps) {
  return (
    <>
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total de Incidencias</h3>
          <p className="metric-value">{totalIncidentsCount}</p>
        </div>
        <div className="metric-card">
          <h3>Ausencias Detectadas</h3>
          <p className="metric-value text-rose-400">{absentCount}</p>
        </div>
        <div className="metric-card">
          <h3>Periodo Analizado</h3>
          <p className="metric-value text-lg">
            {incidentPeriod === 'full' ? 'Mes Completo' : incidentPeriod === 'q1' ? '1era Quincena (1-15)' : '2da Quincena (16-Fin)'}
          </p>
        </div>
        <div className="metric-card">
          <h3>Resultados Filtrados</h3>
          <p className="metric-value">{filteredIncidents.length}</p>
        </div>
      </div>

      <div className="controls-bar flex flex-wrap items-start justify-start gap-6 mb-6">
        {/* Selector de Mes */}
        <div className="filter-box flex-1 min-w-[220px] flex flex-col items-start gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            📅 Mes:
          </label>
          <input
            type="month"
            value={selectedMonthYear}
            onChange={(e) => {
              setSelectedMonthYear(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-4 py-3 text-slate-100 text-sm outline-none focus:border-sky-400"
          />
        </div>

        {/* Selector de Periodo / Quincena */}
        <div className="filter-box flex-1 min-w-[220px] flex flex-col items-start gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            ⏱️ Rango / Periodo:
          </label>
          <select
            value={incidentPeriod}
            onChange={(e) => {
              setIncidentPeriod(e.target.value as 'full' | 'q1' | 'q2');
              setCurrentPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-4 py-3 text-slate-100 text-sm outline-none focus:border-sky-400"
          >
            <option value="full">Mes Completo</option>
            <option value="q1">1era Quincena (Días 1 - 15)</option>
            <option value="q2">2da Quincena (Días 16 - Fin)</option>
          </select>
        </div>

        {/* Filtro por Tipo de Incidencia */}
        <div className="filter-box flex-1 min-w-[220px] flex flex-col items-start gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            ⚠️ Tipo de Incidencia:
          </label>
          <select
            value={incidentTypeFilter}
            onChange={(e) => {
              setIncidentTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-4 py-3 text-slate-100 text-sm outline-none focus:border-sky-400"
          >
            <option value="ALL">Todas</option>
            <option value="ABSENT">Ausencias (Ausente)</option>
          </select>
        </div>

        {/* Filtro por Turno */}
        <div className="filter-box flex-1 min-w-[220px] flex flex-col items-start gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            🔄 Filtrar por Turno:
          </label>
          <select
            value={incidentShiftFilter}
            onChange={(e) => {
              setIncidentShiftFilter(e.target.value);
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

        {/* Buscador */}
        <div className="search-box flex-1 min-w-[220px] flex flex-col items-start gap-1.5">
          <label className="text-sm font-medium text-slate-300">
            🔍 Buscar:
          </label>
          <input
            type="text"
            placeholder="Buscar por Nombre o No. de empleado..."
            value={incidentSearchTerm}
            onChange={(e) => {
              setIncidentSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-600 rounded-md px-4 py-3 text-slate-100 text-sm outline-none focus:border-sky-400"
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="nomina-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>No.</th>
              <th>Nombre</th>
              <th>Turno</th>
              <th>Tipo de Incidencia</th>
              <th>Descripción</th>
            </tr>
          </thead>
          <tbody>
            {paginatedIncidents.length > 0 ? (
              paginatedIncidents.map((incident) => (
                <tr key={incident.id}>
                  <td>{formatDisplayDate(incident.date)}</td>
                  <td><strong>{incident.workerNo}</strong></td>
                  <td>{incident.workerName}</td>
                  <td>{incident.turno}</td>
                  <td>
                    <span className="status-badge absent bg-rose-500/20 text-rose-400 px-3 py-1 rounded-full text-xs font-semibold">
                      🔴 {incident.type}
                    </span>
                  </td>
                  <td>{incident.description}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  No se encontraron incidencias en el periodo y filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="pagination-bar flex justify-center items-center gap-4 mt-6">
          <button
            className={`px-4 py-2 rounded-md text-white border-none ${currentPage === 1 ? 'bg-slate-700 cursor-not-allowed' : 'bg-blue-600 cursor-pointer hover:bg-blue-700'}`}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          >
            Anterior
          </button>
          <span className="text-slate-300 text-sm">
            Página {currentPage} de {totalPages}
          </span>
          <button
            className={`px-4 py-2 rounded-md text-white border-none ${currentPage === totalPages ? 'bg-slate-700 cursor-not-allowed' : 'bg-blue-600 cursor-pointer hover:bg-blue-700'}`}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          >
            Siguiente
          </button>
        </div>
      )}
    </>
  );
}
