import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';

vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zk-cases-'));
    process.env.DB_PATH = path.join(dir, 'att.sqlite');
    process.env.JWT_SECRET = 'test-secret';
    globalThis.__ZK_TEST_DIR = dir;
});

import db from '../database.cjs';
const {
    localDateTime, parseDevices, syncDevice, syncAllDevices,
    getSettings, getConfig, saveConfig, shouldRunScheduled, shouldRunOnStartup,
    markSyncedToday, getHistory,
} = await import('../services/zk-devices.service.cjs');

function makeLib(logs, options = {}) {
    const instances = [];
    class MockZK {
        constructor(ip, port, timeout, commKey) {
            Object.assign(this, { ip, port, timeout, commKey });
            this.disconnected = false;
            instances.push(this);
        }
        async createSocket() {
            if (options.failConnect) throw new Error('sin conexión');
            this.connected = true;
        }
        async getAttendances() {
            if (options.failLogs) throw new Error('falló lectura');
            return { data: logs };
        }
        async disconnect() { this.disconnected = true; }
    }
    return { Lib: MockZK, instances };
}

const p = n => String(n).padStart(2, '0');
function expectedLocal(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
           `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

beforeEach(() => {
    db.exec(`
        DELETE FROM attendance;
        DELETE FROM zk_devices;
        DELETE FROM zk_sync_history;
        UPDATE zk_settings SET sync_hour = 0, sync_minute = 0, enabled = 1, last_sync_date = NULL WHERE id = 1;
    `);
    delete process.env.ZK_DEVICES;
    delete process.env.ZK_IP;
    delete process.env.ZK_PORT;
    delete process.env.ZK_COMM_KEY;
});

afterAll(() => {
    db.close();
    setTimeout(() => {
        try { fs.rmSync(globalThis.__ZK_TEST_DIR, { recursive: true, force: true }); } catch {}
    }, 100);
});

describe('localDateTime — 3 casos', () => {
    it('1: convierte el ISO UTC del reloj a hora local del servidor', () => {
        expect(localDateTime('2026-07-13T13:50:20.000Z')).toBe(expectedLocal('2026-07-13T13:50:20.000Z'));
    });
    it('2: devuelve null si la fecha no es válida', () => {
        expect(localDateTime('no-es-fecha')).toBeNull();
    });
    it('3: rellena con ceros los componentes de un solo dígito', () => {
        expect(localDateTime('2026-01-02T03:04:05.000Z')).toBe(expectedLocal('2026-01-02T03:04:05.000Z'));
    });
});

describe('parseDevices — 4 casos', () => {
    it('4: lee varios dispositivos desde ZK_DEVICES', () => {
        process.env.ZK_DEVICES = JSON.stringify([
            { ip: '192.168.107.13', commKey: 0 },
            { ip: '192.168.107.14', port: 4371, commKey: 2 },
        ]);
        expect(parseDevices()).toHaveLength(2);
        expect(parseDevices()[1].port).toBe(4371);
    });
    it('5: usa ZK_IP/ZK_PORT/ZK_COMM_KEY como atajo de un dispositivo', () => {
        process.env.ZK_IP = '10.0.0.5';
        process.env.ZK_PORT = '4370';
        process.env.ZK_COMM_KEY = '7';
        expect(parseDevices()).toEqual([{ ip: '10.0.0.5', port: 4370, commKey: 7 }]);
    });
    it('6: devuelve [] si no hay configuración', () => {
        expect(parseDevices()).toEqual([]);
    });
    it('7: devuelve [] si ZK_DEVICES no es JSON válido', () => {
        process.env.ZK_DEVICES = '{malo';
        expect(parseDevices()).toEqual([]);
    });
});

describe('syncDevice — 4 casos', () => {
    it('8: inserta las marcas nuevas y devuelve contadores', async () => {
        const logs = [
            { deviceUserId: '791', recordTime: '2026-07-13T13:50:20.000Z' },
            { deviceUserId: '698', recordTime: '2026-07-13T13:55:58.000Z' },
        ];
        const { Lib } = makeLib(logs);
        const result = await syncDevice({ ip: '1.2.3.4' }, { zkLib: Lib, db });
        expect(result).toEqual({ added: 2, skipped: 0 });
        expect(db.prepare('SELECT COUNT(*) c FROM attendance').get().c).toBe(2);
    });
    it('9: omite duplicados en una segunda sincronización', async () => {
        const logs = [{ deviceUserId: '791', recordTime: '2026-07-13T13:50:20.000Z' }];
        const first = makeLib(logs);
        await syncDevice({ ip: '1.2.3.4' }, { zkLib: first.Lib, db });
        const second = makeLib(logs);
        const result = await syncDevice({ ip: '1.2.3.4' }, { zkLib: second.Lib, db });
        expect(result).toEqual({ added: 0, skipped: 1 });
        expect(db.prepare('SELECT COUNT(*) c FROM attendance').get().c).toBe(1);
    });
    it('10: desconecta aunque falle la lectura de marcas', async () => {
        const { Lib, instances } = makeLib([], { failLogs: true });
        await expect(syncDevice({ ip: '1.2.3.4' }, { zkLib: Lib, db })).rejects.toThrow('falló lectura');
        expect(instances[0].disconnected).toBe(true);
    });
    it('11: guarda la hora local, nunca la UTC (regresión de zona horaria)', async () => {
        const iso = '2026-07-13T13:50:20.000Z';
        const { Lib } = makeLib([{ deviceUserId: '791', recordTime: iso }]);
        await syncDevice({ ip: '1.2.3.4' }, { zkLib: Lib, db });
        expect(db.prepare('SELECT timestamp FROM attendance').get().timestamp).toBe(localDateTime(iso));
    });
});

describe('syncAllDevices — 3 casos', () => {
    it('12: procesa los dispositivos en orden secuencial', async () => {
        const order = [];
        class OrderedLib {
            constructor(ip) { order.push(ip); }
            async createSocket() {}
            async getAttendances() { return { data: [] }; }
            async disconnect() {}
        }
        const devices = [{ ip: 'A' }, { ip: 'B' }, { ip: 'C' }];
        const results = await syncAllDevices({ devices, zkLib: OrderedLib, db });
        expect(order).toEqual(['A', 'B', 'C']);
        expect(results).toHaveLength(3);
    });
    it('13: captura el error de un reloj y continúa con los demás', async () => {
        class FlakyLib {
            constructor(ip) { this.ip = ip; }
            async createSocket() { if (this.ip === 'B') throw new Error('caído'); }
            async getAttendances() { return { data: [] }; }
            async disconnect() {}
        }
        const devices = [{ ip: 'A' }, { ip: 'B' }, { ip: 'C' }];
        const results = await syncAllDevices({ devices, zkLib: FlakyLib, db });
        expect(results.map(r => r.ok)).toEqual([true, false, true]);
        expect(results[1].error).toBe('No se pudo sincronizar');
    });
    it('14: devuelve [] y no conecta si no hay dispositivos configurados', async () => {
        const { Lib, instances } = makeLib([]);
        const results = await syncAllDevices({ zkLib: Lib, db });
        expect(results).toEqual([]);
        expect(instances).toHaveLength(0);
    });
});

describe('configuración persistida — 7 casos', () => {
    it('15: getConfig devuelve la configuración por defecto', () => {
        const config = getConfig(db);
        expect(config.settings.syncHour).toBe(0);
        expect(config.settings.syncMinute).toBe(0);
        expect(config.settings.enabled).toBe(1);
        expect(config.devices).toEqual([]);
    });
    it('16: saveConfig guarda hora, minuto y equipos', () => {
        saveConfig({
            hour: 12, minute: 45, enabled: true,
            devices: [{ name: 'Reloj 1', ip: '192.168.107.13', port: 4370, commKey: 0 }],
        }, db);
        const config = getConfig(db);
        expect(config.settings.syncHour).toBe(12);
        expect(config.settings.syncMinute).toBe(45);
        expect(config.devices).toHaveLength(1);
        expect(config.devices[0].ip).toBe('192.168.107.13');
        expect(config.devices[0].commKey).toBe(0);
    });
    it('17: saveConfig reemplaza la lista anterior, no la acumula', () => {
        saveConfig({ hour: 1, minute: 0, enabled: true, devices: [{ ip: '10.0.0.1' }, { ip: '10.0.0.2' }] }, db);
        saveConfig({ hour: 1, minute: 0, enabled: true, devices: [{ ip: '10.0.0.3' }] }, db);
        expect(getConfig(db).devices.map(d => d.ip)).toEqual(['10.0.0.3']);
    });
    it('18: saveConfig respeta el equipo desactivado', () => {
        saveConfig({ hour: 1, minute: 0, enabled: true, devices: [{ ip: '10.0.0.1', enabled: false }] }, db);
        expect(getConfig(db).devices[0].enabled).toBe(0);
    });
    it('19: guardar la configuración limpia last_sync_date para poder volver a disparar', () => {
        markSyncedToday(db);
        expect(getSettings(db).lastSyncDate).not.toBeNull();
        saveConfig({ hour: 10, minute: 15, enabled: true, devices: [] }, db);
        expect(getSettings(db).lastSyncDate).toBeNull();
    });
    it('20: markSyncedToday persiste una fecha con formato YYYY-MM-DD', () => {
        markSyncedToday(db);
        expect(getSettings(db).lastSyncDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    it('21: saveConfig desactiva la sincronización automática', () => {
        saveConfig({ hour: 8, minute: 0, enabled: false, devices: [] }, db);
        expect(getSettings(db).enabled).toBe(0);
    });
});

describe('arranque y hora programada — 5 casos', () => {
    const base = { syncHour: 12, syncMinute: 30, enabled: 1, lastSyncDate: null };
    it('22: el arranque recupera si no se sincronizó hoy', () => {
        expect(shouldRunOnStartup(new Date(2026, 10, 20, 8, 0), base)).toBe(true);
    });
    it('23: el arranque no se dispara dos veces el mismo día', () => {
        expect(shouldRunOnStartup(new Date(2026, 10, 20, 8, 0), { ...base, lastSyncDate: '2026-11-20' })).toBe(false);
    });
    it('24: la automática dispara a la hora configurada de un día distinto', () => {
        expect(shouldRunScheduled(new Date(2026, 10, 21, 12, 30), { ...base, lastSyncDate: '2026-11-20' })).toBe(true);
    });
    it('25: la automática no dispara si está desactivada', () => {
        expect(shouldRunScheduled(new Date(2026, 10, 21, 12, 30), { ...base, enabled: 0 })).toBe(false);
    });
    it('26: REGRESIÓN — arrancar temprano no consume la automática de las 12:30', () => {
        expect(shouldRunScheduled(new Date(2026, 10, 20, 8, 0), base)).toBe(false);
        expect(shouldRunScheduled(new Date(2026, 10, 20, 12, 30), base)).toBe(true);
    });
});

describe('equipos configurados — 2 casos', () => {
    it('27: syncAllDevices usa solo los equipos habilitados de la BD', async () => {
        saveConfig({
            hour: 1, minute: 0, enabled: true,
            devices: [{ name: 'A', ip: '10.0.0.1' }, { name: 'B', ip: '10.0.0.2', enabled: false }],
        }, db);
        const ips = [];
        class Lib {
            constructor(ip) { ips.push(ip); }
            async createSocket() {}
            async getAttendances() { return { data: [] }; }
            async disconnect() {}
        }
        const results = await syncAllDevices({ zkLib: Lib, db });
        expect(ips).toEqual(['10.0.0.1']);
        expect(results).toHaveLength(1);
    });
    it('28: usa ZK_DEVICES del entorno si la BD no tiene equipos', async () => {
        process.env.ZK_DEVICES = JSON.stringify([{ ip: '10.0.0.9' }]);
        const ips = [];
        class Lib {
            constructor(ip) { ips.push(ip); }
            async createSocket() {}
            async getAttendances() { return { data: [] }; }
            async disconnect() {}
        }
        await syncAllDevices({ zkLib: Lib, db });
        expect(ips).toEqual(['10.0.0.9']);
    });
});

describe('historial de importaciones — 5 casos', () => {
    it('29: registra el origen manual y los contadores', async () => {
        const logs = [{ deviceUserId: '791', recordTime: '2026-07-13T13:50:20.000Z' }];
        const { Lib } = makeLib(logs);
        await syncAllDevices({ devices: [{ ip: '1.2.3.4' }], zkLib: Lib, db, source: 'manual' });
        const history = getHistory(50, db);
        expect(history).toHaveLength(1);
        expect(history[0].source).toBe('manual');
        expect(history[0].deviceIp).toBe('1.2.3.4');
        expect(history[0].added).toBe(1);
        expect(history[0].skipped).toBe(0);
    });
    it('30: registra el origen automático', async () => {
        const { Lib } = makeLib([]);
        await syncAllDevices({ devices: [{ ip: '1.2.3.4' }], zkLib: Lib, db, source: 'automatica' });
        expect(getHistory(50, db)[0].source).toBe('automatica');
    });
    it('31: registra un reloj fallido con error genérico', async () => {
        class FlakyLib {
            constructor(ip) { this.ip = ip; }
            async createSocket() { if (this.ip === 'B') throw new Error('detalle interno'); }
            async getAttendances() { return { data: [] }; }
            async disconnect() {}
        }
        await syncAllDevices({ devices: [{ ip: 'A' }, { ip: 'B' }], zkLib: FlakyLib, db, source: 'automatica' });
        const history = getHistory(50, db);
        expect(history).toHaveLength(2);
        const failed = history.find(h => h.deviceIp === 'B');
        expect(failed.ok).toBe(0);
        expect(failed.error).toBe('No se pudo sincronizar');
    });
    it('32: devuelve las importaciones más recientes primero', async () => {
        const { Lib } = makeLib([]);
        await syncAllDevices({ devices: [{ ip: '1.2.3.4' }], zkLib: Lib, db, source: 'manual' });
        const second = makeLib([]);
        await syncAllDevices({ devices: [{ ip: '1.2.3.4' }], zkLib: second.Lib, db, source: 'automatica' });
        expect(getHistory(50, db).map(h => h.source)).toEqual(['automatica', 'manual']);
    });
    it('33: una sincronización sin origen no ensucia el historial', async () => {
        const { Lib } = makeLib([]);
        await syncAllDevices({ devices: [{ ip: '1.2.3.4' }], zkLib: Lib, db });
        expect(getHistory(50, db)).toEqual([]);
    });
});
