import { useState, useEffect, useRef } from 'react';

interface VisualMonthPickerProps {
  label: string;
  value: string; // formato 'YYYY-MM'
  onChange: (val: string) => void;
}

export function VisualMonthPicker({ label, value, onChange }: VisualMonthPickerProps) {
  const [year] = value ? value.split('-').map(Number) : [new Date().getFullYear()];
  const [viewYear, setViewYear] = useState<number>(year || 2026);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [alignRight, setAlignRight] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.left + 260 > window.innerWidth - 20) {
        setAlignRight(true);
      } else {
        setAlignRight(false);
      }
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (value) {
      const [y] = value.split('-').map(Number);
      if (y) setViewYear(y);
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
    { name: 'Enero', val: '01' },
    { name: 'Febrero', val: '02' },
    { name: 'Marzo', val: '03' },
    { name: 'Abril', val: '04' },
    { name: 'Mayo', val: '05' },
    { name: 'Junio', val: '06' },
    { name: 'Julio', val: '07' },
    { name: 'Agosto', val: '08' },
    { name: 'Septiembre', val: '09' },
    { name: 'Octubre', val: '10' },
    { name: 'Noviembre', val: '11' },
    { name: 'Diciembre', val: '12' },
  ];

  const currentMonthName = monthNames.find(m => m.val === (value ? value.split('-')[1] : '11'))?.name || 'Noviembre';
  const currentYearVal = value ? value.split('-')[0] : '2026';
  const displayLabel = `${currentMonthName} ${currentYearVal}`;

  return (
    <div className="visual-date-picker w-full" ref={containerRef}>
      {label && <label className="vdp-label">{label}</label>}
      <div
        className="vdp-header-bar cursor-pointer select-none"
        onClick={handleToggle}
        title="Hacer clic para abrir calendario de meses"
      >
        <span className="vdp-selected-display text-slate-800 font-semibold text-base">{displayLabel}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-bold">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && (
        <div className="vdp-calendar-card w-64 p-3" style={alignRight ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }}>
          <div className="vdp-cal-nav mb-3">
            <button type="button" onClick={() => setViewYear(viewYear - 1)} title="Año anterior">◀</button>
            <span className="vdp-cal-title font-bold text-slate-800">{viewYear}</span>
            <button type="button" onClick={() => setViewYear(viewYear + 1)} title="Año siguiente">▶</button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {monthNames.map((m) => {
              const monthVal = `${viewYear}-${m.val}`;
              const isSelected = monthVal === value;
              return (
                <button
                  key={m.val}
                  type="button"
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition ${
                    isSelected
                      ? 'bg-green-600 text-white shadow'
                      : 'bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200'
                  }`}
                  onClick={() => {
                    onChange(monthVal);
                    setIsOpen(false);
                  }}
                >
                  {m.name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
