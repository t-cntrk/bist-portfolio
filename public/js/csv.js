/**
 * csv.js — small, dependency-free CSV helpers (RFC 4180).
 *
 * Deliberately transaction-agnostic: it only knows how to escape fields, join a
 * header + rows into a CSV string, and trigger a browser download. The *schema*
 * (which columns, how each value is derived) lives with the data that owns it —
 * see TX_CSV_COLUMNS in transactions.js. A future CSV import can reuse
 * escapeCsvField()/the same format without dragging in any transaction logic.
 */

// RFC 4180: wrap a field in double quotes when it contains a comma, quote, CR or
// LF, and escape embedded quotes by doubling them. Everything else passes through
// untouched so plain numbers/symbols stay unquoted. null/undefined → "".
export function escapeCsvField(value) {
    const s = value == null ? '' : String(value);
    if (/[",\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

// Build a CSV document from a header array and an array of row arrays.
// Uses CRLF line endings and a UTF-8 BOM so Excel opens it with the right
// encoding (correct display of ₺ and Turkish characters).
export function buildCsv(headers, rows) {
    const lines = [headers, ...rows].map(cols => cols.map(escapeCsvField).join(','));
    return '﻿' + lines.join('\r\n');
}

// Trigger a client-side download of `content` as `filename` without a page
// reload. Uses an object URL + a transient anchor, revoked immediately after.
export function downloadCsv(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
