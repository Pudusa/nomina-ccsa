import React, { useEffect, useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import './App.css';
import type { WorkerDaySummary, UniqueWorker, DayConfig, IncidentItem } from './types';
import { getTodayDateString, getTurnoOnDate, WEEKDAY_NAMES } from './utils/dateUtils';
import { API_BASE } from './constants';
import { AsistenciasView } from './components/views/AsistenciasView';
import { TrabajadoresView } from './components/views/TrabajadoresView';
import { TurnosView } from './components/views/TurnosView';
import { IncidenciasView } from './components/views/IncidenciasView';
import { CreateShiftModal } from './components/modals/CreateShiftModal';
import { EditDayModal } from './components/modals/EditDayModal';
import { EditWorkerModal } from './components/modals/EditWorkerModal';

export default function App() {
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [workerSummaries, setWorkerSummaries] = useState<WorkerDaySummary[]>([]);
  const [uniqueWorkers, setUniqueWorkers] = useState<UniqueWorker[]>([]);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedAttendanceShiftFilter, setSelectedAttendanceShiftFilter] = useState<string>('ALL');
  const [selectedAttendanceStatusFilter, setSelectedAttendanceStatusFilter] = useState<string>('ALL');

  const [workerSearchTerm, setWorkerSearchTerm] = useState<string>('');
  const [selectedTurno, setSelectedTurno] = useState<string>('ALL');
  const [workerCurrentPage, setWorkerCurrentPage] = useState<number>(1);

  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [selectedShiftTemplate, setSelectedShiftTemplate] = useState<string>('');
  const [shiftTemplates, setShiftTemplates] = useState<Record<string, DayConfig[]>>({});

  const [isCreatingShift, setIsCreatingShift] = useState<boolean>(false);
  const [newShiftName, setNewShiftName] = useState<string>('');

  const [editingDay, setEditingDay] = useState<{ dayIndex: number; dayNum: number; config: DayConfig } | null>(null);
  const [modalDayHours, setModalDayHours] = useState<string>('');
  const [modalMarkDirection, setModalMarkDirection] = useState<'entrada' | 'salida'>('entrada');

  const [editingWorker, setEditingWorker] = useState<UniqueWorker | null>(null);
  const [newTurnoValue, setNewTurnoValue] = useState<string>('Matutino');
  const [editType, setEditType] = useState<'total' | 'parcial'>('total');
  const [ruleStartDate, setRuleStartDate] = useState<string>('');
  const [ruleEndDate, setRuleEndDate] = useState<string>('');

  const [currentView, setCurrentView] = useState<'asistencias' | 'trabajadores' | 'turnos' | 'incidencias'>('asistencias');

  // Estados para la vista de Incidencias
  const [incidentMonthYear, setIncidentMonthYear] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });
  const [incidentPeriod, setIncidentPeriod] = useState<'full' | 'q1' | 'q2'>('full');
  const [incidentTypeFilter, setIncidentTypeFilter] = useState<string>('ALL');
  const [incidentSearchTerm, setIncidentSearchTerm] = useState<string>('');
  const [incidentShiftFilter, setIncidentShiftFilter] = useState<string>('ALL');
  const [incidentCurrentPage, setIncidentCurrentPage] = useState<number>(1);
  const [incidentsList, setIncidentsList] = useState<IncidentItem[]>([]);
  const pageSize = 15;

  // Efecto para calcular incidencias (ausencias) según el mes y periodo (mes completo o quincena)
  useEffect(() => {
    if (!isDataLoaded || !incidentMonthYear || currentView !== 'incidencias') return;

    const fetchIncidentsForRange = async () => {
      const [yearStr, monthStr] = incidentMonthYear.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const daysInMonth = new Date(year, month, 0).getDate();

      let startDay = 1;
      let endDay = daysInMonth;

      if (incidentPeriod === 'q1') {
        startDay = 1;
        endDay = 15;
      } else if (incidentPeriod === 'q2') {
        startDay = 16;
        endDay = daysInMonth;
      }

      const dateStrs: string[] = [];
      for (let d = startDay; d <= endDay; d++) {
        const dStr = String(d).padStart(2, '0');
        dateStrs.push(`${incidentMonthYear}-${dStr}`);
      }

      let currentShiftTemplates = shiftTemplates;
      try {
        const res = await fetch(`${API_BASE}/api/shift-templates?year_month=${incidentMonthYear}`);
        const data = await res.json();
        currentShiftTemplates = data;
      } catch (e) {}

      const allIncidents: IncidentItem[] = [];

      const promises = dateStrs.map(async (dateStr) => {
        try {
          const res = await fetch(`${API_BASE}/api/attendance?date=${dateStr}`);
          const summaries: WorkerDaySummary[] = await res.json();
          
          const dateObj = new Date(dateStr + 'T00:00:00');
          const dayNum = dateObj.getDate();
          const dayIndex = (dayNum - 1) % 31;

          summaries.forEach((w) => {
            const hasMark = Boolean(
              w.marca1 ||
              w.marca2 ||
              w.entradaMañana ||
              w.salidaMañana ||
              w.entradaTarde ||
              w.salidaTarde
            );

            // Verificar si es día de descanso (P)
            let isRestDay = false;
            const template = currentShiftTemplates[w.turno];
            if (template && Array.isArray(template) && template[dayIndex]) {
              const hours = template[dayIndex].hours;
              if (String(hours).toLowerCase() === 'p') {
                isRestDay = true;
              }
            }

            // Si no tiene marca y no es día de descanso, es una ausencia
            if (!hasMark && !isRestDay) {
              allIncidents.push({
                id: `${dateStr}-${w.no}`,
                date: dateStr,
                workerNo: w.no,
                workerName: w.nombre || 'Desconocido',
                turno: w.turno || 'Sin turno',
                type: 'Ausente',
                description: 'Sin registros de asistencia en jornada laboral',
              });
            }
          });
        } catch (err) {
          console.error(`Error al obtener asistencia para ${dateStr}:`, err);
        }
      });

      await Promise.all(promises);

      // Ordenar por fecha descendente y número de empleado
      allIncidents.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return Number(a.workerNo) - Number(b.workerNo) || a.workerNo.localeCompare(b.workerNo);
      });

      setIncidentsList(allIncidents);
    };

    fetchIncidentsForRange();
  }, [incidentMonthYear, incidentPeriod, isDataLoaded, currentView, shiftTemplates]);

  const filteredIncidents = useMemo(() => {
    return incidentsList.filter((inc) => {
      if (incidentTypeFilter === 'ABSENT' && inc.type !== 'Ausente') return false;
      if (incidentShiftFilter !== 'ALL' && inc.turno !== incidentShiftFilter) return false;
      if (incidentSearchTerm.trim()) {
        const term = incidentSearchTerm.toLowerCase();
        const matchName = inc.workerName.toLowerCase().includes(term);
        const matchNo = inc.workerNo.toLowerCase().includes(term);
        if (!matchName && !matchNo) return false;
      }
      return true;
    });
  }, [incidentsList, incidentTypeFilter, incidentShiftFilter, incidentSearchTerm]);

  const incidentTotalPages = Math.ceil(filteredIncidents.length / pageSize) || 1;
  const paginatedIncidents = useMemo(() => {
    const start = (incidentCurrentPage - 1) * pageSize;
    return filteredIncidents.slice(start, start + pageSize);
  }, [filteredIncidents, incidentCurrentPage, pageSize]);

  const absentIncidentsCount = useMemo(() => {
    return incidentsList.filter(i => i.type === 'Ausente').length;
  }, [incidentsList]);

  const fetchShiftTemplates = async (ym?: string) => {
    try {
      const targetYm = ym || selectedMonthYear || getTodayDateString().substring(0, 7);
      const res = await fetch(`${API_BASE}/api/shift-templates?year_month=${targetYm}`);
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

  useEffect(() => {
    if (isDataLoaded && selectedMonthYear) {
      fetchShiftTemplates(selectedMonthYear);
    }
  }, [selectedMonthYear, isDataLoaded]);

  const refreshData = async (dateToSelect?: string) => {
    try {
      const datesRes = await fetch(`${API_BASE}/api/dates`);
      const dates: string[] = await datesRes.json();

      if (dates.length > 0) {
        setAvailableDates(dates);
        const targetDate = dateToSelect || selectedDate || dates[0];
        setSelectedDate(targetDate);
        const ym = targetDate.substring(0, 7);
        setSelectedMonthYear(ym);

        const workersRes = await fetch(`${API_BASE}/api/workers`);
        const workers = await workersRes.json();
        setUniqueWorkers(workers);

        const attRes = await fetch(`${API_BASE}/api/attendance?date=${targetDate}`);
        const attendance = await attRes.json();
        setWorkerSummaries(attendance);

        await fetchShiftTemplates(ym);

        setIsDataLoaded(true);
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

  useEffect(() => {
    if (!selectedDate || !isDataLoaded) return;
    fetch(`${API_BASE}/api/attendance?date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => setWorkerSummaries(data))
      .catch((err) => console.error(err));
  }, [selectedDate, isDataLoaded]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const dataBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(dataBuffer, { type: 'array', cellDates: false });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      rows.forEach((row) => {
        const rawDate = row['Fecha/Hora'];
        if (typeof rawDate === 'string') {
          const match = rawDate.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(.*)$/);
          if (match) {
            const [, day, month, year, timePart] = match;
            const paddedDay = day.padStart(2, '0');
            const paddedMonth = month.padStart(2, '0');
            row['Fecha/Hora'] = `${year}-${paddedMonth}-${paddedDay}${timePart}`;
          }
        }
      });

      const newSheet = XLSX.utils.json_to_sheet(rows);
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, newSheet, sheetName);

      const excelBuffer = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
      const correctedBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const correctedFile = new File([correctedBlob], file.name, { type: file.type });

      const formData = new FormData();
      formData.append('file', correctedFile);

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

  const availableTurnos = useMemo(() => {
    const turnosSet = new Set<string>();
    uniqueWorkers.forEach((w) => {
      const currentTurno = selectedDate ? getTurnoOnDate(w.defaultTurno, w.rules, selectedDate) : w.defaultTurno;
      turnosSet.add(currentTurno);
    });
    Object.keys(shiftTemplates).forEach((t) => turnosSet.add(t));
    return Array.from(turnosSet);
  }, [uniqueWorkers, shiftTemplates, selectedDate]);

  const workerSummariesWithRest = useMemo(() => {
    if (!selectedDate) return workerSummaries;
    const [yearStr, monthStr, dayStr] = selectedDate.split('-');
    if (!yearStr || !monthStr || !dayStr) return workerSummaries;
    const dayNum = parseInt(dayStr, 10);
    const dayIndex = (dayNum - 1) % 31;

    return workerSummaries.map((w) => {
      const turno = w.turno;
      const template = shiftTemplates[turno];
      let isRest = false;
      if (template && template[dayIndex]) {
        const hours = template[dayIndex].hours;
        isRest = hours === 'P' || hours === 'p' || hours === 0 || hours === '0' || hours === '0.00';
      }
      return { ...w, isRest };
    });
  }, [workerSummaries, shiftTemplates, selectedDate]);

  const filteredSummaries = useMemo(() => {
    return workerSummariesWithRest.filter((w) => {
      const name = w.nombre.toLowerCase();
      const no = w.no.toLowerCase();
      const query = searchTerm.toLowerCase();
      const matchesSearch = name.includes(query) || no.includes(query);

      const matchesShift = selectedAttendanceShiftFilter === 'ALL' || w.turno === selectedAttendanceShiftFilter;

      const hasMark = Boolean(w.marca1 || w.marca2 || w.entradaMañana || w.salidaMañana || w.entradaTarde || w.salidaTarde);
      const matchesAttendance =
        selectedAttendanceStatusFilter === 'ALL' ||
        (selectedAttendanceStatusFilter === 'PRESENT' && hasMark) ||
        (selectedAttendanceStatusFilter === 'ABSENT' && !hasMark && !w.isRest);

      return matchesSearch && matchesShift && matchesAttendance;
    });
  }, [workerSummariesWithRest, searchTerm, selectedAttendanceShiftFilter, selectedAttendanceStatusFilter]);

  const scheduledWorkersCount = useMemo(() => {
    return workerSummariesWithRest.filter((w) => !w.isRest).length;
  }, [workerSummariesWithRest]);

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

  const totalPages = Math.ceil(filteredSummaries.length / pageSize) || 1;
  const paginatedSummaries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSummaries.slice(start, start + pageSize);
  }, [filteredSummaries, currentPage, pageSize]);

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

  const handleSaveDayModal = async () => {
    if (!editingDay) return;
    const parsedHours = modalDayHours === 'P' || modalDayHours === 'p' ? 'P' : parseFloat(modalDayHours) || 0;

    const currentDays = [...(shiftTemplates[selectedShiftTemplate] || Array.from({ length: 31 }, () => ({ hours: 'P', markDirection: 'entrada' as const })))];
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
          yearMonth: selectedMonthYear,
        }),
      });

      if (!res.ok) throw new Error('Error al guardar el día en el servidor');

      await fetchShiftTemplates(selectedMonthYear);
      setEditingDay(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSaveAllChanges = async () => {
    if (!selectedShiftTemplate) return;
    try {
      const res = await fetch(`${API_BASE}/api/shift-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedShiftTemplate,
          days: calendarData.days.map(d => ({
            dayIndex: d.dayIndex,
            hours: d.hours,
            markDirection: d.markDirection,
          })),
          yearMonth: selectedMonthYear,
        }),
      });

      if (!res.ok) throw new Error('Error al guardar los cambios en el servidor');

      await fetchShiftTemplates(selectedMonthYear);
      alert('¡Cambios guardados con éxito en la base de datos SQLite!');
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleCreateNewShift = async () => {
    if (!newShiftName.trim()) return;
    const name = newShiftName.trim().toUpperCase();

    const defaultDays: DayConfig[] = Array.from({ length: 31 }, () => ({
      hours: 'P',
      markDirection: 'entrada',
    }));

    try {
      const res = await fetch(`${API_BASE}/api/shift-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          days: defaultDays,
          yearMonth: selectedMonthYear,
        }),
      });

      if (!res.ok) throw new Error('Error al crear el turno');

      await fetchShiftTemplates(selectedMonthYear);
      setSelectedShiftTemplate(name);
      setNewShiftName('');
      setIsCreatingShift(false);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteShift = async (shiftName: string) => {
    if (!confirm(`¿Estás seguro de eliminar el turno "${shiftName}"?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/shift-templates/${encodeURIComponent(shiftName)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar el turno');
      const templatesRes = await fetch(`${API_BASE}/api/shift-templates`);
      const templatesData = await templatesRes.json();
      setShiftTemplates(templatesData);
      const keys = Object.keys(templatesData);
      setSelectedShiftTemplate(keys.length > 0 ? keys[0] : '');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const calendarData = useMemo(() => {
    const [yearStr, monthStr] = selectedMonthYear.split('-');
    const year = parseInt(yearStr, 10) || 2025;
    const month = parseInt(monthStr, 10) || 10;
    const daysInMonth = new Date(year, month, 0).getDate();

    const template = shiftTemplates[selectedShiftTemplate] || [];

    let hours1_15 = 0;
    let hours16_31 = 0;

    const days = [];
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const dayIndex = dayNum - 1;
      const dayConfig = template[dayIndex] || { hours: 'P', markDirection: 'entrada' };
      const hoursVal = dayConfig.hours;
      const numericVal = typeof hoursVal === 'number' ? hoursVal : parseFloat(hoursVal) || 0;

      if (typeof hoursVal === 'number' || !isNaN(numericVal)) {
        if (dayNum <= 15) hours1_15 += numericVal;
        else hours16_31 += numericVal;
      }
      const dateObj = new Date(year, month - 1, dayNum);
      const wDayIdx = dateObj.getDay();
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
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="brand-icon">🗄️</span>
          <span className="brand-title">Sistema de Nómina</span>
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
              <button
                className={`nav-link ${currentView === 'incidencias' ? 'active' : ''}`}
                onClick={() => setCurrentView('incidencias')}
              >
                ⚠️ Incidencias
              </button>
            </li>
            <li>
              <label className="nav-upload-btn" title="Cargar otro archivo Excel">
                📁 Cambiar Archivo
                <input type="file" accept=".xls,.xlsx" onChange={handleFileUpload} className="hidden" />
              </label>
            </li>
          </ul>
        )}
      </nav>

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
          <AsistenciasView
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            availableDates={availableDates}
            workerSummaries={workerSummariesWithRest}
            filteredSummaries={filteredSummaries}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            paginatedSummaries={paginatedSummaries}
            selectedAttendanceShiftFilter={selectedAttendanceShiftFilter}
            setSelectedAttendanceShiftFilter={setSelectedAttendanceShiftFilter}
            selectedAttendanceStatusFilter={selectedAttendanceStatusFilter}
            setSelectedAttendanceStatusFilter={setSelectedAttendanceStatusFilter}
            availableTurnos={availableTurnos}
            scheduledWorkersCount={scheduledWorkersCount}
          />
        )}

        {isDataLoaded && !loading && currentView === 'trabajadores' && (
          <TrabajadoresView
            uniqueWorkers={uniqueWorkers}
            filteredWorkers={filteredWorkers}
            paginatedWorkers={paginatedWorkers}
            workerSearchTerm={workerSearchTerm}
            setWorkerSearchTerm={setWorkerSearchTerm}
            selectedTurno={selectedTurno}
            setSelectedTurno={setSelectedTurno}
            selectedDate={selectedDate}
            availableTurnos={availableTurnos}
            workerCurrentPage={workerCurrentPage}
            setWorkerCurrentPage={setWorkerCurrentPage}
            workerTotalPages={workerTotalPages}
            onEditWorker={(worker, currentTurno) => {
              setEditingWorker(worker);
              const templateKeys = Object.keys(shiftTemplates);
              const defaultModalTurno = templateKeys.includes(currentTurno) ? currentTurno : (templateKeys[0] || 'Matutino');
              setNewTurnoValue(defaultModalTurno);
              setEditType('total');
              const todayStr = getTodayDateString();
              setRuleStartDate(todayStr);
              setRuleEndDate(todayStr);
            }}
          />
        )}

        {isDataLoaded && !loading && currentView === 'turnos' && (
          <TurnosView
            selectedMonthYear={selectedMonthYear}
            setSelectedMonthYear={setSelectedMonthYear}
            selectedShiftTemplate={selectedShiftTemplate}
            setSelectedShiftTemplate={setSelectedShiftTemplate}
            shiftTemplates={shiftTemplates}
            onDeleteShift={handleDeleteShift}
            onSaveAllChanges={handleSaveAllChanges}
            onOpenCreateShift={() => setIsCreatingShift(true)}
            calendarData={calendarData}
            onEditDay={(dayIndex, dayNum, config) => {
              setEditingDay({ dayIndex, dayNum, config });
              setModalDayHours(String(config.hours));
              setModalMarkDirection(config.markDirection);
            }}
          />
        )}

        {isDataLoaded && !loading && currentView === 'incidencias' && (
          <IncidenciasView
            selectedMonthYear={incidentMonthYear}
            setSelectedMonthYear={setIncidentMonthYear}
            incidentPeriod={incidentPeriod}
            setIncidentPeriod={setIncidentPeriod}
            incidentTypeFilter={incidentTypeFilter}
            setIncidentTypeFilter={setIncidentTypeFilter}
            incidentSearchTerm={incidentSearchTerm}
            setIncidentSearchTerm={setIncidentSearchTerm}
            incidentShiftFilter={incidentShiftFilter}
            setIncidentShiftFilter={setIncidentShiftFilter}
            availableTurnos={availableTurnos}
            incidents={incidentsList}
            filteredIncidents={filteredIncidents}
            paginatedIncidents={paginatedIncidents}
            currentPage={incidentCurrentPage}
            setCurrentPage={setIncidentCurrentPage}
            totalPages={incidentTotalPages}
            totalIncidentsCount={incidentsList.length}
            absentCount={absentIncidentsCount}
          />
        )}
      </main>

      <CreateShiftModal
        isOpen={isCreatingShift}
        onClose={() => setIsCreatingShift(false)}
        newShiftName={newShiftName}
        setNewShiftName={setNewShiftName}
        onSave={handleCreateNewShift}
      />

      <EditDayModal
        editingDay={editingDay}
        onClose={() => setEditingDay(null)}
        selectedShiftTemplate={selectedShiftTemplate}
        selectedMonthYear={selectedMonthYear}
        modalDayHours={modalDayHours}
        setModalDayHours={setModalDayHours}
        modalMarkDirection={modalMarkDirection}
        setModalMarkDirection={setModalMarkDirection}
        onSave={handleSaveDayModal}
      />

      <EditWorkerModal
        editingWorker={editingWorker}
        onClose={() => setEditingWorker(null)}
        editType={editType}
        setEditType={setEditType}
        newTurnoValue={newTurnoValue}
        setNewTurnoValue={setNewTurnoValue}
        shiftTemplates={shiftTemplates}
        ruleStartDate={ruleStartDate}
        setRuleStartDate={setRuleStartDate}
        ruleEndDate={ruleEndDate}
        setRuleEndDate={setRuleEndDate}
        onSave={handleSaveTurnoRule}
        onDeleteRule={handleDeleteRule}
      />
    </div>
  );
}
