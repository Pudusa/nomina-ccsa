import { useEffect, useState } from 'react';
import { apiFetch } from '../../utils/api';
import { formatDisplayDate } from '../../utils/dateUtils';
import type { UniqueWorker, WorkerDaySummary } from '../../types';
import { Icon } from '../Icon';

interface HistoryRow {
  startedAt: string;
  source: string;
  ok: number;
  added: number;
  skipped: number;
  error: string | null;
}

interface ZkConfig {
  settings: { syncHour: number; syncMinute: number; enabled: boolean; lastSyncDate: string | null };
}

interface IncidentWorker { no: string; nombre: string; anomalias: Array<{ tipo: string; categoria?: string; fecha: string }> }

const SOURCE_LABEL: Record<string, string> = { manual: 'Manual', automatica: 'Automática', arranque: 'Arranque' };

function pad(n: number) { return String(n).padStart(2, '0'); }
function localStamp(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function relativeTime(iso: string) {
  const diff = Math.round((Date.now() - new Date(iso.replace(' ', 'T')).getTime()) / 60000);
  if (diff < 1) return 'ahora mismo';
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)} h`;
  return `hace ${Math.floor(diff / 1440)} d`;
}

export function DashboardView({ selectedDate, userRole }: { selectedDate: string; userRole: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const month = selectedDate.substring(0, 7);
  const [workers, setWorkers] = useState<UniqueWorker[]>([]);
  const [attendance, setAttendance] = useState<WorkerDaySummary[]>([]);
  const [incidents, setIncidents] = useState<IncidentWorker[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [zk, setZk] = useState<ZkConfig['settings'] | null>(null);
  const [lastUpdated, setLastUpdated] = useState(() => localStamp(new Date()));

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [workersRes, attRes, zkRes, histRes, todayRes] = await Promise.all([
        apiFetch('/api/workers'),
        apiFetch(`/api/attendance?date=${selectedDate}`),
        apiFetch('/api/attendance/zk/config'),
        apiFetch('/api/attendance/zk/history'),
        apiFetch('/api/attendance/incidents?startDate=' + month + '-01&endDate=' + month + '-31'),
      ]);
      const [w, a, z, h, i] = await Promise.all([
        workersRes.json(), attRes.json(), zkRes.json(), histRes.json(), todayRes.json(),
      ]);
      if (!workersRes.ok || !attRes.ok) throw new Error('No se pudieron cargar los datos del corte');
      setWorkers(Array.isArray(w) ? w : []);
      setAttendance(Array.isArray(a) ? a : []);
      setIncidents(Array.isArray(i) ? i : []);
      setZk(z.settings || null);
      setHistory(Array.isArray(h) ? h.slice(0, 5) : []);
      setLastUpdated(localStamp(new Date()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedDate]);
  useEffect(() => {
    const onUploaded = () => load();
    window.addEventListener('nomina:attendance-uploaded', onUploaded);
    return () => window.removeEventListener('nomina:attendance-uploaded', onUploaded);
  }, [selectedDate, month]);

  const activeWorkers = workers.filter((w) => !w['fechaBaja'] || String(w['fechaBaja']) > selectedDate);
  const scheduled = attendance.filter((a) => a.status !== 'descanso' && a.status !== 'pendiente');
  const present = attendance.filter((a) => a.status === 'presente' || a.status === 'incompleto' || a.status === 'fuera_de_turno');
  const withExit = present.filter((a) => a.salidaMañana || a.salidaTarde);
  const stillWorking = present.filter((a) => !a.salidaMañana && !a.salidaTarde);
  const attendancePct = scheduled.length ? Math.round((present.length / scheduled.length) * 100) : 0;

  const incidentTotals = incidents.reduce<Record<string, number>>((acc, w) => {
    for (const a of w.anomalias || []) {
      const key = a.categoria || a.tipo || 'Otros';
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});
  const incidentEntries = Object.entries(incidentTotals).sort((a, b) => b[1] - a[1]);

  const shiftTotals = attendance.reduce<Record<string, number>>((acc, a) => {
    const key = a.turno || 'Sin turno';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const shiftEntries = Object.entries(shiftTotals).sort((a, b) => b[1] - a[1]);
  const maxShift = Math.max(1, ...shiftEntries.map(([, v]) => v));

  const hourly: Record<number, number> = {};
  for (const a of attendance) {
    for (const t of [a.entradaMañana, a.entradaTarde, a.salidaMañana, a.salidaTarde]) {
      if (t) { const h = Number(String(t).slice(0, 2)); if (!isNaN(h)) hourly[h] = (hourly[h] || 0) + 1; }
    }
  }
  const hours = Array.from({ length: 24 }, (_, h) => hourly[h] || 0);
  const maxHour = Math.max(1, ...hours);

  const lastSync = history[0];
  const isAreaChief = userRole === 'supervisor' || userRole === 'jefe';

  if (loading) return <div className="dash-state">Cargando corte del día…</div>;

  return (
    <div className="dash">
      <header className="dash-header">
        <div>
          <h1 className="dash-h1">Corte Diario</h1>
          <p className="dash-sub">Monitoreo operativo y consolidado de asistencia</p>
        </div>
        <div className="dash-header-right">
          <span className="dash-chip"><Icon name="calendar_today" /> {formatDisplayDate(selectedDate) || selectedDate}</span>
          <span className="dash-chip dash-chip-green"><Icon name="cloud_sync" /> Actualizado {lastUpdated.slice(11)}</span>
        </div>
      </header>

      {error && <div className="dash-error">{error}</div>}

      <section className="dash-card dash-fresh">
        <div className="dash-fresh-row">
          <div>
            <span className="dash-label">Última carga automática:</span>
            <strong className="dash-mono">{lastSync ? lastSync.startedAt : 'Sin registros'}</strong>
          </div>
          <div className="dash-badges">
            <span className="dash-badge">{lastSync ? (SOURCE_LABEL[lastSync.source] || lastSync.source) : '—'}</span>
            <span className={`dash-badge ${lastSync?.ok ? 'dash-badge-ok' : 'dash-badge-bad'}`}>
              {lastSync ? (lastSync.ok ? 'OK' : 'Error') : '—'}
            </span>
          </div>
        </div>
        <div className="dash-fresh-meta">
          <span><Icon name="update" /> Próxima ejecución: <strong>{zk ? `${pad(zk.syncHour)}:${pad(zk.syncMinute)}` : '—'}</strong></span>
          <span><Icon name="autorenew" /> {zk ? (zk.enabled ? 'Automática activa' : 'Automática desactivada') : 'Estado desconocido'}</span>
        </div>
        {lastSync && <div className="dash-fresh-foot"><Icon name="history" /> Registrada {relativeTime(lastSync.startedAt)} · +{lastSync.added} marcas · {lastSync.skipped} duplicadas</div>}
      </section>

      <section className="dash-kpis">
        <Kpi label="Total en Sistema" value={isAreaChief ? activeWorkers.filter((w) => (w.departamento || 'General') === (workers[0]?.departamento || 'General')).length : activeWorkers.length} hint="personal activo" />
        <Kpi label="Programados Hoy" value={scheduled.length} hint={attendance.length ? `de ${attendance.length} registros` : 'sin registros'} />
        <Kpi label="Salieron con Pase" value={withExit.length} hint="ya registraron salida" />
        <Kpi label="Siguen Trabajando" value={stillWorking.length} hint="sin salida registrada" accent />
        <Kpi label="% Asistencia" value={`${attendancePct}%`} hint="sobre programados" accent />
      </section>

      <div className="dash-grid">
        <section className="dash-card dash-incidents">
          <div className="dash-card-head">
            <h2><Icon name="warning" /> Incidencias del mes</h2>
            <span className="dash-label">{month}</span>
          </div>
          {incidentEntries.length === 0 ? (
            <p className="dash-empty">No hay incidencias en el mes seleccionado.</p>
          ) : (
            <table className="dash-table">
              <thead><tr><th>Tipo</th><th>Cantidad</th></tr></thead>
              <tbody>
                {incidentEntries.map(([tipo, count]) => (
                  <tr key={tipo}><td>{tipo}</td><td className="dash-num">{count}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="dash-card-foot">Use el selector de mes para consultar otro periodo.</div>
        </section>

        <div className="dash-side">
          <section className="dash-card">
            <div className="dash-card-head"><h2>Distribución por turno</h2></div>
            {shiftEntries.length === 0 ? <p className="dash-empty">Sin datos de turnos.</p> : (
              <div className="dash-bars">
                {shiftEntries.map(([turno, count]) => (
                  <div key={turno} className="dash-bar-row">
                    <div className="dash-bar-label"><span>{turno}</span><strong>{count}</strong></div>
                    <div className="dash-bar-track"><div className="dash-bar-fill" style={{ width: `${(count / maxShift) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="dash-card">
            <div className="dash-card-head"><h2>Marcaciones por hora</h2></div>
            <div className="dash-hours">
              {hours.map((count, h) => count > 0 && (
                <div key={h} className="dash-hour" title={`${pad(h)}:00 · ${count} marcas`}>
                  <div className="dash-hour-bar" style={{ height: `${(count / maxHour) * 100}%` }} />
                  <span>{pad(h)}</span>
                </div>
              ))}
              {hours.every((v) => v === 0) && <p className="dash-empty">Sin marcaciones para este día.</p>}
            </div>
          </section>
        </div>
      </div>

      <section className="dash-card dash-history">
        <div className="dash-card-head"><h2>Últimas importaciones</h2></div>
        <div className="dash-history-list">
          {history.length === 0 ? <p className="dash-empty">Sin importaciones registradas.</p> : history.map((h, i) => (
            <div key={i} className="dash-history-row">
              <span className="dash-mono">{h.startedAt}</span>
              <span className="dash-badge">{SOURCE_LABEL[h.source] || h.source}</span>
              <span className={h.ok ? 'dash-ok' : 'dash-bad'}>{h.ok ? 'OK' : 'Error'}</span>
              <span>+{h.added} nuevas · {h.skipped} duplicadas</span>
            </div>
          ))}
        </div>
      </section>

      <div className="dash-foot">Datos de solo lectura · Nómina y Asistencia CCSA</div>
    </div>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: number | string; hint: string; accent?: boolean }) {
  return (
    <div className={`dash-kpi ${accent ? 'dash-kpi-accent' : ''}`}>
      <span className="dash-label">{label}</span>
      <strong className="dash-kpi-value">{value}</strong>
      <small className="dash-kpi-hint">{hint}</small>
    </div>
  );
}
