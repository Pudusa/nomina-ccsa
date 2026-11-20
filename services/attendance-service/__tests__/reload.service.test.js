import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import XLSX from 'xlsx';

vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    process.env.DB_PATH = path.join(os.tmpdir(), `reload-test-${Date.now()}.sqlite`);
});

import db from '../database.cjs';
import { importAttendanceRows } from '../services/attendance.service.cjs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reload-files-'));

function makeExcel(name, rows) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const file = path.join(tmpDir, name);
    XLSX.writeFile(wb, file);
    return file;
}

describe('Recarga de archivos de asistencia', () => {
    it('agrega filas nuevas y omite duplicados sin borrar lo existente', () => {
        const rows = [{
            'No.': 123,
            'Fecha/Hora': '19/11/2026 08:00:00',
            'Location ID': 'L1',
            'Verificación': 'V1',
        }];

        const first = importAttendanceRows(rows, XLSX, db);
        expect(first.added).toBe(1);
        expect(first.skipped).toBe(0);

        const second = importAttendanceRows(rows, XLSX, db);
        expect(second.added).toBe(0);
        expect(second.skipped).toBe(1);

        const count = db.prepare("SELECT COUNT(*) AS count FROM attendance WHERE worker_no = '123'").get().count;
        expect(count).toBe(1);
    });

    it('omite un archivo que no existe y sigue con los demas (sin borrar datos)', () => {
        makeExcel('puerta.xls', [{
            'No.': 456,
            'Fecha/Hora': '19/11/2026 09:00:00',
            'Location ID': 'L1',
            'Verificación': 'V2',
        }]);

        const results = [];
        for (const name of ['puerta', 'materia']) {
            const file = path.join(tmpDir, name + '.xls');
            if (!fs.existsSync(file)) {
                results.push({ file: name, status: 'missing' });
                continue;
            }
            const workbook = XLSX.readFile(file, { cellDates: true, dense: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);
            results.push({ file: name, ...importAttendanceRows(rows, XLSX, db) });
        }

        expect(results[0].status).not.toBe('missing');
        expect(results[1].status).toBe('missing');

        // El registro del punto anterior sigue intacto.
        const oldCount = db.prepare("SELECT COUNT(*) AS count FROM attendance WHERE worker_no = '123'").get().count;
        const newCount = db.prepare("SELECT COUNT(*) AS count FROM attendance WHERE worker_no = '456'").get().count;
        expect(oldCount).toBe(1);
        expect(newCount).toBe(1);
    });

    afterAll(() => {
        db.close();
        setTimeout(() => {
            try { fs.unlinkSync(process.env.DB_PATH); } catch {}
            try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        }, 100);
    });
});
