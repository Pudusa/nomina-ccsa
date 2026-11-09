import { useState, useEffect, useMemo } from 'react';
import { CustomDropdown } from '../CustomDropdown';
import { VisualDatePicker } from '../VisualDatePicker';
import { VisualMonthPicker } from '../VisualMonthPicker';
import { getTodayDateString, getYesterdayDateString } from '../../utils/dateUtils';
import { apiFetch } from '../../utils/api';

interface Anomalia {
  id: number;
  tipo: string;
  fecha: string;
}

interface WorkerIncidents {
  no: string;
  nombre: string;
  anomalias: Anomalia[];
}

const formatDateToDDMMAAAA = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export function IncidenciasView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [dateMode, setDateMode] = useState<string>('mes');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = getTodayDateString();
    return today.substring(0, 7);
  });
  const [dateFrom, setDateFrom] = useState(() => getYesterdayDateString());
  const [dateTo, setDateTo] = useState(() => getYesterdayDateString());
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [incidentsData, setIncidentsData] = useState<WorkerIncidents[]>([]);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchIncidents = async () => {
    setLoading(true);
    try {
      let queryUrl = '/api/attendance/incidents';
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y || 2026, m || 10, 0).getDate();
      const lastDayStr = String(lastDay).padStart(2, '0');

      if (dateMode === 'personalizado') {
        queryUrl += `?startDate=${dateFrom}&endDate=${dateTo}`;
      } else if (dateMode === 'quincena_1') {
        queryUrl += `?startDate=${selectedMonth}-01&endDate=${selectedMonth}-15`;
      } else if (dateMode === 'quincena_2') {
        queryUrl += `?startDate=${selectedMonth}-16&endDate=${selectedMonth}-${lastDayStr}`;
      } else {
        queryUrl += `?startDate=${selectedMonth}-01&endDate=${selectedMonth}-${lastDayStr}`;
      }

      const res = await apiFetch(queryUrl);
      if (res.ok) {
        const data = await res.json();
        setIncidentsData(Array.isArray(data) ? data : []);
      } else {
        console.error('Error fetching incidents');
        setIncidentsData([]);
      }
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
      setIncidentsData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const handleUploaded = () => {
      fetchIncidents();
    };
    window.addEventListener('nomina:attendance-uploaded', handleUploaded);
    return () => {
      window.removeEventListener('nomina:attendance-uploaded', handleUploaded);
    };
  }, [selectedMonth, dateMode, dateFrom, dateTo]);

  // Filtrado por búsqueda y tipo de anomalía
  const filteredWorkers = incidentsData.map((worker) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesWorker = !query || worker.nombre.toLowerCase().includes(query) || worker.no.toLowerCase().includes(query);
    
    const filteredAnomalias = worker.anomalias.filter((anom) => {
      const matchesType = selectedType === 'ALL' || 
        (selectedType === 'marca' ? anom.tipo.toLowerCase().includes('falta') : anom.tipo.toLowerCase().includes(selectedType.toLowerCase()));
      return matchesType;
    });

    return {
      ...worker,
      matchesWorker,
      anomalias: filteredAnomalias
    };
  }).filter((worker) => (searchTerm ? worker.matchesWorker && worker.anomalias.length > 0 : worker.anomalias.length > 0));

  const sortedAndFilteredWorkers = [...filteredWorkers].sort((a, b) => {
    const numA = parseInt(a.no, 10);
    const numB = parseInt(b.no, 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    }
    return sortOrder === 'asc' ? a.no.localeCompare(b.no) : b.no.localeCompare(a.no);
  });

  const pageSize = 15;
  const totalPages = Math.ceil(sortedAndFilteredWorkers.length / pageSize) || 1;
  const paginatedWorkers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAndFilteredWorkers.slice(start, start + pageSize);
  }, [sortedAndFilteredWorkers, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth, dateMode, dateFrom, dateTo, selectedType]);

  const totalAnomaliasCount = incidentsData.reduce((acc, w) => acc + w.anomalias.length, 0);
  const totalAusencias = incidentsData.reduce((acc, w) => acc + w.anomalias.filter(a => a.tipo === 'Ausencia').length, 0);
  const totalIncompletas = incidentsData.reduce((acc, w) => acc + w.anomalias.filter(a => a.tipo.includes('Falta')).length, 0);
  const totalFueraDeTurno = incidentsData.reduce((acc, w) => acc + w.anomalias.filter(a => a.tipo === 'Fuera de turno').length, 0);

  const dateModeOptions = [
    { label: 'Mes Completo', value: 'mes' },
    { label: 'Primera Quincena', value: 'quincena_1' },
    { label: 'Segunda Quincena', value: 'quincena_2' },
    { label: 'Personalizada', value: 'personalizado' }
  ];

  return (
    <div className="space-y-6">
      {/* 1. Panel de Métricas de Anomalías */}
      <div className="border-2 border-dashed border-sky-400 bg-sky-50/40 rounded-2xl p-4 relative">
        <span className="absolute -top-3 left-4 bg-sky-600 text-white text-xs font-bold px-3 py-0.5 rounded-full shadow">
          📊 [Métricas de Anomalías y Asistencia Real]
        </span>
        <div className="metrics-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-2">
          <div className="metric-card bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Anomalías</h3>
            <p className="metric-value text-lg font-extrabold text-slate-900">{totalAnomaliasCount}</p>
          </div>
          <div className="metric-card bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Ausencias</h3>
            <p className="metric-value text-lg font-extrabold text-rose-600">{totalAusencias}</p>
          </div>
          <div className="metric-card bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Marcas Incompletas</h3>
            <p className="metric-value text-lg font-extrabold text-amber-600">{totalIncompletas}</p>
          </div>
          <div className="metric-card bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fuera de Turno</h3>
            <p className="metric-value text-lg font-extrabold text-purple-600">{totalFueraDeTurno}</p>
          </div>
          <div className="metric-card bg-white border border-slate-200 rounded-xl p-5 text-center shadow-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Trabajadores Afectados</h3>
            <p className="metric-value text-lg font-extrabold text-slate-700">{incidentsData.length}</p>
          </div>
        </div>
      </div>

      {/* 2. Filtros y Búsqueda */}
      <div className="border-2 border-dashed border-indigo-400 bg-indigo-50/30 rounded-2xl p-4 relative">
        <span className="absolute -top-3 left-4 bg-indigo-600 text-white text-xs font-bold px-3 py-0.5 rounded-full shadow">
          🔍 [Filtros y Búsqueda de Trabajador]
        </span>
        <div className="controls-bar flex flex-wrap items-center gap-4 mt-2">
          <div className="visual-date-picker w-[220px] mb-0">
            <label className="vdp-label">Buscar Trabajador:</label>
            <div className="vdp-header-bar">
              <input
                type="text"
                placeholder="Nombre o No."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent text-slate-800 font-semibold text-base outline-none placeholder:text-slate-400"
              />
              <span className="text-slate-400 text-sm ml-2">🔍</span>
            </div>
          </div>

          <div className="w-[220px]">
            <CustomDropdown
              label="Tipo de Anomalía:"
              value={selectedType}
              onChange={setSelectedType}
              options={[
                { label: 'Todas las anomalías', value: 'ALL' },
                { label: 'Ausencia', value: 'Ausencia' },
                { label: 'Marca incompleta', value: 'marca' },
                { label: 'Fuera de turno', value: 'Fuera de turno' }
              ]}
              width="w-full"
            />
          </div>

          <div className="w-[200px]">
            <CustomDropdown
              label="Modo de Fecha:"
              value={dateMode}
              onChange={setDateMode}
              options={dateModeOptions}
              width="w-full"
            />
          </div>

          {dateMode !== 'personalizado' ? (
            <div className="w-[220px]">
              <VisualMonthPicker
                label="Seleccionar Mes:"
                value={selectedMonth}
                onChange={setSelectedMonth}
              />
            </div>
          ) : (
            <>
              <div className="w-[180px]">
                <VisualDatePicker
                  label="Desde:"
                  value={dateFrom}
                  availableDates={[dateFrom]}
                  onChange={setDateFrom}
                />
              </div>
              <div className="w-[180px]">
                <VisualDatePicker
                  label="Hasta:"
                  value={dateTo}
                  availableDates={[dateTo]}
                  onChange={setDateTo}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3. Tabla Agrupada por Trabajador (NO., Nombre, Tipo de Incidencia, Fecha) */}
      <div className="border-2 border-dashed border-emerald-400 bg-emerald-50/25 rounded-2xl p-4 relative">
        <span className="absolute -top-3 left-4 bg-emerald-600 text-white text-xs font-bold px-3 py-0.5 rounded-full shadow">
          📋 [Tabla de Anomalías Agrupadas por Trabajador]
        </span>
        <div className="table-responsive mt-2 bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
          <table className="nomina-table asistencias-table w-full">
            <thead>
              <tr className="bg-slate-100 text-slate-700 text-left text-xs uppercase tracking-wider font-bold">
                <th 
                  className="p-3 w-16 cursor-pointer select-none hover:text-emerald-700 transition"
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  title="Click para cambiar orden (Ascendente / Descendente)"
                >
                  No. {sortOrder === 'asc' ? ' ▲' : ' ▼'}
                </th>
                <th className="p-3 w-40">Nombre</th>
                <th className="p-3 w-1/2">Tipo de Incidencia</th>
                <th className="p-3 w-1/3">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-base">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-semibold">
                    Cargando incidencias y anomalías desde la base de datos...
                  </td>
                </tr>
              ) : paginatedWorkers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500 font-semibold">
                    No se encontraron incidencias o anomalías para el período seleccionado.
                  </td>
                </tr>
              ) : (
                paginatedWorkers.map((worker: WorkerIncidents) =>
                  worker.anomalias.map((anom: Anomalia, idx: number) => (
                    <tr key={`${worker.no}-${anom.id}`} className="hover:bg-slate-50 transition">
                      {idx === 0 ? (
                        <>
                          <td rowSpan={worker.anomalias.length} className="p-3 font-bold text-slate-700 bg-slate-50/50 align-top border-r border-slate-100">
                            {worker.no}
                          </td>
                          <td rowSpan={worker.anomalias.length} className="p-3 font-extrabold text-slate-900 bg-slate-50/50 align-top border-r border-slate-100">
                            {worker.nombre}
                          </td>
                        </>
                      ) : null}
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full text-sm font-bold ${
                          anom.tipo.includes('marca') ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {anom.tipo}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="font-extrabold text-emerald-700">
                          {formatDateToDDMMAAAA(anom.fecha)}
                        </span>
                      </td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Paginación y Pie */}
      <div className="border-2 border-dashed border-amber-400 bg-amber-50/30 rounded-2xl p-3 relative flex items-center justify-between">
        <span className="absolute -top-3 left-4 bg-amber-600 text-white text-xs font-bold px-3 py-0.5 rounded-full shadow">
          📄 [Paginación]
        </span>
        <div className="text-xs font-bold text-slate-600 mt-1">
          Mostrando {paginatedWorkers.length} de {sortedAndFilteredWorkers.length} trabajadores con anomalías detectadas
        </div>
        <div className="pagination-bar flex items-center gap-2 mt-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            Anterior
          </button>
          <span className="text-xs font-bold text-slate-700">
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
