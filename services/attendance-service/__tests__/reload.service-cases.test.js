import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';
import XLSX from 'xlsx';

vi.hoisted(() => {
    const path = require('path');
    const os = require('os');
    const fs = require('fs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reload-cases-'));
    process.env.DB_PATH = path.join(dir, 'att.sqlite');
    process.env.ATTENDANCE_DATA_DIR = dir;
});

import db from '../database.cjs';
const { findFile, reloadAttendanceFiles, FILE_NAMES } = await import('../services/reload.service.cjs');

const DIR = process.env.ATTENDANCE_DATA_DIR;

function makeExcel(name, rows) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, path.join(DIR, name));
}

// Cada test empieza con: BD vacía y directorio sin archivos. Sin acoplamiento por orden.
beforeEach(() => {
    db.exec('DELETE FROM attendance;');
    fs.readdirSync(DIR).filter(f => /\.(xls|xlsx)$/i.test(f)).forEach(f => fs.unlinkSync(path.join(DIR, f)));
});

afterAll(() => {
    db.close();
    setTimeout(() => { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {} }, 100);
});

describe('findFile — 5 casos', () => {
    it('1: devuelve null si el archivo no existe', () => {
        expect(findFile('no_existe')).toBeNull();
    });
    it('2: encuentra un .xls en ATTENDANCE_DATA_DIR', () => {
        makeExcel('puerta.xls', []);
        expect(findFile('puerta')).toContain('puerta.xls');
    });
    it('3: encuentra un .xlsx', () => {
        makeExcel('edi_adm.xlsx', []);
        expect(findFile('edi_adm')).toContain('edi_adm.xlsx');
    });
    it('4: prefiere .xls sobre .xlsx', () => {
        makeExcel('prefer.xls', []);
        makeExcel('prefer.xlsx', []);
        expect(findFile('prefer')).toContain('prefer.xls');
    });
    it('5: FILE_NAMES es la lista esperada', () => {
        expect(FILE_NAMES).toEqual(['puerta', 'edi_adm', 'materia']);
    });
});

describe('reloadAttendanceFiles — 5 casos', () => {
    const fila = { 'No.': 900, 'Fecha/Hora': '2026-11-10 08:00:00', 'Location ID': 'L1', 'Verificación': 'V1' };

    it('1: omite archivos inexistentes y sigue con los demas', () => {
        const res = reloadAttendanceFiles();
        expect(res).toHaveLength(3);
        expect(res.every(r => r.status === 'missing')).toBe(true);
    });
    it('2: status ok para un archivo valido', () => {
        makeExcel('puerta.xls', [fila]);
        const res = reloadAttendanceFiles();
        expect(res.find(r => r.file === 'puerta').status).toBe('ok');
    });
    it('3: agrega registros nuevos', () => {
        makeExcel('puerta.xls', [fila]);
        reloadAttendanceFiles();
        expect(db.prepare("SELECT COUNT(*) c FROM attendance WHERE worker_no='900'").get().c).toBe(1);
    });
    it('4: NO borra registros preexistentes (regresion de borrado)', () => {
        // Sembramos un registro con un working distinto y verificamos que sobrevive.
        db.prepare('INSERT INTO attendance (worker_no,date,time,timestamp,location_id,verification) VALUES (?,?,?,?,?,?)')
            .run('999', '2026-01-01', '07:00:00', '2026-01-01 07:00:00', 'L1', 'V1');
        makeExcel('puerta.xls', [fila]);
        reloadAttendanceFiles();
        expect(db.prepare("SELECT COUNT(*) c FROM attendance WHERE worker_no='999'").get().c).toBe(1);
    });
    it('5: duplicados se omiten en una segunda recarga', () => {
        makeExcel('puerta.xls', [fila]);
        reloadAttendanceFiles();      // 1ª: agrega
        const res = reloadAttendanceFiles(); // 2ª: omite
        const p = res.find(r => r.file === 'puerta');
        expect(p.added).toBe(0);
        expect(p.skipped).toBe(1);
    });
});
