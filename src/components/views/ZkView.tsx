import { useState, useEffect } from 'react';
import { apiFetch } from '../../utils/api';

interface ZkDevice {
  id?: number;
  name: string;
  ip: string;
  port: number;
  commKey: number;
  enabled: boolean;
}

interface HistoryRow {
  id: number;
  startedAt: string;
  source: string;
  deviceIp: string;
  ok: number;
  added: number;
  skipped: number;
  error: string | null;
}

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Manual',
  automatica: 'Automática',
  arranque: 'Arranque',
};
const SOURCE_STYLE: Record<string, string> = {
  manual: 'bg-blue-100 text-blue-800',
  automatica: 'bg-emerald-100 text-emerald-800',
  arranque: 'bg-amber-100 text-amber-800',
};

// El padding por defecto de .modal-text-input es demasiado grande para estos campos.
const inputStyle = { padding: '0.5rem 0.6rem', fontSize: '0.95rem' };

export function ZkView() {
  const [hour, setHour] = useState<number>(0);
  const [minute, setMinute] = useState<number>(0);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [devices, setDevices] = useState<ZkDevice[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadConfig = async () => {
    const res = await apiFetch('/api/attendance/zk/config');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar la configuración');
    setHour(data.settings.syncHour);
    setMinute(data.settings.syncMinute);
    setEnabled(Boolean(data.settings.enabled));
    setDevices(data.devices || []);
  };

  const loadHistory = async () => {
    const res = await apiFetch('/api/attendance/zk/history');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar el historial');
    setHistory(data || []);
  };

  useEffect(() => {
    Promise.all([loadConfig(), loadHistory()]).catch((e: Error) => setError(e.message));
  }, []);

  const showMessage = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(''), 6000);
  };

  const updateDevice = (index: number, patch: Partial<ZkDevice>) => {
    setDevices(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const handleSave = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/api/attendance/zk/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hour: Number(hour), minute: Number(minute), enabled, devices }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar');
      await loadConfig();
      showMessage('Configuración guardada. La automática volverá a correr a la hora indicada.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/api/attendance/zk-sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar');
      const added = (data.results || []).reduce((sum: number, r: any) => sum + (r.added || 0), 0);
      await loadHistory();
      window.dispatchEvent(new CustomEvent('nomina:attendance-uploaded'));
      showMessage(`Sincronización manual: ${added} marcas nuevas.`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">🕐 Relojes ZKTeco</h1>
        <p className="text-sm text-slate-500">
          Configura los equipos, la hora de carga automática y consulta cada importación realizada.
        </p>
      </div>

      {error && <div className="error-state">{error}</div>}
      {message && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{message}</div>
      )}

      <section className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">Configuración</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-slate-600">Sincronización automática a las</label>
          <input
            type="number" min={0} max={23} value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="modal-text-input flex-shrink-0" style={{ ...inputStyle, width: '100px' }}
          />
          <span className="text-lg">:</span>
          <input
            type="number" min={0} max={59} value={minute}
            onChange={(e) => setMinute(Number(e.target.value))}
            className="modal-text-input flex-shrink-0" style={{ ...inputStyle, width: '100px' }}
          />
          <label className="flex items-center gap-1.5 ml-3 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Activar automática
          </label>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-600 mb-2">Equipos</h3>
          {devices.length === 0 && (
            <p className="text-sm text-slate-500 mb-2">No hay relojes configurados.</p>
          )}
          {devices.map((device, index) => (
            <div key={device.id || index} className="flex items-center gap-2 flex-wrap mb-2">
              <input
                placeholder="Nombre" value={device.name}
                onChange={(e) => updateDevice(index, { name: e.target.value })}
                className="modal-text-input flex-shrink-0" style={{ ...inputStyle, width: '190px' }}
              />
              <input
                placeholder="IP" value={device.ip}
                onChange={(e) => updateDevice(index, { ip: e.target.value })}
                className="modal-text-input flex-shrink-0" style={{ ...inputStyle, width: '210px' }}
              />
              <input
                type="number" title="Puerto" value={device.port}
                onChange={(e) => updateDevice(index, { port: Number(e.target.value) })}
                className="modal-text-input flex-shrink-0" style={{ ...inputStyle, width: '100px' }}
              />
              <input
                type="number" title="Comm Key" value={device.commKey}
                onChange={(e) => updateDevice(index, { commKey: Number(e.target.value) })}
                className="modal-text-input flex-shrink-0" style={{ ...inputStyle, width: '100px' }}
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

        <div className="flex gap-2">
          <button className="btn-save" onClick={handleSave} disabled={busy}>Guardar configuración</button>
          <button
            type="button"
            className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50"
            onClick={handleSync}
            disabled={busy}
          >
            {busy ? 'Procesando…' : 'Sincronizar ahora'}
          </button>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-700">Historial de importaciones</h2>
          <button
            type="button"
            className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200"
            onClick={() => loadHistory().catch((e: Error) => setError(e.message))}
          >
            Actualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500 border-b">
              <tr>
                <th className="py-2 pr-3">Fecha/Hora</th>
                <th className="pr-3">Origen</th>
                <th className="pr-3">Equipo</th>
                <th className="pr-3">Estado</th>
                <th className="pr-3">Nuevas</th>
                <th className="pr-3">Duplicadas</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-mono text-xs">{row.startedAt}</td>
                  <td className="pr-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${SOURCE_STYLE[row.source] || ''}`}>
                      {SOURCE_LABEL[row.source] || row.source}
                    </span>
                  </td>
                  <td className="pr-3">{row.deviceIp}</td>
                  <td className="pr-3">
                    {row.ok ? <span className="text-emerald-700">OK</span> : <span className="text-rose-700">Error</span>}
                  </td>
                  <td className="pr-3">{row.added}</td>
                  <td className="pr-3">{row.skipped}</td>
                  <td className="text-slate-500">{row.error || '—'}</td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Todavía no hay importaciones registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
