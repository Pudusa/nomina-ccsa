import type { DayConfig } from '../../types';

interface EditDayModalProps {
  editingDay: { dayIndex: number; dayNum: number; config: DayConfig } | null;
  onClose: () => void;
  selectedShiftTemplate: string;
  selectedMonthYear: string;
  modalDayHours: string;
  setModalDayHours: (val: string) => void;
  modalMarkDirection: 'entrada' | 'salida';
  setModalMarkDirection: (val: 'entrada' | 'salida') => void;
  onSave: () => void;
}

export function EditDayModal({
  editingDay,
  onClose,
  selectedShiftTemplate,
  selectedMonthYear,
  modalDayHours,
  setModalDayHours,
  modalMarkDirection,
  setModalMarkDirection,
  onSave,
}: EditDayModalProps) {
  if (!editingDay) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Editar Día {editingDay.dayNum}</h2>
        <p className="modal-subtitle">
          Turno: <strong>{selectedShiftTemplate}</strong> — Mes: <strong>{selectedMonthYear}</strong> (Ajuste específico para este mes)
        </p>

        <div className="modal-field">
          <label htmlFor="modal-day-hours">Horas trabajadas (o 'P' para descanso):</label>
          <input
            id="modal-day-hours"
            type="text"
            className="modal-text-input"
            value={modalDayHours}
            onChange={(e) => setModalDayHours(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
            }}
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
          <button className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-save" onClick={onSave}>
            Actualizar en BD
          </button>
        </div>
      </div>
    </div>
  );
}
