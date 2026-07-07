/**
 * excel.js — generates a real .xlsx workbook from ledger rows using ExcelJS.
 *
 * Like csv.js this is format-only and schema-agnostic: the caller passes the
 * shared TX_EXPORT_COLUMNS (see transaction-schema.js), so no mapping logic is
 * duplicated between the CSV and Excel exports.
 *
 * ExcelJS is loaded lazily from the jsDelivr CDN on first use — the same CDN
 * (already whitelisted in the CSP) that serves Chart.js — so the heavy library
 * is only fetched when a user actually exports, and the initial page stays light.
 */

// Pinned so the browser and the Node verification harness build with identical code.
const EXCELJS_CDN = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';

const HEADER_FILL = 'FF1F2937';   // dark slate — matches the app's header row
const HEADER_TEXT = 'FFFFFFFF';
const POSITIVE_PL = 'FF16A34A';   // green
const NEGATIVE_PL = 'FFDC2626';   // red
const MONEY_FMT = '#,##0.00';
const QTY_FMT = '#,##0.####';     // up to 4 decimals for fractional shares

let excelJsPromise = null;

// Inject the ExcelJS UMD bundle once (it sets window.ExcelJS) and cache the load.
function loadExcelJs() {
    if (typeof window !== 'undefined' && window.ExcelJS) return Promise.resolve(window.ExcelJS);
    if (excelJsPromise) return excelJsPromise;
    excelJsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = EXCELJS_CDN;
        script.async = true;
        script.onload = () => (window.ExcelJS ? resolve(window.ExcelJS) : reject(new Error('ExcelJS did not initialise')));
        script.onerror = () => { excelJsPromise = null; reject(new Error('Failed to load ExcelJS')); };
        document.head.appendChild(script);
    });
    return excelJsPromise;
}

// Per-cell Excel formatting driven by the column's type hint. Numbers get a
// numeric format (so Excel stores real numbers, not text); realized P/L is
// coloured green/red by sign. Blank cells are left untouched.
function applyCellFormat(cell, type, value) {
    switch (type) {
        case 'quantity':
            cell.numFmt = QTY_FMT;
            break;
        case 'money':
            cell.numFmt = MONEY_FMT;
            break;
        case 'realized':
            if (typeof value === 'number') {
                cell.numFmt = MONEY_FMT;
                if (value > 0) cell.font = { color: { argb: POSITIVE_PL } };
                else if (value < 0) cell.font = { color: { argb: NEGATIVE_PL } };
            }
            break;
        default:
            break;
    }
}

// Rough rendered width of a value, used to size columns to fit their content.
function displayWidth(type, value) {
    if (value === '' || value == null) return 0;
    if (type === 'money' || type === 'realized') return Number(value).toFixed(2).length + 1;
    if (type === 'quantity') return String(value).length;
    return String(value).length;
}

/**
 * Build (but do not serialise) the transactions workbook. Pure and DOM-free —
 * it receives the ExcelJS constructor, so the exact same code runs in the
 * browser (CDN build) and under Node (npm build) for verification.
 */
export function buildTransactionsWorkbook(ExcelJS, transactions, columns, sheetName = 'Transactions') {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BIST Stocks Dashboard';
    workbook.created = new Date();

    // Freeze the header row.
    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = columns.map(c => ({ header: c.header, key: c.header }));

    // Bold header on a filled background.
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: HEADER_TEXT } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 20;

    for (const tx of transactions) {
        // '' → null so the cell is genuinely empty (e.g. Realized P/L on buys).
        const row = sheet.addRow(columns.map(c => {
            const v = c.get(tx);
            return v === '' || v == null ? null : v;
        }));
        columns.forEach((c, i) => applyCellFormat(row.getCell(i + 1), c.type, c.get(tx)));
    }

    // Filterable header + content-fit column widths.
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    columns.forEach((c, i) => {
        let width = String(c.header).length;
        for (const tx of transactions) {
            const w = displayWidth(c.type, c.get(tx));
            if (w > width) width = w;
        }
        sheet.getColumn(i + 1).width = Math.min(Math.max(width + 2, 10), 40);
    });

    return workbook;
}

// Trigger a client-side download of the workbook as `filename`, no page reload.
function downloadWorkbook(filename, buffer) {
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Load ExcelJS, build the workbook from the in-memory ledger, and download it.
export async function exportTransactionsXlsx(transactions, columns, filename, sheetName = 'Transactions') {
    const ExcelJS = await loadExcelJs();
    const workbook = buildTransactionsWorkbook(ExcelJS, transactions, columns, sheetName);
    const buffer = await workbook.xlsx.writeBuffer();
    downloadWorkbook(filename, buffer);
}
