import { useState } from 'react';

export interface ZkDeviceConfig {
  id?: number;
  name: string;
  ip: string;
  port: number;
  commKey: number;
  enabled: boolean;
}

interface ZkConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initial: {
    settings: { syncHour: number; syncMinute: number; enabled: boolean };
    devices: ZkDeviceConfig[];
  };
  onSave: (config: { hour: number; minute: number; enabled: boolean; devices: ZkDeviceConfig[] }) => Promise<void>;
  onSync: () => Promise<void>;
  busy: boolean;
}

export function ZkConfigModal({ isOpen, onClose, initial, onSave, onSync, busy }: ZkConfigModalProps) {
  const [hour, setHour] = useState<number>(initial.settings.syncHour ?? 0);
  const [minute, setMinute] = useState<number>(initial.settings.syncMinute ?? 0);
  const [enabled, setEnabled] = useState<boolean>(Boolean(initial.settings.enabled));
  const [devices, setDevices] = useState<ZkDeviceConfig[]>(initial.devices || []);

  if (!isOpen) return null;

  const updateDevice = (index: number, patch: Partial<ZkDeviceConfig>) => {
    setDevices(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        <h2>⚙️ Configuración de Relojes ZKTeco</h2>
        <p className="modal-subtitle">
          La hora y los equipos se guardan en la base de datos. Para agregar un reloj en el futuro, solo agrégalo aquí.
        </p>

        <div className="modal-field">
          <label>Hora de sincronización automática (24 h):</label>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number" min={0} max={23} value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="modal-text-input" style={{ width: '80px' }}
            />
            <span className="text-lg">:</span>
            <input
              type="number" min={0} max={59} value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="modal-text-input" style={{ width: '80px' }}
            />
            <label className="flex items-center gap-1.5 ml-4 text-sm">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Activar automática
            </label>
          </div>
        </div>

        <div className="modal-field">
          <label>Equipos:</label>
          {devices.length === 0 && (
            <p className="text-sm text-slate-500">No hay relojes configurados. Agrega uno abajo.</p>
          )}
          {devices.map((device, index) => (
            <div key={index} className="flex items-center gap-2 flex-wrap mb-2">
              <input
                placeholder="Nombre" value={device.name}
                onChange={(e) => updateDevice(index, { name: e.target.value })}
                className="modal-text-input" style={{ width: '130px' }}
              />
              <input
                placeholder="192.168.1.10" value={device.ip}
                onChange={(e) => updateDevice(index, { ip: e.target.value })}
                className="modal-text-input" style={{ width: '150px' }}
              />
              <input
                type="number" title="Puerto" value={device.port}
                onChange={(e) => updateDevice(index, { port: Number(e.target.value) })}
                className="modal-text-input" style={{ width: '80px' }}
              />
              <input
                type="number" title="Comm Key" value={device.commKey}
                onChange={(e) => updateDevice(index, { commKey: Number(e.target.value) })}
                className="modal-text-input" style={{ width: '80px' }}
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox" checked={device.enabled}
                  onChange={(e) => updateDevice(index, { enabled: e.target.checked })}
                />
                Activo
              </label>
              <button
                type="button" className="btn-cancel"
                onClick={() => setDevices(prev => prev.filter((_, i) => i !== index))}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="px-3 py-1.5 bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg hover:bg-slate-300"
            onClick={() => setDevices(prev => [...prev, { name: '', ip: '', port: 4370, commKey: 0, enabled: true }])}
          >
            + Agregar reloj
          </button>
        </div>

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-700"
            onClick={onSync}
            disabled={busy}
          >
            Sincronizar ahora
          </button>
          <button
            className="btn-save"
            onClick={() => onSave({ hour: Number(hour), minute: Number(minute), enabled, devices })}
            disabled={busy}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
