import { useState } from 'react';
import { Icon } from '../Icon';
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
  const [motivo, setMotivo] = useState('Renuncia');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2><Icon name="person_off" /> Dar de baja a {worker.nombre}</h2>
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

        <div className="modal-field">
          <label htmlFor="motivo-baja">Motivo de baja:</label>
          <select id="motivo-baja" className="modal-text-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={busy}>
            <option>Renuncia</option>
            <option>Terminación de contrato</option>
            <option>Jubilación</option>
            <option>Incapacidad</option>
            <option>Otro</option>
          </select>
          <small className="modal-hint">El motivo se registra para trazabilidad; el historial de asistencia se conserva.</small>
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
            {busy ? <><span className="modal-spinner" /> Guardando…</> : <><Icon name="save" /> Guardar baja</>}
          </button>
        </div>
      </div>
    </div>
  );
}
