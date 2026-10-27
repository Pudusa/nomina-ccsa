import type { DayConfig } from '../../types';
import { CustomDropdown } from '../CustomDropdown';

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
  const shiftOptions = Object.keys(shiftTemplates).length === 0
    ? [{ label: 'Sin turno', value: '' }]
    : Object.keys(shiftTemplates).map((key) => ({ label: key, value: key }));

  return (
    <div className="turnos-view">
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

      <div className="controls-bar flex flex-wrap items-center justify-between gap-8 mb-6">
        <div className="flex flex-wrap items-center gap-8">
          <div className="visual-date-picker w-[220px]">
            <label htmlFor="month-select" className="vdp-label">📅 Mes:</label>
            <input
              id="month-select"
              type="month"
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(e.target.value)}
              className="w-full bg-white border-2 border-[#94a3b8] rounded-lg px-3 py-3 text-slate-900 text-sm font-semibold outline-none focus:border-green-600 transition-all truncate"
            />
          </div>

          <div className="flex items-center gap-3">
            <CustomDropdown
              label="⚙️ Turno:"
              value={selectedShiftTemplate}
              onChange={(val) => setSelectedShiftTemplate(val)}
              options={shiftOptions}
              width="w-[220px]"
            />
            {selectedShiftTemplate && selectedShiftTemplate !== 'Sin turno' && (
              <button
                className="btn-delete-rule px-3 py-3 text-xs font-bold rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors mt-5"
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

      <div className="legend-bar">
        <span className="legend-item"><span className="legend-dot dot-entrada"></span> ☀️ 1ra Marca: Entrada</span>
        <span className="legend-item"><span className="legend-dot dot-salida"></span> 🌙 1ra Marca: Salida (Nocturno)</span>
        <span className="legend-item"><span className="legend-dot dot-rest"></span> 🛌 Día de Descanso (P)</span>
      </div>

      {(() => {
        const [yearStr, monthStr] = selectedMonthYear.split('-');
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const firstDayOfWeek = !isNaN(year) && !isNaN(month) ? new Date(year, month - 1, 1).getDay() : 0;

        return (
          <div>
            <div className="grid grid-cols-7 gap-3 mb-3 text-center font-bold text-xs text-slate-600 bg-slate-200 py-2.5 rounded-xl border border-slate-300">
              <div>Dom</div>
              <div>Lun</div>
              <div>Mar</div>
              <div>Mié</div>
              <div>Jue</div>
              <div>Vie</div>
              <div>Sáb</div>
            </div>

            <div className="grid grid-cols-7 gap-3">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24 bg-slate-50 rounded-xl border border-dashed border-slate-300 opacity-40"></div>
              ))}

              {calendarData.days.map((d) => {
                const isRest = d.hours === 'P' || d.hours === 'p';
                const isSalida = d.markDirection === 'salida';

                let cardClass = 'calendar-day-card clickable-card h-24 p-2 flex flex-col justify-between';
                if (isRest) cardClass += ' rest-day';
                else if (isSalida) cardClass += ' salida-day';
                else cardClass += ' entrada-day';

                return (
                  <div
                    key={d.dayNum}
                    className={cardClass}
                    onClick={() => onEditDay(d.dayIndex, d.dayNum, { hours: d.hours, markDirection: d.markDirection, numMarcas: d.numMarcas })}
                    title="Haz clic para editar este día"
                  >
                    <div className="card-day-header !p-0 !bg-transparent flex justify-between items-center text-xs font-bold">
                      <span className="day-number text-sm">{d.dayNum}</span>
                      <span className="weekday-name text-[10px] opacity-80">{d.wDayName}</span>
                    </div>
                    <div className="card-divider !my-1"></div>
                    <div className="card-day-body !p-0 flex justify-center items-center flex-1">
                      {isRest ? (
                        <span className="badge-rest text-xs py-1 px-2">🛌 Descanso (P)</span>
                      ) : (
                        <div className="card-hours-container gap-0.5">
                          <span className="badge-hours text-base">{d.hours} hrs</span>
                          <span className={`badge-mark-dir text-[10px] py-0.5 px-1.5 ${isSalida ? 'dir-salida' : 'dir-entrada'}`}>
                            {isSalida ? '🌙 Salida' : '☀️ Entrada'}
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
      })()}
    </div>
  );
}
