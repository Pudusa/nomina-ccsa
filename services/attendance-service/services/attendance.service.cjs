const Database = require('better-sqlite3');
const path = require('path');

function getWorkersDb() {
  const possiblePaths = [
    path.join(__dirname, '../../workers-service/workers.sqlite'),
    path.join(__dirname, '../../../services/workers-service/workers.sqlite'),
    path.join(__dirname, '../workers.sqlite'),
    path.join(__dirname, '../../data/workers.sqlite'),
    path.join(__dirname, '../../../data/workers.sqlite'),
    path.join(__dirname, '../../data/nomina.db'),
    path.join(__dirname, '../../../data/nomina.db')
  ];
  for (const p of possiblePaths) {
    if (require('fs').existsSync(p)) {
      try {
        const db = new Database(p, { readonly: true });
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
        if (tables.includes('shift_rules') || tables.includes('workers')) {
          return db;
        }
        db.close();
      } catch (e) {}
    }
  }
  return null;
}

function getNominaDb() {
  const nominaPath = process.env.NOMINA_DB_PATH || path.join(__dirname, '../../../data/nomina.db');
  if (require('fs').existsSync(nominaPath)) {
    return new Database(nominaPath, { readonly: true });
  }
  const altPath = path.join(__dirname, '../../data/nomina.db');
  if (require('fs').existsSync(altPath)) {
    return new Database(altPath, { readonly: true });
  }
  const localPath = path.join(__dirname, '../nomina.db');
  if (require('fs').existsSync(localPath)) {
    return new Database(localPath, { readonly: true });
  }
  return null;
}

function parseToDate(val, XLSX) {
    const rec = parseAttendanceRecord(val, XLSX);
    return rec ? rec.dateObj : null;
}

