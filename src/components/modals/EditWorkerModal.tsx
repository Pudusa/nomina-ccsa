import type { UniqueWorker } from '../../types';
import { VisualDatePicker } from '../VisualDatePicker';
import { formatDisplayDate } from '../../utils/dateUtils';

interface EditWorkerModalProps {
  editingWorker: UniqueWorker | null;
  onClose: () => void;
  editType: 'total' | 'parcial';
  setEditType: (val: 'total' | 'parcial') => void;
  newTurnoValue: string;
  setNewTurnoValue: (val: string) => void;
  shiftTemplates: Record<string, any>;
  ruleStartDate: string;
  setRuleStartDate: (val: string) => void;
  ruleEndDate: string;
  setRuleEndDate: (val: string) => void;
  onSave: () => void;
  onDeleteRule: (ruleId: number) => void;
}

export function EditWorkerModal({
  editingWorker,
  onClose,
  editType,
  setEditType,
  newTurnoValue,
  setNewTurnoValue,
  shiftTemplates,
  ruleStartDate,
  setRuleStartDate,
  ruleEndDate,
  setRuleEndDate,
  onSave,
  onDeleteRule,
}: EditWorkerModalProps) {
  if (!editingWorker) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
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
                  </span>
                  <button
                    className="btn-delete-rule"
                    onClick={() => onDeleteRule(r.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-save" onClick={onSave}>
            Guardar en BD
          </button>
        </div>
      </div>
    </div>
  );
}
