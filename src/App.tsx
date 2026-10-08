import React, { useEffect, useState, useMemo } from 'react';
import './App.css';

const API_BASE = `http://${window.location.hostname}:4000`;

interface WorkerDaySummary {
  no: string;
  nombre: string;
  marca1: string | null;
  marca2: string | null;
  entradaMañana?: string | null;
  salidaMañana?: string | null;
  entradaTarde?: string | null;
  salidaTarde?: string | null;
  turno: string;
}

interface ShiftRule {
  id: number;
  type: 'total' | 'parcial';
  turno: string;
  start_date: string;
  end_date?: string;
  first_mark_direction?: 'entrada' | 'salida';
}

interface UniqueWorker {
  no: string;
  nombre: string;
  defaultTurno: string;
  rules: ShiftRule[];
}

interface DayConfig {
  hours: number | string;
  markDirection: 'entrada' | 'salida';
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getTurnoOnDate(defaultTurno: string, rules: ShiftRule[] | undefined, dateStr: string): string {
  if (!rules || rules.length === 0) return defaultTurno;
  let resolved = defaultTurno;
  const sorted = [...rules].sort((a, b) => a.start_date.localeCompare(b.start_date));

  for (const rule of sorted) {
    if (rule.type === 'total') {
      if (dateStr >= rule.start_date) {
        resolved = rule.turno;
      }
    } else if (rule.type === 'parcial') {
      const end = rule.end_date || rule.start_date;
      if (dateStr >= rule.start_date && dateStr <= end) {
        resolved = rule.turno;
      }
    }
  }
  return resolved;
}

interface VisualDatePickerProps {
  label: string;
  value: string;
  onChange: (dateStr: string) => void;
  minDate?: string;
}

function VisualDatePicker({ label, value, onChange, minDate }: VisualDatePickerProps) {
  const currentDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState<number>(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(currentDate.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const daysGrid = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    daysGrid.push(`${viewYear}-${mStr}-${dStr}`);
  }

  const todayStr = getTodayDateString();

  return (
    <div className="visual-date-picker">
      <label className="vdp-label">{label}</label>
      <div className="vdp-header-bar">
        <span className="vdp-selected-display">📅 {formatDisplayDate(value || todayStr)}</span>
        <button
          type="button"
          className="vdp-today-btn"
          onClick={() => {
            onChange(todayStr);
            const d = new Date(todayStr + 'T00:00:00');
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
          }}
        >
          Hoy
        </button>
      </div>

      <div className="vdp-calendar-card">
        <div className="vdp-cal-nav">
          <button type="button" onClick={handlePrevMonth} title="Mes anterior">◀</button>
          <span className="vdp-cal-title">{monthNames[viewMonth]} {viewYear}</span>
          <button type="button" onClick={handleNextMonth} title="Mes siguiente">▶</button>
        </div>

        <div className="vdp-weekdays">
          <span>Do</span><span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sá</span>
        </div>

        <div className="vdp-days-grid">
          {daysGrid.map((dateStr, idx) => {
            if (!dateStr) {
              return <div key={`empty-${idx}`} className="vdp-day empty"></div>;
            }
            const isSelected = dateStr === value;
            const isToday = dateStr === todayStr;
            const isDisabled = minDate ? dateStr < minDate : false;

            return (
              <button
                key={dateStr}
                type="button"
                disabled={isDisabled}
                className={`vdp-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && onChange(dateStr)}
              >
                {parseInt(dateStr.split('-')[2], 10)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const WEEKDAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function App() {
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // App data state from backend
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [workerSummaries, setWorkerSummaries] = useState<WorkerDaySummary[]>([]);
  const [uniqueWorkers, setUniqueWorkers] = useState<UniqueWorker[]>([]);

  // Asistencias state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Trabajadores state
  const [workerSearchTerm, setWorkerSearchTerm] = useState<string>('');
  const [selectedTurno, setSelectedTurno] = useState<string>('ALL');
  const [workerCurrentPage, setWorkerCurrentPage] = useState<number>(1);

  // Turnos (Calendar) state & shift templates from backend
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('2025-10');
  const [selectedShiftTemplate, setSelectedShiftTemplate] = useState<string>('');
  const [shiftTemplates, setShiftTemplates] = useState<Record<string, DayConfig[]>>({});

  // Create new shift modal state
  const [isCreatingShift, setIsCreatingShift] = useState<boolean>(false);
  const [newShiftName, setNewShiftName] = useState<string>('');

  // Edit Day Modal state (click on day card)
  const [editingDay, setEditingDay] = useState<{ dayIndex: number; dayNum: number; config: DayConfig } | null>(null);
  const [modalDayHours, setModalDayHours] = useState<string>('');
  const [modalMarkDirection, setModalMarkDirection] = useState<'entrada' | 'salida'>('entrada');

  // Edit Worker Modal state
  const [editingWorker, setEditingWorker] = useState<UniqueWorker | null>(null);
  const [newTurnoValue, setNewTurnoValue] = useState<string>('Matutino');
  const [editType, setEditType] = useState<'total' | 'parcial'>('total');
  const [ruleStartDate, setRuleStartDate] = useState<string>('');
  const [ruleEndDate, setRuleEndDate] = useState<string>('');
  const [firstMarkDirection, setFirstMarkDirection] = useState<'entrada' | 'salida'>('entrada');

  const [currentView, setCurrentView] = useState<'asistencias' | 'trabajadores' | 'turnos'>('asistencias');
  const pageSize = 15;

  // Fetch shift templates from backend
  const fetchShiftTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/shift-templates`);
      const data = await res.json();
      setShiftTemplates(data);
      const keys = Object.keys(data);
      if (keys.length > 0 && (!selectedShiftTemplate || !data[selectedShiftTemplate])) {
        setSelectedShiftTemplate(keys[0]);
      }
    } catch (err) {
      console.error('Error fetching shift templates:', err);
    }
  };

  // Fetch initial state / check if data exists
  const refreshData = async (dateToSelect?: string) => {
    try {
      const datesRes = await fetch(`${API_BASE}/api/dates`);
      const dates: string[] = await datesRes.json();

      if (dates.length > 0) {
        setIsDataLoaded(true);
        setAvailableDates(dates);
        const targetDate = dateToSelect || selectedDate || dates[0];
        setSelectedDate(targetDate);
        setSelectedMonthYear(targetDate.substring(0, 7)); // e.g. YYYY-MM

        // Fetch workers
        const workersRes = await fetch(`${API_BASE}/api/workers`);
        const workers = await workersRes.json();
        setUniqueWorkers(workers);

        // Fetch attendance for targetDate
        const attRes = await fetch(`${API_BASE}/api/attendance?date=${targetDate}`);
        const attendance = await attRes.json();
        setWorkerSummaries(attendance);

        // Fetch shift templates
        await fetchShiftTemplates();
      } else {
        setIsDataLoaded(false);
      }
    } catch (err: any) {
      setError('Error al conectar con el servidor backend: ' + err.message);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // When selectedDate changes, fetch attendance for that date
  useEffect(() => {
    if (!selectedDate || !isDataLoaded) return;
    fetch(`${API_BASE}/api/attendance?date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => setWorkerSummaries(data))
      .catch((err) => console.error(err));
  }, [selectedDate, isDataLoaded]);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al subir el archivo');

      await refreshData();
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Extract unique turnos for filtering
  const availableTurnos = useMemo(() => {
    const turnosSet = new Set<string>();
    uniqueWorkers.forEach((w) => {
      const currentTurno = selectedDate ? getTurnoOnDate(w.defaultTurno, w.rules, selectedDate) : w.defaultTurno;
      turnosSet.add(currentTurno);
    });
    Object.keys(shiftTemplates).forEach((t) => turnosSet.add(t));
    return Array.from(turnosSet);
  }, [uniqueWorkers, shiftTemplates, selectedDate]);

  // Filter summaries for Asistencias
  const filteredSummaries = useMemo(() => {
    return workerSummaries.filter((w) => {
      const name = w.nombre.toLowerCase();
      const no = w.no.toLowerCase();
      const query = searchTerm.toLowerCase();
      return name.includes(query) || no.includes(query);
    });
  }, [workerSummaries, searchTerm]);

  // Filter workers for Trabajadores view
  const filteredWorkers = useMemo(() => {
    return uniqueWorkers.filter((w) => {
      const name = w.nombre.toLowerCase();
      const no = w.no.toLowerCase();
      const query = workerSearchTerm.toLowerCase();
      const currentTurno = selectedDate ? getTurnoOnDate(w.defaultTurno, w.rules, selectedDate) : w.defaultTurno;

      const matchesSearch = name.includes(query) || no.includes(query);
      const matchesTurno = selectedTurno === 'ALL' || currentTurno === selectedTurno;

      return matchesSearch && matchesTurno;
    });
  }, [uniqueWorkers, workerSearchTerm, selectedTurno, selectedDate]);

  // Pagination for Asistencias
  const totalPages = Math.ceil(filteredSummaries.length / pageSize) || 1;
  const paginatedSummaries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSummaries.slice(start, start + pageSize);
  }, [filteredSummaries, currentPage, pageSize]);

  // Pagination for Trabajadores
  const workerTotalPages = Math.ceil(filteredWorkers.length / pageSize) || 1;
  const paginatedWorkers = useMemo(() => {
    const start = (workerCurrentPage - 1) * pageSize;
    return filteredWorkers.slice(start, start + pageSize);
  }, [filteredWorkers, workerCurrentPage, pageSize]);

  const handleSaveTurnoRule = async () => {
    if (!editingWorker || !ruleStartDate) return;

    try {
      const res = await fetch(`${API_BASE}/api/workers/${editingWorker.no}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editType,
          turno: newTurnoValue,
          startDate: ruleStartDate,
          endDate: editType === 'parcial' ? (ruleEndDate || ruleStartDate) : undefined,
          first_mark_direction: firstMarkDirection,
        }),
      });

      if (!res.ok) throw new Error('Error al guardar la regla');

      await refreshData(selectedDate);
      setEditingWorker(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar la regla');
      await refreshData(selectedDate);
      if (editingWorker) {
        setEditingWorker({
          ...editingWorker,
          rules: editingWorker.rules.filter((r) => r.id !== ruleId),
        });
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Save edited day and persist template to backend
  const handleSaveDayModal = async () => {
    if (!editingDay) return;
    const parsedHours = modalDayHours === 'P' || modalDayHours === 'p' ? 'P' : parseFloat(modalDayHours) || 0;

    const currentDays = [...(shiftTemplates[selectedShiftTemplate] || [])];
    currentDays[editingDay.dayIndex] = {
      hours: parsedHours,
      markDirection: modalMarkDirection,
    };

    try {
      const res = await fetch(`${API_BASE}/api/shift-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedShiftTemplate,
          days: currentDays,
        }),
      });

      if (!res.ok) throw new Error('Error al guardar en el servidor');

      await fetchShiftTemplates();
      setEditingDay(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Create new shift template
  const handleCreateNewShift = async () => {
    if (!newShiftName.trim()) return;
    const name = newShiftName.trim().toUpperCase();

    // Default 31 days with 8 hours
    const defaultDays: DayConfig[] = Array.from({ length: 31 }, () => ({
      hours: 8,
      markDirection: 'entrada',
    }));

    try {
      const res = await fetch(`${API_BASE}/api/shift-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          days: defaultDays,
        }),
      });

      if (!res.ok) throw new Error('Error al crear el turno');

      await fetchShiftTemplates();
      setSelectedShiftTemplate(name);
      setNewShiftName('');
      setIsCreatingShift(false);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  // Calendar card grid calculations for "Turnos" view with 2 decimals rounding
  const calendarData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonthYear.split('-');
    const year = parseInt(yearStr, 10) || 2025;
    const month = parseInt(monthStr, 10) || 10;
    const daysInMonth = new Date(year, month, 0).getDate(); // 28, 29, 30, or 31

    const template = shiftTemplates[selectedShiftTemplate] || [];

    let hours1_15 = 0;
    let hours16_31 = 0;

    const days = [];
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dayIndex = template.length > 0 ? (dayNum - 1) % template.length : 0;
      const dayConfig = template[dayIndex] || { hours: 0, markDirection: 'entrada' };
      const hoursVal = dayConfig.hours;
      const numericVal = typeof hoursVal === 'number' ? hoursVal : parseFloat(hoursVal) || 0;

      if (typeof hoursVal === 'number' || !isNaN(numericVal)) {
        if (dayNum <= 15) hours1_15 += numericVal;
        else hours16_31 += numericVal;
      }
      const dateObj = new Date(year, month - 1, dayNum);
      const wDayIdx = dateObj.getDay(); // 0-6
      const wDayName = WEEKDAY_NAMES[wDayIdx];

      days.push({
        dayIndex,
        dayNum,
        wDayName,
        hours: typeof hoursVal === 'number' ? hoursVal.toFixed(2) : hoursVal,
        markDirection: dayConfig.markDirection || 'entrada',
      });
    }

    const totalMonthHours = hours1_15 + hours16_31;

    return {
      daysInMonth,
      days,
      hours1_15: hours1_15.toFixed(2),
      hours16_31: hours16_31.toFixed(2),
      totalMonthHours: totalMonthHours.toFixed(2),
    };
  }, [selectedMonthYear, selectedShiftTemplate, shiftTemplates]);

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">🗄️</span>
          <span className="brand-title">Sistema de Nómina (Base de Datos SQLite)</span>
        </div>
        {isDataLoaded && (
          <ul className="navbar-nav">
            <li>
              <button
                className={`nav-link ${currentView === 'asistencias' ? 'active' : ''}`}
                onClick={() => setCurrentView('asistencias')}
              >
                Asistencias
              </button>
            </li>
            <li>
              <button
                className={`nav-link ${currentView === 'trabajadores' ? 'active' : ''}`}
                onClick={() => setCurrentView('trabajadores')}
              >
                Trabajadores
              </button>
            </li>
            <li>
              <button
                className={`nav-link ${currentView === 'turnos' ? 'active' : ''}`}
                onClick={() => setCurrentView('turnos')}
              >
                Turnos
              </button>
            </li>
            <li>
              <label className="nav-upload-btn" title="Cargar otro archivo Excel">
                📁 Cambiar Archivo
                <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} style={{ display: 'none' }} />
              </label>
            </li>
          </ul>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="nomina-container">
        {error && <div className="error-state">{error}</div>}
        {loading && <div className="loading-state">Procesando y guardando en base de datos...</div>}

        {!isDataLoaded && !loading && (
          <div className="upload-screen">
            <div className="upload-card">
              <h2>📁 Base de Datos de Asistencia</h2>
              <p>Sube tu archivo Excel (.xls o .xlsx). Los datos se guardarán de forma persistente en la base de datos SQLite del servidor.</p>
              <label className="upload-dropzone">
                <span>📂 Seleccionar Archivo Excel</span>
                <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        )}

        {isDataLoaded && !loading && currentView === 'asistencias' && (
          <>
            {/* Metrics Summary Cards */}
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
                <h3>Filtrados</h3>
                <p className="metric-value">{filteredSummaries.length}</p>
              </div>
            </div>

            {/* Controls: Date Selector & Search */}
            <div className="controls-bar" style={{ justifyContent: 'flex-start', gap: '2rem' }}>
              <div className="filter-box">
                <label htmlFor="date-select">📅 Día:</label>
                <select
                  id="date-select"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  {availableDates.map((dateStr) => (
                    <option key={dateStr} value={dateStr}>
                      {formatDisplayDate(dateStr)} {dateStr === availableDates[0] ? ' (Primero)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="search-box">
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

            {/* Data Table */}
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
                    paginatedSummaries.map((worker, idx) => (
                      <tr key={idx}>
                        <td>{worker.no || '-'}</td>
                        <td className="font-weight-bold">{worker.nombre}</td>
                        <td>
                          <span className="badge-turno">{worker.turno}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
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
                            {!worker.entradaMañana && !worker.entradaTarde && (
                              <span>{formatTime(worker.marca1)}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
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
                            {!worker.salidaMañana && !worker.salidaTarde && (
                              <span className="badge-muted">{formatTime(worker.marca2)}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
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

            {/* Pagination */}
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
        )}

        {isDataLoaded && !loading && currentView === 'trabajadores' && (
          <>
            {/* Metrics Summary Cards */}
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

            {/* Controls: Search & Turno Filter */}
            <div className="controls-bar" style={{ justifyContent: 'flex-start', gap: '2rem' }}>
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

            {/* Data Table */}
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
                          onClick={() => {
                            setEditingWorker(worker);
                            setNewTurnoValue(currentTurno);
                            setEditType('total');
                            const todayStr = getTodayDateString();
                            setRuleStartDate(todayStr);
                            setRuleEndDate(todayStr);
                            setFirstMarkDirection('entrada');
                          }}
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

            {/* Pagination */}
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
        )}

        {isDataLoaded && !loading && currentView === 'turnos' && (
          <div className="turnos-view">
            <h2>📅 Calendario de Turnos y Horas Trabajadas (Base de Datos SQLite)</h2>
            <p className="hint-text">💡 Haz clic directamente en cualquier tarjeta de día para editar sus horas o configurar su marcaje. También puedes crear nuevos turnos.</p>

            {/* Selectors & Create Button */}
            <div className="controls-bar" style={{ justifyContent: 'space-between', gap: '2rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="filter-box">
                  <label htmlFor="month-select">📅 Mes:</label>
                  <input
                    id="month-select"
                    type="month"
                    value={selectedMonthYear}
                    onChange={(e) => setSelectedMonthYear(e.target.value)}
                    className="month-input"
                  />
                </div>

                <div className="filter-box">
                  <label htmlFor="shift-template-select">⚙️ Turno:</label>
                  <select
                    id="shift-template-select"
                    value={selectedShiftTemplate}
                    onChange={(e) => setSelectedShiftTemplate(e.target.value)}
                  >
                    {Object.keys(shiftTemplates).map((templateKey) => (
                      <option key={templateKey} value={templateKey}>
                        {templateKey}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <button
                  className="btn-save"
                  onClick={() => setIsCreatingShift(true)}
                >
                  ➕ Crear Nuevo Turno
                </button>
              </div>
            </div>

            {/* Summary Metrics for Calendar */}
            <div className="metrics-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="metric-card">
                <h3>Horas (Días 1 - 15: 15 días)</h3>
                <p className="metric-value">{calendarData.hours1_15} hrs</p>
              </div>
              <div className="metric-card">
                <h3>Horas (Días 16 - {calendarData.daysInMonth}: {calendarData.daysInMonth - 15} días)</h3>
                <p className="metric-value">{calendarData.hours16_31} hrs</p>
              </div>
              <div className="metric-card">
                <h3>Total Horas al Mes ({calendarData.daysInMonth} días)</h3>
                <p className="metric-value" style={{ color: '#4ade80' }}>{calendarData.totalMonthHours} hrs</p>
              </div>
            </div>

            {/* Legend for visual states */}
            <div className="legend-bar">
              <span className="legend-item"><span className="legend-dot dot-entrada"></span> 🟢 1ra Marca: Entrada</span>
              <span className="legend-item"><span className="legend-dot dot-salida"></span> 🌙 1ra Marca: Salida (Nocturno)</span>
              <span className="legend-item"><span className="legend-dot dot-rest"></span> 🛌 Día de Descanso (P)</span>
            </div>

            {/* Calendar Card Grid */}
            <div className="calendar-grid">
              {calendarData.days.map((d) => {
                const isRest = d.hours === 'P' || d.hours === 'p';
                const isSalida = d.markDirection === 'salida';

                let cardClass = 'calendar-day-card clickable-card';
                if (isRest) cardClass += ' rest-day';
                else if (isSalida) cardClass += ' salida-day';
                else cardClass += ' entrada-day';

                return (
                  <div
                    key={d.dayNum}
                    className={cardClass}
                    onClick={() => {
                      setEditingDay({ dayIndex: d.dayIndex, dayNum: d.dayNum, config: { hours: d.hours, markDirection: d.markDirection } });
                      setModalDayHours(String(d.hours));
                      setModalMarkDirection(d.markDirection);
                    }}
                    title="Haz clic para editar este día"
                  >
                    <div className="card-day-header">
                      <span className="day-number">{d.dayNum}</span>
                      <span className="weekday-name">{d.wDayName}</span>
                    </div>
                    <div className="card-divider"></div>
                    <div className="card-day-body">
                      {isRest ? (
                        <span className="badge-rest">Descanso (P)</span>
                      ) : (
                        <div className="card-hours-container">
                          <span className="badge-hours">{d.hours} hrs</span>
                          <span className={`badge-mark-dir ${isSalida ? 'dir-salida' : 'dir-entrada'}`}>
                            {isSalida ? '🌙 Salida' : '🟢 Entrada'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Create New Shift Modal */}
      {isCreatingShift && (
        <div className="modal-backdrop" onClick={() => setIsCreatingShift(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Nuevo Turno</h2>
            <p className="modal-subtitle">Introduce el nombre del nuevo turno (se guardará en la base de datos SQLite).</p>

            <div className="modal-field">
              <label htmlFor="new-shift-name">Nombre del Turno:</label>
              <input
                id="new-shift-name"
                type="text"
                className="modal-text-input"
                value={newShiftName}
                onChange={(e) => setNewShiftName(e.target.value)}
                placeholder="Ej. TURNO ROTATIVO 5"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setIsCreatingShift(false)}>
                Cancelar
              </button>
              <button className="btn-save" onClick={handleCreateNewShift}>
                Crear Turno
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Day Modal */}
      {editingDay && (
        <div className="modal-backdrop" onClick={() => setEditingDay(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Editar Día {editingDay.dayNum}</h2>
            <p className="modal-subtitle">
              Turno: <strong>{selectedShiftTemplate}</strong> (BD SQLite)
            </p>

            <div className="modal-field">
              <label htmlFor="modal-day-hours">Horas trabajadas (o 'P' para descanso):</label>
              <input
                id="modal-day-hours"
                type="text"
                className="modal-text-input"
                value={modalDayHours}
                onChange={(e) => setModalDayHours(e.target.value)}
                placeholder="Ej. 12 o P"
              />
            </div>

            <div className="modal-field">
              <label htmlFor="modal-day-mark-dir">Dirección de la 1era Marca (Turnos Rotativos):</label>
              <select
                id="modal-day-mark-dir"
                value={modalMarkDirection}
                onChange={(e) => setModalMarkDirection(e.target.value as 'entrada' | 'salida')}
              >
                <option value="entrada">🟢 Entrada (Check-in)</option>
                <option value="salida">🌙 Salida (Check-out - Cruza medianoche)</option>
              </select>
              <small className="modal-hint">
                Define si el primer marcaje del día es una Entrada o una Salida para evitar confusión en turnos nocturnos.
              </small>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEditingDay(null)}>
                Cancelar
              </button>
              <button className="btn-save" onClick={handleSaveDayModal}>
                Actualizar en BD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Worker Modal */}
      {editingWorker && (
        <div className="modal-backdrop" onClick={() => setEditingWorker(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Configurar Turno (BD)</h2>
            <p className="modal-subtitle">
              Trabajador: <strong>{editingWorker.nombre}</strong> (No. {editingWorker.no})
            </p>

            <div className="modal-field">
              <label htmlFor="modal-type">Tipo de cambio:</label>
              <select
                id="modal-type"
                value={editType}
                onChange={(e) => setEditType(e.target.value as 'total' | 'parcial')}
              >
                <option value="total">Total (Fijo / Permanente desde la fecha)</option>
                <option value="parcial">Parcial (Temporal con fecha de inicio y fin)</option>
              </select>
              <small className="modal-hint">
                {editType === 'total'
                  ? 'El turno cambiará a partir de la fecha de inicio seleccionada en adelante.'
                  : 'El turno cambiará temporalmente durante el rango de fechas seleccionado (al finalizar, volverá al turno anterior).'}
              </small>
            </div>

            <div className="modal-field">
              <label htmlFor="modal-turno">Nuevo Turno:</label>
              <select
                id="modal-turno"
                value={newTurnoValue}
                onChange={(e) => setNewTurnoValue(e.target.value)}
              >
                {Object.keys(shiftTemplates).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <label htmlFor="modal-mark-dir">Dirección de la 1era Marca (Turnos Nocturnos / Rotativos):</label>
              <select
                id="modal-mark-dir"
                value={firstMarkDirection}
                onChange={(e) => setFirstMarkDirection(e.target.value as 'entrada' | 'salida')}
              >
                <option value="entrada">Entrada (Check-in)</option>
                <option value="salida">Salida (Check-out - Cruza medianoche)</option>
              </select>
              <small className="modal-hint">
                Define si el primer marcaje del día corresponde a una Entrada o a una Salida (útil para turnos que entran de noche y salen por la mañana).
              </small>
            </div>

            <VisualDatePicker
              label="Fecha de inicio:"
              value={ruleStartDate}
              onChange={(dateStr) => {
                setRuleStartDate(dateStr);
                if (dateStr > ruleEndDate) {
                  setRuleEndDate(dateStr);
                }
              }}
            />

            {editType === 'parcial' && (
              <VisualDatePicker
                label="Fecha de fin:"
                value={ruleEndDate}
                minDate={ruleStartDate}
                onChange={(dateStr) => setRuleEndDate(dateStr)}
              />
            )}

            {editingWorker.rules.length > 0 && (
              <div className="modal-rules-list">
                <p><strong>Reglas actuales en BD:</strong></p>
                <ul>
                  {editingWorker.rules.map((r) => (
                    <li key={r.id}>
                      <span>
                        [{r.type.toUpperCase()}] <strong>{r.turno}</strong> ({formatDisplayDate(r.start_date)}
                        {r.end_date && r.end_date !== r.start_date ? ` al ${formatDisplayDate(r.end_date)}` : ''})
                        {r.first_mark_direction ? ` [1ra Marca: ${r.first_mark_direction}]` : ''}
                      </span>
                      <button
                        className="btn-delete-rule"
                        onClick={() => handleDeleteRule(r.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEditingWorker(null)}>
                Cancelar
              </button>
              <button className="btn-save" onClick={handleSaveTurnoRule}>
                Guardar en BD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
