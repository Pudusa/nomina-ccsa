import { useEffect, useState, useRef } from 'react';
import type { VisualDatePickerProps } from '../types';
import { formatDisplayDate, getTodayDateString } from '../utils/dateUtils';

export function VisualDatePicker({ label, value, onChange, minDate, availableDates }: VisualDatePickerProps) {
  const currentDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [viewYear, setViewYear] = useState<number>(currentDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(currentDate.getMonth());
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div className="visual-date-picker" ref={containerRef}>
      <label className="vdp-label">{label}</label>
      <div
        className="vdp-header-bar cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        title="Hacer clic para abrir/cerrar calendario"
      >
        <span className="vdp-selected-display">📅 {formatDisplayDate(value || todayStr)}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="vdp-today-btn"
            onClick={(e) => {
              e.stopPropagation();
              onChange(todayStr);
              const d = new Date(todayStr + 'T00:00:00');
              setViewYear(d.getFullYear());
              setViewMonth(d.getMonth());
              setIsOpen(false);
            }}
          >
            Hoy
          </button>
          <span className="text-xs text-slate-400">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && (
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
              const hasData = availableDates ? availableDates.includes(dateStr) : false;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isDisabled}
                  className={`vdp-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${isDisabled ? 'disabled' : ''} ${hasData ? 'has-data' : ''}`}
                  onClick={() => {
                    if (!isDisabled) {
                      onChange(dateStr);
                      setIsOpen(false);
                    }
                  }}
                >
                  {parseInt(dateStr.split('-')[2], 10)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
