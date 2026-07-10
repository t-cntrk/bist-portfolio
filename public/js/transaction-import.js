/**
 * transaction-import.js — CSV transaction import with a preview/confirmation flow.
 *
 * Reuses the export building blocks: parseCsv (csv.js) and the shared column
 * headers (TX_EXPORT_COLUMNS) so import maps exactly the columns export writes.
 * The heavy lifting — validating every row, replaying buys/sells chronologically
 * through the real business logic, and keeping the weighted-average ledger
 * consistent — happens on the server (POST /api/portfolio/import). This module
 * only parses the file, drives the two-step preview → confirm exchange, and
 * refreshes the UI on success.
 */
import { parseCsv } from './csv.js';
import { TX_EXPORT_COLUMNS } from './transaction-schema.js';
import { createApiRequest } from './api.js';
import { createModal, closeModal, escapeHtml } from './dom-helpers.js';
import { showErrorMessage, showSuccessMessage } from './notifications.js';
import { formatNumber } from './formatters.js';

const tr = (key, fallback) => (window.t ? window.t(key) : fallback);

// Export header → the field name the import endpoint expects. Import only consumes
// what it can act on; the other export columns (Total Amount, Currency, Realized
// P/L) are recomputed by the replay and intentionally ignored here.
const HEADER_KEYS = {
    'Executed Date': 'executedAt',
    'Symbol': 'symbol',
    'Transaction Type': 'transactionType',
    'Quantity': 'quantity',
    'Unit Price': 'unitPrice'
};
const REQUIRED_HEADERS = Object.keys(HEADER_KEYS);

// Guard: every header we require must still be defined by the shared export
// schema, so a future column rename can't silently drift import out of sync.
const SCHEMA_HEADERS = new Set(TX_EXPORT_COLUMNS.map(c => c.header));

// Parse CSV text into the normalized rows the server expects. Values are sent as
// strings; the server validates and coerces them (and rejects the whole file on
// any bad row).
export function parseTransactionsCsv(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) return { error: tr('import.errEmpty', 'CSV boş veya yalnızca başlık satırı içeriyor') };

    const header = rows[0].map(h => h.trim());
    const missing = REQUIRED_HEADERS.filter(h => !header.includes(h) || !SCHEMA_HEADERS.has(h));
    if (missing.length) {
        return { error: tr('import.errHeaders', 'Beklenen sütunlar eksik: ') + missing.join(', ') };
    }

    const idx = {};
    for (const h of REQUIRED_HEADERS) idx[HEADER_KEYS[h]] = header.indexOf(h);

    const out = [];
    for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        out.push({
            executedAt: (r[idx.executedAt] || '').trim(),
            symbol: (r[idx.symbol] || '').trim(),
            transactionType: (r[idx.transactionType] || '').trim().toLowerCase(),
            quantity: (r[idx.quantity] || '').trim(),
            unitPrice: (r[idx.unitPrice] || '').trim()
        });
    }
    return { rows: out };
}

// POST rows to the import endpoint. confirm=false → server dry-runs and returns a
// preview; confirm=true → server commits.
async function postImport(rows, confirm) {
    const res = await createApiRequest('/api/portfolio/import', {
        method: 'POST',
        body: JSON.stringify({ rows, confirm })
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

// Turn a server error payload into a short, readable message.
function errorText(data) {
    if (data && Array.isArray(data.errors) && data.errors.length) {
        return data.errors.slice(0, 6)
            .map(e => (e.row ? `#${e.row}: ${e.message}` : e.message))
            .join('  •  ');
    }
    return (data && data.message) || tr('import.errFailed', 'İçe aktarma başarısız');
}

// Public entry point: open a file picker, preview, then (on confirm) import.
export async function openCsvImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
        const file = input.files && input.files[0];
        input.remove();
        if (!file) return;
        try {
            const text = await file.text();
            const { rows, error } = parseTransactionsCsv(text);
            if (error) { showErrorMessage(error); return; }

            const preview = await postImport(rows, false);
            if (!preview.ok || !preview.data || preview.data.valid === false) {
                showErrorMessage(errorText(preview.data));
                return;
            }
            showImportPreview(preview.data.summary, rows);
        } catch (err) {
            console.error('CSV import error:', err);
            showErrorMessage(tr('import.errFailed', 'İçe aktarma başarısız'));
        }
    });
    document.body.appendChild(input);
    input.click();
}

