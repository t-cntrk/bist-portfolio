/**
 * error-handler.js — 3-layer error suppression + Chart.js console filter.
 * Importing this module as a side-effect (`import './js/error-handler.js'`)
 * is enough; no named exports are needed.
 *
 * Depends on: showErrorMessage (notifications.js), sendErrorLog (helpers.js).
 */
import { showErrorMessage } from './notifications.js';
import { sendErrorLog } from './helpers.js';

// Chart.js error filter: downgrade Chart/canvas errors to warnings
const _originalConsoleError = console.error.bind(console);
console.error = function(...args) {
    const message = args.join(' ');
    if (message.includes('Chart') || message.includes('canvas')) {
        console.warn('[Chart]', ...args);
        return;
    }
    _originalConsoleError(...args);
};

// Primary error handler
window.addEventListener('error', function(e) {
    const isChartError = e.message && (
        e.message.includes('ownerDocument') ||
        e.message.includes('Cannot read properties of null') ||
        e.message.includes('chart.js') ||
        e.message.includes('Chart')
    );
    const isScriptError = e.message === 'Script error.' || (e.filename && e.filename.includes('chart.js'));

    if (isChartError || isScriptError) {
        console.warn('Chart error handled gracefully:', e.message);
        return false;
    }

    if (e.error && typeof e.error === 'object') {
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            sendErrorLog(e);
        }
        showErrorMessage('Bir hata oluştu. Lütfen sayfayı yenileyin.');
    }

    return false;
}, true);

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && e.reason.message && (
        e.reason.message.includes('ownerDocument') ||
        e.reason.message.includes('Cannot read properties of null') ||
        e.reason.message.includes('chart.js') ||
        e.reason.message.includes('Chart') ||
        e.reason.message.includes('Script error')
    )) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        return false;
    }

    console.error('Unhandled promise rejection:', e.reason);
    let errorMessage = 'İşlem hatası oluştu';
    if (e.reason && typeof e.reason === 'object' && e.reason.message) {
        errorMessage = 'İşlem hatası: ' + e.reason.message;
    } else if (e.reason && typeof e.reason === 'string') {
        errorMessage = 'İşlem hatası: ' + e.reason;
    }
    showErrorMessage(errorMessage);
    e.preventDefault();
}, true);

// Layer 1: chart.js file errors
window.addEventListener('error', function(e) {
    if (e.filename && e.filename.includes('chart.js')) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        return false;
    }
}, true);

// Layer 2: script error suppression
window.addEventListener('error', function(e) {
    if (e.message === 'Script error.' || e.message.includes('Script error')) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        return false;
    }
}, true);

// Layer 3: null reference suppression
window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('Cannot read properties of null')) {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        return false;
    }
}, true);
