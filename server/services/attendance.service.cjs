function parseToDate(val, XLSX) {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
        const dateObj = XLSX.SSF.parse_date_code(val);
        if (dateObj) {
            // Usamos Date local, no UTC
            return new Date(dateObj.y, dateObj.m - 1, dateObj.d, dateObj.H, dateObj.M, dateObj.S);
        }
    }
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
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
    parseToDate,
    formatDateKey,
    formatDateTime,
    filterDuplicatePunches,
    classifyPunches,
};
