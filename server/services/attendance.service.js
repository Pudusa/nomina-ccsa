function parseToDate(val, XLSX) {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
        const dateObj = XLSX.SSF.parse_date_code(val);
        if (dateObj) {
            return new Date(Date.UTC(dateObj.y, dateObj.m - 1, dateObj.d, dateObj.H, dateObj.M, dateObj.S));
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

function classifyPunches(times, turno, ruleFirstMarkDir) {
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

    const marca1 = times[0] ? times[0].toISOString() : null;
    const marca2 = times.length > 1 ? times[1].toISOString() : null;

    if (!isSalidaFirst) {
        if (times.length > 0) {
            const t = times[0];
            const timeDec = t.getHours() + t.getMinutes() / 60;
            if (timeDec < 12.5) entradaMañana = t.toISOString();
            else entradaTarde = t.toISOString();
        }
        if (times.length > 1) {
            const t = times[times.length - 1];
            const timeDec = t.getHours() + t.getMinutes() / 60;
            if (timeDec < 12.5) salidaMañana = t.toISOString();
            else salidaTarde = t.toISOString();
        }
    } else {
        if (times.length > 0) {
            const t = times[0];
            const timeDec = t.getHours() + t.getMinutes() / 60;
            if (timeDec < 12.5) salidaMañana = t.toISOString();
            else salidaTarde = t.toISOString();
        }
        if (times.length > 1) {
            const t = times[1];
            const timeDec = t.getHours() + t.getMinutes() / 60;
            if (timeDec < 12.5) entradaMañana = t.toISOString();
            else entradaTarde = t.toISOString();
        }
    }

    return { entradaMañana, salidaMañana, entradaTarde, salidaTarde, marca1, marca2 };
}

module.exports = {
    parseToDate,
    formatDateKey,
    filterDuplicatePunches,
    classifyPunches,
};