function parseAttendanceRecord(val, XLSX) {
    if (!val) return null;
    let y, m, d, H = 0, M = 0, S = 0;

    if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        y = val.getUTCFullYear();
        m = val.getUTCMonth() + 1;
        d = val.getUTCDate();
        H = val.getUTCHours();
        M = val.getUTCMinutes();
        S = val.getUTCSeconds();
    } else if (typeof val === 'number') {
        const dateObj = XLSX ? XLSX.SSF.parse_date_code(val) : null;
        if (!dateObj) return null;
        y = dateObj.y;
        m = dateObj.m;
        d = dateObj.d;
        H = dateObj.H || 0;
        M = dateObj.M || 0;
        S = dateObj.S || 0;
    } else if (typeof val === 'string') {
        const cleanVal = val.trim();
        // Soporta YYYY-MM-DD o YYYY/MM/DD con hora opcional y AM/PM opcional
        const matchISO = cleanVal.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?)?/i);
        // Soporta DD/MM/YYYY o DD-MM-YYYY con hora opcional y AM/PM opcional
        const matchDMY = cleanVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\s*(AM|PM))?)?/i);
        
        let ampm = null;
        if (matchISO) {
            let monthStr, dayStr, hourStr, minStr, secStr;
            [, y, monthStr, dayStr, hourStr, minStr, secStr, ampm] = matchISO;
            m = parseInt(monthStr, 10);
            d = parseInt(dayStr, 10);
            y = parseInt(y, 10);
            H = hourStr ? parseInt(hourStr, 10) : 0;
            M = minStr ? parseInt(minStr, 10) : 0;
            S = secStr ? parseInt(secStr, 10) : 0;
        } else if (matchDMY) {
            let dayStr, monthStr, yearStr, hourStr, minStr, secStr;
            [, dayStr, monthStr, yearStr, hourStr, minStr, secStr, ampm] = matchDMY;
            d = parseInt(dayStr, 10);
            m = parseInt(monthStr, 10);
            y = yearStr.length === 2 ? parseInt('20' + yearStr, 10) : parseInt(yearStr, 10);
            H = hourStr ? parseInt(hourStr, 10) : 0;
            M = minStr ? parseInt(minStr, 10) : 0;
            S = secStr ? parseInt(secStr, 10) : 0;
        } else {
            const parsed = new Date(val);
            if (isNaN(parsed.getTime())) return null;
            y = parsed.getFullYear();
            m = parsed.getMonth() + 1;
            d = parsed.getDate();
            H = parsed.getHours();
            M = parsed.getMinutes();
            S = parsed.getSeconds();
        }

        if (ampm) {
            const up = ampm.toUpperCase();
            if (up === 'PM' && H < 12) H += 12;
            if (up === 'AM' && H === 12) H = 0;
        }
    } else {
        return null;
    }

    const year = String(y);
    const month = String(m).padStart(2, '0');
    const day = String(d).padStart(2, '0');
    const hours = String(H).padStart(2, '0');
    const minutes = String(M).padStart(2, '0');
    const seconds = String(S).padStart(2, '0');

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hours}:${minutes}:${seconds}`;
    const timestampStr = `${dateStr} ${timeStr}`;
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10), parseInt(hours, 10), parseInt(minutes, 10), parseInt(seconds, 10));

    return { dateStr, timeStr, timestampStr, dateObj };
}

function formatDateKey(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateTime(d) {
    if (!d || isNaN(d.getTime())) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function filterDuplicatePunches(times) {
    if (!times || times.length <= 1) return times;
    const filtered = [times[0]];
    const MIN_GAP_MS = 30 * 60 * 1000;

    for (let i = 1; i < times.length; i++) {
        const lastAccepted = filtered[filtered.length - 1];
        const current = times[i];
        if (current.getTime() - lastAccepted.getTime() >= MIN_GAP_MS) {
            filtered.push(current);
        }
    }
    return filtered;
}

function classifyPunches(times, turno, ruleFirstMarkDir, numMarcas = 2) {
    let entradaMañana = null;
    let salidaMañana = null;
    let entradaTarde = null;
    let salidaTarde = null;

    if (!times || times.length === 0) {
        return { entradaMañana, salidaMañana, entradaTarde, salidaTarde, marca1: null, marca2: null };
    }

    const tLower = (turno || '').toLowerCase();
    const isNightOrAfternoon = tLower.includes('turno 2') || tLower.includes('nocturno') || tLower.includes('vespertino');
    const isSalidaFirst = ruleFirstMarkDir === 'salida' || isNightOrAfternoon;

    const marca1 = formatDateTime(times[0]);
    const marca2 = (times.length > 1 && numMarcas > 1) ? formatDateTime(times[1]) : null;

    if (numMarcas === 1) {
        // 1 sola marca esperada
        const t = times[0];
        const timeDec = t.getHours() + t.getMinutes() / 60;
        if (!isSalidaFirst) {
            if (timeDec < 12.5) entradaMañana = formatDateTime(t);
            else entradaTarde = formatDateTime(t);
        } else {
            if (timeDec < 12.5) salidaMañana = formatDateTime(t);
            else salidaTarde = formatDateTime(t);
        }
    } else {
        // 2 marcas esperadas
        if (!isSalidaFirst) {
            // Orden normal: Entrada primero, Salida después
            if (times.length > 0) {
                const t0 = times[0];
                const timeDec0 = t0.getHours() + t0.getMinutes() / 60;
                if (timeDec0 < 12.5) entradaMañana = formatDateTime(t0);
                else entradaTarde = formatDateTime(t0);
            }
            if (times.length > 1) {
                const t1 = times[times.length - 1];
                const timeDec1 = t1.getHours() + t1.getMinutes() / 60;
                if (timeDec1 < 12.5) salidaMañana = formatDateTime(t1);
                else salidaTarde = formatDateTime(t1);
            }
        } else {
            // Orden inverso: Salida primero (ej. turno nocturno / salida matutina), Entrada después
            if (times.length === 1) {
                const t0 = times[0];
                const timeDec0 = t0.getHours() + t0.getMinutes() / 60;
                if (timeDec0 < 12.5) salidaMañana = formatDateTime(t0);
                else salidaTarde = formatDateTime(t0);
            } else if (times.length > 1) {
                const t0 = times[0];
                const timeDec0 = t0.getHours() + t0.getMinutes() / 60;
                if (timeDec0 < 12.5) salidaMañana = formatDateTime(t0);
                else salidaTarde = formatDateTime(t0);

                const t1 = times[1];
                const timeDec1 = t1.getHours() + t1.getMinutes() / 60;
                if (timeDec1 < 12.5) entradaMañana = formatDateTime(t1);
                else salidaTarde = formatDateTime(t1);
            }
        }
    }

    return { entradaMañana, salidaMañana, entradaTarde, salidaTarde, marca1, marca2 };
}

module.exports = {
    getWorkersDb,
    getNominaDb,
    parseToDate,
    parseAttendanceRecord,
    formatDateKey,
    formatDateTime,
    filterDuplicatePunches,
    classifyPunches,
};
