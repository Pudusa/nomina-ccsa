const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const db = require('../database.cjs');
const attendanceService = require('./attendance.service.cjs');

// Archivos a recargar, en orden. "materia" aún no existe: se omite solo.
const FILE_NAMES = ['puerta', 'edi_adm', 'materia'];

function findFile(baseName) {
    const dirs = [
        process.env.ATTENDANCE_DATA_DIR,
        path.join(__dirname, '../../../data'),
        path.join(__dirname, '../../data'),
        path.resolve(process.cwd(), 'data'),
        path.resolve(process.cwd()),
    ].filter(Boolean);

    for (const dir of dirs) {
        for (const ext of ['.xls', '.xlsx']) {
            const candidate = path.join(dir, baseName + ext);
            if (fs.existsSync(candidate)) return candidate;
        }
    }
    return null;
}

function reloadAttendanceFiles() {
    const results = [];
    for (const name of FILE_NAMES) {
        const file = findFile(name);
        if (!file) {
            console.log(`[Reload] No se encontró '${name}', se omite.`);
            results.push({ file: name, status: 'missing' });
            continue;
        }
        try {
            const workbook = XLSX.readFile(file, { cellDates: true, dense: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);
            const { added, skipped } = attendanceService.importAttendanceRows(rows, XLSX, db);
            console.log(`[Reload] '${name}': ${added} nuevos, ${skipped} duplicados.`);
            results.push({ file: name, status: 'ok', added, skipped });
        } catch (err) {
            console.error(`[Reload] Error al procesar '${name}':`, err.message);
            results.push({ file: name, status: 'error', error: err.message });
        }
    }
    return results;
}

module.exports = { reloadAttendanceFiles, FILE_NAMES, findFile };
