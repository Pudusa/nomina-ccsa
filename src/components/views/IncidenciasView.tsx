import { useState, useEffect, useMemo } from 'react';
import { CustomDropdown } from '../CustomDropdown';
import { VisualDatePicker } from '../VisualDatePicker';
import { VisualMonthPicker } from '../VisualMonthPicker';
import { getTodayDateString, getYesterdayDateString } from '../../utils/dateUtils';
import { apiFetch } from '../../utils/api';
import { Icon } from '../Icon';

interface Anomalia {
  id: number;
  categoria?: string;
  tipo: string;
  fecha: string;
  descripcion?: string;
  marcas?: string[];
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

const getBadgeStyle = (tipo: string, categoria?: string) => {
  if (categoria === 'Fuera de turno') return 'bg-purple-100 text-purple-800 border border-purple-300';
  if (categoria === 'Falta marca') return 'bg-amber-100 text-amber-800 border border-amber-300';
  const t = tipo.toLowerCase();
  if (t.includes('incapacidad')) return 'bg-rose-100 text-rose-800 border border-rose-300';
  if (t.includes('permiso c/goce')) return 'bg-pink-100 text-pink-800 border border-pink-300';
  if (t.includes('permiso s/goce')) return 'bg-rose-200 text-rose-900 border border-rose-400';
  if (t.includes('injustificada')) return 'bg-red-200 text-red-900 border border-red-500';
  if (t.includes('vacaciones')) return 'bg-cyan-100 text-cyan-800 border border-cyan-300';
  if (t.includes('dietas')) return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
  if (t.includes('salida')) return 'bg-amber-100 text-amber-800 border border-amber-300';
  if (t.includes('entrada')) return 'bg-amber-200 text-amber-900 border border-amber-400';
  if (t.includes('biométrico') || t.includes('biometrico')) return 'bg-orange-100 text-orange-800 border border-orange-300';
  if (t.includes('comisión') || t.includes('comision') || t.includes('campo')) return 'bg-purple-100 text-purple-800 border border-purple-300';
  if (t.includes('cambio de turno')) return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
  if (t.includes('ausencia')) return 'bg-rose-100 text-rose-800 border border-rose-300';
  if (t.includes('falta') || t.includes('marca')) return 'bg-amber-100 text-amber-800 border border-amber-300';
  if (t.includes('fuera')) return 'bg-purple-100 text-purple-800 border border-purple-300';
  return 'bg-slate-100 text-slate-800 border border-slate-300';
};

const getAnomaliaCategoria = (anom: Anomalia) => {
  if (anom.categoria) return anom.categoria;
  const t = anom.tipo.toLowerCase();
  if (t.includes('fuera') || t.includes('turno') || t.includes('comisión') || t.includes('campo')) {
    return 'Fuera de turno';
  }
  if (t.includes('olvido') || t.includes('biométrico') || t.includes('salida') || t.includes('entrada') || t.includes('falta salida') || t.includes('falta entrada')) {
    return 'Falta marca';
  }
  return 'Ausencia';
};

const getMotivoOptionsForCategoria = (categoria: string) => {
  if (categoria === 'Ausencia') {
    return [
      { label: 'Todos los motivos', value: 'ALL' },
      { label: 'Falta injustificada', value: 'Falta injustificada' },
      { label: 'Incapacidad', value: 'Incapacidad' },
      { label: 'Permiso c/GOCE', value: 'Permiso c/GOCE' },
      { label: 'Permiso s/GOCE', value: 'Permiso s/GOCE' },
      { label: 'Vacaciones', value: 'Vacaciones' },
      { label: 'Dietas', value: 'Dietas' }
    ];
  }
  if (categoria === 'Falta marca') {
    return [
      { label: 'Todos los motivos', value: 'ALL' },
      { label: 'Falta entrada injustificada', value: 'Falta entrada injustificada' },
      { label: 'Falta salida injustificada', value: 'Falta salida injustificada' },
      { label: 'Olvido de Entrada', value: 'Olvido de Entrada' },
      { label: 'Olvido de Salida', value: 'Olvido de Salida' },
      { label: 'Falla Biométrico', value: 'Falla Biométrico' }
    ];
  }
  if (categoria === 'Fuera de turno') {
    return [
      { label: 'Todos los motivos', value: 'ALL' },
      { label: 'Fuera de turno', value: 'Fuera de turno' },
      { label: 'Comisión / Campo', value: 'Comisión / Campo' },
      { label: 'Cambio de Turno', value: 'Cambio de Turno' }
    ];
  }
  return [{ label: 'Todos los motivos', value: 'ALL' }];
};

const getJustificationOptionsForAnomalia = (anom: Anomalia) => {
  const cat = getAnomaliaCategoria(anom);
  if (cat === 'Ausencia') {
    return [
      { label: 'Falta injustificada', value: 'Falta injustificada' },
      { label: 'Incapacidad', value: 'Incapacidad' },
      { label: 'Permiso c/GOCE', value: 'Permiso c/GOCE' },
      { label: 'Permiso s/GOCE', value: 'Permiso s/GOCE' },
      { label: 'Vacaciones', value: 'Vacaciones' },
      { label: 'Dietas', value: 'Dietas' }
    ];
  }
  if (cat === 'Falta marca') {
    return [
      { label: 'Falta entrada injustificada', value: 'Falta entrada injustificada' },
      { label: 'Falta salida injustificada', value: 'Falta salida injustificada' },
      { label: 'Olvido de Entrada', value: 'Olvido de Entrada' },
      { label: 'Olvido de Salida', value: 'Olvido de Salida' },
      { label: 'Falla Biométrico', value: 'Falla Biométrico' }
    ];
  }
  if (cat === 'Fuera de turno') {
    return [
      { label: 'Fuera de turno', value: 'Fuera de turno' },
      { label: 'Comisión / Campo', value: 'Comisión / Campo' },
      { label: 'Cambio de Turno', value: 'Cambio de Turno' }
    ];
  }
  return [
    { label: 'Falta injustificada', value: 'Falta injustificada' }
  ];
};

interface IncidenciasViewProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  canEdit: boolean;
}