// Localized transaction-type / date helpers reused by the preview.
function fmtDate(s) { return escapeHtml(String(s || '').slice(0, 16)); }

// Build and show the confirmation modal from the dry-run summary.
function showImportPreview(summary, rows) {
    const s = summary || {};
    const realized = Number(s.realizedTotalTRY) || 0;
    const realizedSign = realized > 0 ? '+' : '';
    const realizedColor = realized > 0 ? '#34d399' : (realized < 0 ? '#f87171' : 'rgba(255,255,255,0.7)');

    const positionsRows = (s.positions || []).slice(0, 40).map(p => `
        <tr>
            <td style="padding:4px 10px;color:#fff;">${escapeHtml(String(p.symbol).replace('.IS', ''))}</td>
            <td style="padding:4px 10px;color:rgba(255,255,255,0.6);">${escapeHtml(p.type)}</td>
            <td style="padding:4px 10px;text-align:right;color:#fff;">${escapeHtml(formatNumber(Number(p.quantity) || 0, 2))}</td>
            <td style="padding:4px 10px;text-align:right;color:rgba(255,255,255,0.8);">${escapeHtml(formatNumber(Number(p.purchase_price) || 0, 2))}</td>
        </tr>`).join('');

    // When the server's dry-run detects rows already present in the ledger, warn
    // that importing will create duplicates. Import performs no deduplication, so
    // the user must tick an acknowledgment before the confirm button unlocks.
    const dupCount = Number(s.duplicates) || 0;
    const dupWarning = dupCount > 0 ? `
        <div id="importDupWarning" style="display:flex;flex-direction:column;gap:10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.45);border-radius:12px;padding:14px 16px;margin-bottom:16px;">
            <div style="display:flex;gap:10px;align-items:flex-start;">
                <span style="font-size:18px;line-height:1;">&#9888;&#65039;</span>
                <div style="font-size:13px;color:#fbbf24;line-height:1.5;">
                    <strong style="color:#fcd34d;">${escapeHtml(tr('import.dupTitle', 'Yinelenen işlemler algılandı'))}</strong><br>
                    ${escapeHtml(tr('import.dupBody', 'Bu dosyadaki {n} işlem geçmişinizde zaten mevcut görünüyor. İçe aktarmak, bu işlemlerin yinelenen kopyalarını oluşturur (otomatik birleştirme yapılmaz).').replace('{n}', String(dupCount)))}
                </div>
            </div>
            <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:#fff;cursor:pointer;">
                <input type="checkbox" id="importDupAck" style="width:16px;height:16px;cursor:pointer;accent-color:#f59e0b;">
                ${escapeHtml(tr('import.dupAck', 'Anladım, yine de içe aktar'))}
            </label>
        </div>` : '';

    const stat = (label, value) => `
        <div style="flex:1;min-width:90px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 14px;">
            <div style="font-size:11px;letter-spacing:.4px;color:rgba(255,255,255,0.5);text-transform:uppercase;">${label}</div>
            <div style="font-size:18px;font-weight:700;color:#fff;margin-top:2px;">${value}</div>
        </div>`;

    const modalContent = `
        <div style="background:rgba(20,24,34,0.92);backdrop-filter:blur(20px);border-radius:20px;border:1px solid rgba(255,255,255,0.13);box-shadow:0 25px 45px rgba(0,0,0,0.35);padding:30px 28px 22px;min-width:340px;max-width:min(96vw,620px);position:relative;display:flex;flex-direction:column;">
            <div style='position:absolute;top:12px;right:12px;'>
                <button class="close-btn" id="importCancelBtn" style="background:transparent;border:none;padding:0;width:26px;height:26px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                    <span style="font-size:1.15em;color:#e57373;">&#10005;</span>
                </button>
            </div>
            <h3 style="margin:0 0 6px;font-size:1.3em;font-weight:700;color:#fff;">${escapeHtml(tr('import.previewTitle', 'İçe Aktarma Önizlemesi'))}</h3>
            <p style="margin:0 0 18px;color:rgba(255,255,255,0.6);font-size:13px;">${escapeHtml(tr('import.previewHint', 'Aşağıdaki işlemler kronolojik olarak uygulanacak. Onaylamadan hiçbir şey kaydedilmez.'))}</p>

            ${dupWarning}

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
                ${stat(escapeHtml(tr('import.stTotal', 'Toplam')), escapeHtml(String(s.total || 0)))}
                ${stat(escapeHtml(tr('tx.buy', 'Alış')), escapeHtml(String(s.buys || 0)))}
                ${stat(escapeHtml(tr('tx.sell', 'Satış')), escapeHtml(String(s.sells || 0)))}
                ${stat(escapeHtml(tr('import.stSymbols', 'Varlık')), escapeHtml(String(s.symbols || 0)))}
            </div>

            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:16px;font-size:13px;color:rgba(255,255,255,0.7);flex-wrap:wrap;">
                <span>${escapeHtml(tr('import.range', 'Tarih aralığı'))}: <strong style="color:#fff;">${fmtDate(s.from)}</strong> → <strong style="color:#fff;">${fmtDate(s.to)}</strong></span>
                <span>${escapeHtml(tr('import.realizedTry', 'Gerçekleşen K/Z (₺)'))}: <strong style="color:${realizedColor};">${realizedSign}${escapeHtml(formatNumber(realized, 2))}</strong></span>
            </div>

            <div style="max-height:230px;overflow:auto;border:1px solid rgba(255,255,255,0.08);border-radius:12px;margin-bottom:20px;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="position:sticky;top:0;background:rgba(31,41,55,0.98);">
                            <th style="padding:8px 10px;text-align:left;color:rgba(255,255,255,0.6);font-weight:600;">${escapeHtml(tr('import.colSymbol', 'Varlık'))}</th>
                            <th style="padding:8px 10px;text-align:left;color:rgba(255,255,255,0.6);font-weight:600;">${escapeHtml(tr('import.colType', 'Tür'))}</th>
                            <th style="padding:8px 10px;text-align:right;color:rgba(255,255,255,0.6);font-weight:600;">${escapeHtml(tr('import.colQty', 'Miktar'))}</th>
                            <th style="padding:8px 10px;text-align:right;color:rgba(255,255,255,0.6);font-weight:600;">${escapeHtml(tr('import.colAvg', 'Ort. Maliyet'))}</th>
                        </tr>
                    </thead>
                    <tbody>${positionsRows || `<tr><td colspan="4" style="padding:16px;text-align:center;color:rgba(255,255,255,0.5);">${escapeHtml(tr('import.noPositions', 'Sonuç pozisyonu yok'))}</td></tr>`}</tbody>
                </table>
            </div>

            <div style="display:flex;gap:12px;justify-content:flex-end;">
                <button type="button" id="importCancelBtn2" style="padding:11px 22px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:10px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">${escapeHtml(tr('modal.cancel', 'İptal'))}</button>
                <button type="button" id="importConfirmBtn" style="padding:11px 24px;background:linear-gradient(135deg,#3b82f6,#22c55e);border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;">${escapeHtml(tr('import.confirm', 'İçe Aktar'))}</button>
            </div>
        </div>`;

    const modal = createModal('importPreviewModal', modalContent);
    const cancel = () => closeModal('importPreviewModal');
    modal.querySelector('#importCancelBtn').addEventListener('click', cancel);
    modal.querySelector('#importCancelBtn2').addEventListener('click', cancel);

    const confirmBtn = modal.querySelector('#importConfirmBtn');

    // With duplicates present, the confirm button stays disabled until the user
    // acknowledges the warning. No duplicates → button is enabled from the start.
    const dupAck = modal.querySelector('#importDupAck');
    if (dupAck) {
        const syncConfirmState = () => {
            confirmBtn.disabled = !dupAck.checked;
            confirmBtn.style.opacity = dupAck.checked ? '1' : '0.5';
            confirmBtn.style.cursor = dupAck.checked ? 'pointer' : 'not-allowed';
        };
        dupAck.addEventListener('change', syncConfirmState);
        syncConfirmState();
    }

    confirmBtn.addEventListener('click', async () => {
        if (confirmBtn.disabled) return;
        confirmBtn.disabled = true;
        confirmBtn.textContent = tr('import.importing', 'İçe aktarılıyor…');
        const result = await postImport(rows, true);
        if (result.ok && result.data && result.data.valid !== false) {
            closeModal('importPreviewModal');
            showSuccessMessage(tr('import.success', 'İşlemler içe aktarıldı') + ` (${result.data.imported})`);
            if (window.renderPortfolioTable) await window.renderPortfolioTable();
            if (window.renderTransactions) await window.renderTransactions();
        } else {
            confirmBtn.disabled = false;
            confirmBtn.textContent = tr('import.confirm', 'İçe Aktar');
            showErrorMessage(errorText(result.data));
        }
    });
}

window.openCsvImportDialog = openCsvImportDialog;
