interface CreateShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  newShiftName: string;
  setNewShiftName: (val: string) => void;
  onSave: () => void;
}

export function CreateShiftModal({
  isOpen,
  onClose,
  newShiftName,
  setNewShiftName,
  onSave,
}: CreateShiftModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Crear Nuevo Turno</h2>
        <p className="modal-subtitle">
          Introduce el nombre del nuevo turno (se guardará en la base de datos SQLite).
        </p>

        <div className="modal-field">
          <label htmlFor="new-shift-name">Nombre del Turno:</label>
          <input
            id="new-shift-name"
            type="text"
            className="modal-text-input"
            value={newShiftName}
            onChange={(e) => setNewShiftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSave();
            }}
            placeholder="Ej. TURNO ROTATIVO 5"
          />
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-save" onClick={onSave}>
            Crear Turno
          </button>
        </div>
      </div>
    </div>
  );
}
