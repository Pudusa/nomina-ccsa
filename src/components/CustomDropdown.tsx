import { useEffect, useState, useRef } from 'react';

interface Option {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  width?: string;
}

export function CustomDropdown({ label, value, options, onChange, width = 'w-[220px]' }: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`visual-date-picker ${width}`} ref={containerRef}>
      <label className="vdp-label">{label}</label>
      <div
        className="vdp-header-bar cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
        title="Hacer clic para desplegar opciones"
      >
        <span className="vdp-selected-display text-slate-800 font-semibold text-base">
          {selectedOption ? selectedOption.label : value}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-bold">{isOpen ? '▲' : '▼'}</span>
        </div>
      </div>

      {isOpen && (
        <div className="vdp-calendar-card w-full left-0 mt-1 p-2 max-h-60 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`text-left px-3 py-2.5 rounded-md font-semibold text-sm transition-colors ${
                    isSelected
                      ? 'bg-green-600 text-white'
                      : 'bg-white text-slate-800 hover:bg-slate-100'
                  }`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
