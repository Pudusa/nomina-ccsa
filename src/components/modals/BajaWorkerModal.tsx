import { useState } from 'react';
import { VisualDatePicker } from '../VisualDatePicker';
import type { UniqueWorker } from '../../types';

interface BajaWorkerModalProps {
  worker: UniqueWorker;
  onClose: () => void;
  onSave: (fechaBaja: string | null) => Promise<void>;
  busy: boolean;
}

export function BajaWorkerModal({ worker, onClose, onSave, busy }: BajaWorkerModalProps) {
  const [fechaBaja, setFechaBaja] = useState<string>(worker.fechaBaja || '');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Dar de baja a {worker.nombre}</h2>
        <p className="modal-subtitle">
          El trabajador dejará de aparecer desde la fecha elegida. Su historial anterior se conserva.
        </p>

        <div className="modal-field">
          <VisualDatePicker
            label="Fecha de baja:"
            value={fechaBaja}
            onChange={setFechaBaja}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose} disabled={busy}>Cancelar</button>
          {worker.fechaBaja && (
            <button
              type="button"
              className="px-3 py-1.5 bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-300"
              onClick={() => onSave(null)}
              disabled={busy}
            >
              Reincorporar
            </button>
          )}
          <button
            className="btn-save"
            onClick={() => onSave(fechaBaja || null)}
            disabled={busy || !fechaBaja}
          >
            Guardar baja
          </button>
        </div>
      </div>
    </div>
  );
}
