import type { DayConfig } from '../../types';

interface TurnosViewProps {
  selectedMonthYear: string;
  setSelectedMonthYear: (val: string) => void;
  selectedShiftTemplate: string;
  setSelectedShiftTemplate: (val: string) => void;
  shiftTemplates: Record<string, DayConfig[]>;
  onDeleteShift: (name: string) => void;
  onSaveAllChanges: () => void;
  onOpenCreateShift: () => void;
  calendarData: {
    daysInMonth: number;
    days: any[];
    hours1_15: string;
    hours16_31: string;
    totalMonthHours: string;
  };
  onEditDay: (dayIndex: number, dayNum: number, config: DayConfig) => void;
}

export function TurnosView({
  selectedMonthYear,
  setSelectedMonthYear,
  selectedShiftTemplate,
  setSelectedShiftTemplate,
  shiftTemplates,
  onDeleteShift,
  onSaveAllChanges,
  onOpenCreateShift,
  calendarData,
  onEditDay,
}: TurnosViewProps) {
  return (
    <div className="turnos-view">
      <h2>📅 Calendario de Turnos y Horas Trabajadas (Base de Datos SQLite)</h2>
      <p className="hint-text">💡 Haz clic directamente en cualquier tarjeta de día para editar sus horas o configurar su marcaje. También puedes crear nuevos turnos.</p>

      <div className="controls-bar flex flex-wrap items-center justify-between gap-8 mb-6">
        <div className="flex flex-wrap items-center gap-8">
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

          <div className="filter-box flex items-center gap-2">
            <label htmlFor="shift-template-select">⚙️ Turno:</label>
            <select
              id="shift-template-select"
              value={selectedShiftTemplate}
              onChange={(e) => setSelectedShiftTemplate(e.target.value)}
            >
              {Object.keys(shiftTemplates).length === 0 ? (
                <option value="">Sin turno</option>
              ) : (
                Object.keys(shiftTemplates).map((templateKey) => (
                  <option key={templateKey} value={templateKey}>
                    {templateKey}
                  </option>
                ))
              )}
            </select>
            {selectedShiftTemplate && selectedShiftTemplate !== 'Sin turno' && (
              <button
                className="btn-delete-rule px-3 py-1.5 text-xs"
                onClick={() => onDeleteShift(selectedShiftTemplate)}
                title="Eliminar turno actual"
              >
                🗑️ Eliminar
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            className="btn-save"
            onClick={onSaveAllChanges}
            title="Guardar todos los cambios de este turno y mes"
          >
            💾 Guardar Cambios
          </button>
          <button
            className="btn-save"
            onClick={onOpenCreateShift}
          >
            ➕ Crear Nuevo Turno
          </button>
        </div>
      </div>

      <div className="metrics-grid mb-6">
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
          <p className="metric-value text-emerald-400">{calendarData.totalMonthHours} hrs</p>
        </div>
      </div>

      <div className="legend-bar">
        <span className="legend-item"><span className="legend-dot dot-entrada"></span> 🟢 1ra Marca: Entrada</span>
        <span className="legend-item"><span className="legend-dot dot-salida"></span> 🌙 1ra Marca: Salida (Nocturno)</span>
        <span className="legend-item"><span className="legend-dot dot-rest"></span> 🛌 Día de Descanso (P)</span>
      </div>

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
              onClick={() => onEditDay(d.dayIndex, d.dayNum, { hours: d.hours, markDirection: d.markDirection })}
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
  );
}
