import type { UniqueWorker, DayConfig } from '../../types';
import { getTurnoOnDate } from '../../utils/dateUtils';
import { useState, useMemo } from 'react';
import { CustomDropdown } from '../CustomDropdown';

interface TrabajadoresViewProps {
  uniqueWorkers: UniqueWorker[];
  filteredWorkers: UniqueWorker[];
  paginatedWorkers: UniqueWorker[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedTurno: string;
  setSelectedTurno: (turno: string) => void;
  selectedDate: string;
  availableTurnos: string[];
  workerCurrentPage: number;
  setWorkerCurrentPage: (p: number | ((prev: number) => number)) => void;
  workerTotalPages: number;
  onEditWorker: (worker: UniqueWorker, currentTurno: string) => void;
  onOpenCalendar: (worker: UniqueWorker) => void;
  onSort: (field: string) => void;
  sortField: string;
  sortDir: 'asc' | 'desc';
  shiftTemplates: Record<string, DayConfig[]>;
  canEdit: boolean;
}

export function TrabajadoresView({
  uniqueWorkers,
  filteredWorkers,
  paginatedWorkers: _paginatedWorkers,
  searchTerm,
  setSearchTerm,
  selectedTurno,
  setSelectedTurno,
  selectedDate,
  availableTurnos,
  workerCurrentPage,
  setWorkerCurrentPage,
  workerTotalPages: _workerTotalPages,
  onEditWorker,
  onOpenCalendar,
  onSort,
  sortField,
  sortDir,
  canEdit,
}: TrabajadoresViewProps) {
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('ALL');

  // Departamentos extraídos dinámicamente de los trabajadores
  const availableDepartamentos = useMemo(() => {
    const depts = new Set<string>();
    uniqueWorkers.forEach((worker: any) => {
      depts.add(worker.departamento || 'General');
    });
    return Array.from(depts).sort();
  }, [uniqueWorkers]);

  // Filtrar trabajadores por turno, departamento y término de búsqueda
  const departmentFilteredWorkers = useMemo(() => {
    return filteredWorkers.filter((worker) => {
      const dept = (worker as any).departamento || 'General';
      if (selectedDepartamento !== 'ALL' && dept !== selectedDepartamento) {
        return false;
      }
      return true;
    });
  }, [filteredWorkers, selectedDepartamento]);

  const pageSize = 15;
  const workerTotalPages = Math.ceil(departmentFilteredWorkers.length / pageSize) || 1;
  const paginatedWorkers = useMemo(() => {
    const start = (workerCurrentPage - 1) * pageSize;
    return departmentFilteredWorkers.slice(start, start + pageSize);
  }, [departmentFilteredWorkers, workerCurrentPage, pageSize]);

  return (
    <div className="space-y-6 p-4 bg-slate-50 min-h-screen">
      {/* 1. Tarjetas de Métricas / Estadísticas */}
      <div className="metrics-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Trabajadores</h3>
          <p className="metric-value text-xl font-extrabold text-slate-900">{uniqueWorkers.length}</p>
        </div>
        <div className="metric-card bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Trabajadores Filtrados</h3>
          <p className="metric-value text-xl font-extrabold text-sky-600">{departmentFilteredWorkers.length}</p>
        </div>
      </div>

      {/* 2. Barra de Controles, Búsqueda y Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="controls-bar flex flex-wrap items-start gap-4">
          {/* Buscador de número y nombre */}
          <div className="visual-date-picker w-[300px] mb-0">
            <label className="vdp-label">
              Buscar por Nombre o No.
            </label>
            <div className="vdp-header-bar">
              <input
                type="text"
                placeholder="Buscar trabajador..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setWorkerCurrentPage(1);
                }}
                className="w-full bg-transparent text-slate-800 font-semibold text-base outline-none placeholder:text-slate-400"
              />
              <span className="text-slate-400 text-sm ml-2">🔍</span>
            </div>
          </div>

          {/* Filtro por Turno */}
          <div className="w-[240px]">
            <CustomDropdown
              label="🔄 Filtrar por Turno:"
              value={selectedTurno}
              onChange={(val) => {
                setSelectedTurno(val);
                setWorkerCurrentPage(1);
              }}
              options={[
                { label: 'Todos', value: 'ALL' },
                ...availableTurnos.map((t) => ({ label: t, value: t }))
              ]}
              width="w-full"
            />
          </div>

          {/* Filtro por Departamento */}
          <div className="w-[240px]">
            <CustomDropdown
              label="🏢 Filtrar por Departamento:"
              value={selectedDepartamento}
              onChange={(val) => {
                setSelectedDepartamento(val);
                setWorkerCurrentPage(1);
              }}
              options={[
                { label: 'Todos', value: 'ALL' },
                ...availableDepartamentos.map((d) => ({ label: d, value: d }))
              ]}
              width="w-full"
            />
          </div>
        </div>
      </div>

      {/* Tabla Principal de Trabajadores */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="table-responsive">
          <table className="nomina-table">
            <thead>
              <tr>
                <th onClick={() => onSort('no')} className="cursor-pointer select-none hover:text-green-700">
                  No. {sortField === 'no' ? (sortDir === 'asc' ? ' ▲ (Asc)' : ' ▼ (Desc)') : ' ↕'}
                </th>
                <th>Nombre del Trabajador</th>
                <th>Departamento</th>
                <th>Turno Base</th>
                <th className="text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedWorkers.length > 0 ? (
                paginatedWorkers.map((worker, idx) => {
                  const currentTurno = selectedDate ? getTurnoOnDate(worker.defaultTurno, worker.rules, selectedDate) : worker.defaultTurno;
                  const dept = (worker as any).departamento || 'General';

                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition">
                      <td>{worker.no || '-'}</td>
                      <td className="font-weight-bold">
                        {worker.nombre}
                      </td>
                      <td>
                        <span className="text-slate-600 font-medium">{dept}</span>
                      </td>
                      <td>
                        <span className="badge-verif">{currentTurno}</span>
                      </td>
                      <td className="text-center">
                        <div className="inline-flex items-center justify-center gap-2">
                          <button
                            onClick={() => onOpenCalendar(worker)}
                            className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition shadow-sm text-center"
                            title="Ver calendario mensual de asistencia"
                          >
                            📅 Calendario
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => onEditWorker(worker, currentTurno)}
                              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 transition shadow-sm text-center"
                              title="Configurar turnos y periodos"
                            >
                              ✏️ Editar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="no-data">
                    No se encontraron trabajadores con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barra de Paginación */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="pagination-bar">
          <button
            onClick={() => setWorkerCurrentPage((p: any) => Math.max(p - 1, 1))}
            disabled={workerCurrentPage === 1}
          >
            Anterior
          </button>
          <span>
            Página {workerCurrentPage} de {workerTotalPages}
          </span>
          <button
            onClick={() => setWorkerCurrentPage((p: any) => Math.min(p + 1, workerTotalPages))}
            disabled={workerCurrentPage === workerTotalPages}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