export function IncidenciasView({ searchTerm, setSearchTerm, canEdit }: IncidenciasViewProps) {
  const [selectedCategoria, setSelectedCategoria] = useState('ALL');
  const [selectedMotivo, setSelectedMotivo] = useState('ALL');
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

  // Modal State for Justification
  const [justifyingItem, setJustifyingItem] = useState<{
    workerNo: string;
    workerName: string;
    anomalia: Anomalia;
  } | null>(null);
  const [newTipo, setNewTipo] = useState('Falta injustificada');
  const [newDescripcion, setNewDescripcion] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleCategoriaChange = (cat: string) => {
    setSelectedCategoria(cat);
    setSelectedMotivo('ALL');
  };

  // Filtrado por búsqueda, categoría y motivo
  const filteredWorkers = incidentsData.map((worker) => {
    const query = searchTerm.toLowerCase().trim();
    const matchesWorker = !query || worker.nombre.toLowerCase().includes(query) || worker.no.toLowerCase().includes(query);
    
    const filteredAnomalias = worker.anomalias.filter((anom) => {
      const cat = getAnomaliaCategoria(anom);
      if (selectedCategoria !== 'ALL' && cat !== selectedCategoria) return false;
      if (selectedMotivo !== 'ALL' && !anom.tipo.toLowerCase().includes(selectedMotivo.toLowerCase())) return false;
      return true;
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
  }, [searchTerm, selectedMonth, dateMode, dateFrom, dateTo, selectedCategoria, selectedMotivo]);

  const totalAnomaliasCount = filteredWorkers.reduce((acc, w) => acc + w.anomalias.length, 0);
  const totalAusencias = filteredWorkers.reduce((acc, w) => acc + w.anomalias.filter(a => getAnomaliaCategoria(a) === 'Ausencia').length, 0);
  const totalIncompletas = filteredWorkers.reduce((acc, w) => acc + w.anomalias.filter(a => getAnomaliaCategoria(a) === 'Falta marca').length, 0);
  const totalFueraDeTurno = filteredWorkers.reduce((acc, w) => acc + w.anomalias.filter(a => getAnomaliaCategoria(a) === 'Fuera de turno').length, 0);

  const dateModeOptions = [
    { label: 'Mes Completo', value: 'mes' },
    { label: 'Primera Quincena', value: 'quincena_1' },
    { label: 'Segunda Quincena', value: 'quincena_2' },
    { label: 'Personalizada', value: 'personalizado' }
  ];

  const handleOpenJustify = (workerNo: string, workerName: string, anom: Anomalia) => {
    setJustifyingItem({ workerNo, workerName, anomalia: anom });
    setNewTipo(anom.tipo || 'Falta injustificada');
    setNewDescripcion(anom.descripcion || '');
  };

  const handleSaveJustification = async () => {
    if (!justifyingItem) return;
    const { workerNo, anomalia } = justifyingItem;
    
    try {
      const res = await apiFetch('/api/attendance/incidents/justify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workerNo,
          date: anomalia.fecha,
          tipo: newTipo,
          descripcion: newDescripcion
        })
      });
      if (res.ok) {
        await fetchIncidents();
        setJustifyingItem(null);
        setSuccessMessage('El cambio quedó realizado');
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err) {
      console.error('Failed to save justification on server:', err);
    }
  };

  const currentJustificationOptions = justifyingItem ? getJustificationOptionsForAnomalia(justifyingItem.anomalia) : [];

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-sm font-bold shadow-sm flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* 1. Panel de Métricas de Anomalías */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="metrics-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <p className="metric-title text-xs font-bold text-slate-500 uppercase tracking-wider"><Icon name="event_note" /> Total Incidencias</p>
            <p className="metric-value text-lg font-extrabold text-slate-900">{totalAnomaliasCount}</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
            <p className="metric-title text-xs font-bold text-rose-600 uppercase tracking-wider"><Icon name="person_off" /> Ausencias</p>
            <p className="metric-value text-lg font-extrabold text-rose-900">{totalAusencias}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
            <p className="metric-title text-xs font-bold text-amber-600 uppercase tracking-wider"><Icon name="schedule_missing" /> Faltas Marca</p>
            <p className="metric-value text-lg font-extrabold text-amber-900">{totalIncompletas}</p>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl">
            <p className="metric-title text-xs font-bold text-purple-600 uppercase tracking-wider"><Icon name="swap_horiz" /> Fuera de Turno</p>
            <p className="metric-value text-lg font-extrabold text-purple-900">{totalFueraDeTurno}</p>
          </div>
        </div>
      </div>

      {/* 2. Filtros y Búsqueda */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="controls-bar flex flex-wrap items-center gap-4">
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
              <Icon name="search" className="asist-search-icon" />
            </div>
          </div>

          <div className="w-[200px]">
            <CustomDropdown
              label="Tipo de Incidencia:"
              value={selectedCategoria}
              onChange={handleCategoriaChange}
              options={[
                { label: 'Todas las incidencias', value: 'ALL' },
                { label: 'Ausencia', value: 'Ausencia' },
                { label: 'Falta marca', value: 'Falta marca' },
                { label: 'Fuera de turno', value: 'Fuera de turno' }
              ]}
              width="w-full"
            />
          </div>

          <div className="w-[220px]">
            <CustomDropdown
              label="Motivo / Justificación:"
              value={selectedMotivo}
              onChange={setSelectedMotivo}
              options={getMotivoOptionsForCategoria(selectedCategoria)}
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

      {/* 3. Tabla Agrupada por Trabajador */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
        <div className="table-responsive">
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
                <th className="p-3 w-1/2">Motivo / Incidencia (Click para justificar)</th>
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
                        <button
                          type="button"
                          onClick={canEdit ? () => handleOpenJustify(worker.no, worker.nombre, anom) : undefined}
                          className={`inline-block text-center w-48 px-3 py-1 rounded-full text-sm font-bold shadow-sm ${canEdit ? 'cursor-pointer transition transform hover:scale-105' : 'cursor-default'} ${getBadgeStyle(anom.tipo, anom.categoria)}`}
                          title={anom.descripcion ? `📝 Nota: ${anom.descripcion}` : (canEdit ? `Click para justificar / clasificar motivo (${anom.tipo})` : anom.tipo)}
                        >
                          {anom.tipo}
                        </button>
                        {anom.descripcion && (
                          <span className="ml-2 text-xs text-slate-500 italic block mt-0.5">
                            Nota: {anom.descripcion}
                          </span>
                        )}
                        {anom.marcas && anom.marcas.length > 0 && (
                          <span className="text-xs font-semibold text-purple-700 block mt-1">
                            <Icon name="schedule" /> Marcas: {anom.marcas.join(', ')}
                          </span>
                        )}
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
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div className="text-xs font-bold text-slate-600">
          Mostrando {paginatedWorkers.length} de {sortedAndFilteredWorkers.length} trabajadores con anomalías detectadas
        </div>
        <div className="pagination-bar flex items-center gap-2">
          <button
            type="button"
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
            type="button"
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1 bg-white border border-slate-300 rounded text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            Siguiente
          </button>
        </div>
      </div>

      {/* Justification Modal */}
      {justifyingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base"><Icon name="fact_check" /> Justificar / Clasificar Incidencia</h3>
                <p className="text-xs text-slate-400">{justifyingItem.workerName} (No. {justifyingItem.workerNo})</p>
              </div>
              <button
                type="button"
                onClick={() => setJustifyingItem(null)}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Fecha y Tipo Original:
                </label>
                <p className="text-sm font-semibold text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  {formatDateToDDMMAAAA(justifyingItem.anomalia.fecha)} — <span className="font-bold text-slate-900">{justifyingItem.anomalia.tipo}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Motivo Permitido (Enlazado al tipo de incidencia):
                </label>
                <select
                  value={newTipo}
                  onChange={(e) => setNewTipo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
                >
                  {currentJustificationOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Nota / Descripción Aclaratoria (Opcional):
                </label>
                <textarea
                  value={newDescripcion}
                  onChange={(e) => setNewDescripcion(e.target.value)}
                  placeholder="Ej. Folio IMSS #12345, autorizado por Gerencia, etc."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 resize-none placeholder:text-slate-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setJustifyingItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveJustification}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/25 cursor-pointer transition"
                >
                  Guardar Justificación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
