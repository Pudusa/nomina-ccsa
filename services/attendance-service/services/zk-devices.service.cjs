// Sincronización de marcajes desde terminales ZKTeco por protocolo binario :4370.
// La configuración (hora y equipos) vive en SQLite y se edita desde el panel admin.
const XLSX = require('xlsx');
const ZKLib = require('node-zklib');
const db = require('../database.cjs');
const { importAttendanceRows } = require('./attendance.service.cjs');

const TIMEOUT_MS = 5000;

function dateKey(now) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// recordTime llega en ISO UTC; se convierte a hora local del servidor, que es
// la del reloj. Así se conserva la hora exacta sin conversión artificial.
function localDateTime(recordTime) {
  const d = new Date(recordTime);
  if (isNaN(d.getTime())) return null;
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function getSettings(database = db) {
  return database.prepare(
    'SELECT sync_hour AS syncHour, sync_minute AS syncMinute, enabled, last_sync_date AS lastSyncDate FROM zk_settings WHERE id = 1'
  ).get();
}

function getConfig(database = db) {
  return {
    settings: getSettings(database),
    devices: database.prepare(
      'SELECT id, name, ip, port, comm_key AS commKey, enabled FROM zk_devices ORDER BY id'
    ).all(),
  };
}

function saveConfig(config, database = db) {
  const hour = Number(config.hour);
  const minute = Number(config.minute);
  const devices = Array.isArray(config.devices) ? config.devices : [];
  database.transaction(() => {
    // last_sync_date se limpia para que un cambio de hora vuelva a disparar la sincronización.
    database.prepare('UPDATE zk_settings SET sync_hour = ?, sync_minute = ?, enabled = ?, last_sync_date = NULL WHERE id = 1')
      .run(hour, minute, config.enabled === false ? 0 : 1);
    database.prepare('DELETE FROM zk_devices').run();
    const insert = database.prepare('INSERT INTO zk_devices (name, ip, port, comm_key, enabled) VALUES (?, ?, ?, ?, ?)');
    for (const d of devices) {
      insert.run(String(d.name || d.ip), String(d.ip), Number(d.port || 4370), Number(d.commKey || 0), d.enabled === false ? 0 : 1);
    }
  })();
  return getConfig(database);
}

// Configuración heredada de variables de entorno, usada sólo si no hay equipos en BD.
function parseDevices() {
  const raw = process.env.ZK_DEVICES;
  if (raw) {
    try {
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list.filter(d => d && d.ip) : [];
    } catch (err) {
      console.error('[ZK] ZK_DEVICES no es JSON válido:', err.message);
      return [];
    }
  }
  if (!process.env.ZK_IP) return [];
  return [{
    ip: process.env.ZK_IP,
    port: Number(process.env.ZK_PORT || 4370),
    commKey: Number(process.env.ZK_COMM_KEY || 0),
  }];
}

function devicesToSync(database = db) {
  const stored = database.prepare('SELECT name, ip, port, comm_key AS commKey FROM zk_devices WHERE enabled = 1 ORDER BY id').all();
  return stored.length ? stored : parseDevices();
}

// Se ejecuta al arrancar (lastSyncDate null) y a la hora configurada de cada día.
// La fecha persistida evita duplicar tras reinicios del contenedor.
function shouldRunScheduled(now, settings) {
  if (!settings || !settings.enabled) return false;
  if (settings.lastSyncDate === dateKey(now)) return false;
  const isConfiguredTime = now.getHours() === settings.syncHour && now.getMinutes() === settings.syncMinute;
  return isConfiguredTime || settings.lastSyncDate === null;
}

function markSyncedToday(database = db) {
  database.prepare('UPDATE zk_settings SET last_sync_date = ? WHERE id = 1').run(dateKey(new Date()));
}

async function syncDevice(device, options = {}) {
  const Lib = options.zkLib || ZKLib;
  const database = options.db || db;
  const zk = new Lib(device.ip, device.port || 4370, TIMEOUT_MS, Number(device.commKey || 0));
  try {
    await zk.createSocket();
    const logs = await zk.getAttendances();
    const rows = (logs.data || [])
      .map(log => ({
        'No.': String(log.deviceUserId || ''),
        'Fecha/Hora': localDateTime(log.recordTime),
        'Location ID': '',
        'Verificación': '',
      }))
      .filter(row => row['No.'] && row['Fecha/Hora']);
    return importAttendanceRows(rows, XLSX, database);
  } finally {
    if (typeof zk.disconnect === 'function') await zk.disconnect();
  }
}

async function syncAllDevices(options = {}) {
  const devices = options.devices || devicesToSync(options.db || db);
  const results = [];
  // Secuencial a propósito: el firmware ZEM 6.5.4 se bloquea con peticiones concurrentes.
  for (const device of devices) {
    try {
      const result = await syncDevice(device, options);
      results.push({ ip: device.ip, ok: true, ...result });
    } catch (err) {
      console.error('[ZK] Error al sincronizar', device.ip, err);
      // No se expone el mensaje interno de la librería al cliente.
      results.push({ ip: device.ip, ok: false, error: 'No se pudo sincronizar' });
    }
  }
  return results;
}

module.exports = {
  dateKey, localDateTime, parseDevices, getSettings, getConfig, saveConfig,
  shouldRunScheduled, markSyncedToday, syncDevice, syncAllDevices,
};
