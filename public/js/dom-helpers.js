// Centralized FX portfolio symbol → Yahoo Finance symbol mapping
export const FX_SYMBOL_TO_YAHOO = {
    'XAU/TRY':      'GC=F',
    'XAU&#x2F;TRY': 'GC=F',
    'XAU/USD':      'GC=F',
    'XAU&#x2F;USD': 'GC=F',
    'USD/TRY':      'USDTRY=X',
    'USD&#x2F;TRY': 'USDTRY=X',
    'EUR/TRY':      'EURTRY=X',
    'EUR&#x2F;TRY': 'EURTRY=X',
    'GBP/TRY':      'GBPTRY=X',
    'GBP&#x2F;TRY': 'GBPTRY=X',
};

// ── Confirmation modal ────────────────────────────────────────────────────────

export function showRemoveConfirmationModal(message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'confirmation-modal';
    modal.innerHTML = `
        <div class="confirmation-content">
            <h3>Onay</h3>
            <p>${message}</p>
            <div class="confirmation-buttons">
                <button class="confirm-btn">Evet</button>
                <button class="cancel-btn">Hayır</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const close = () => {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
        document.removeEventListener('keydown', handleEsc);
    };

    modal.querySelector('.confirm-btn').onclick = () => { close(); if (onConfirm) onConfirm(); };
    modal.querySelector('.cancel-btn').onclick  = close;

    const handleEsc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handleEsc);
}

// ── Generic modal ─────────────────────────────────────────────────────────────

export function createModal(modalId, content, options = {}) {
    const existing = document.getElementById(modalId);
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = modalId;
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.8); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
    `;
    modal.innerHTML = content;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector('.close-btn, [data-close]');
    if (closeBtn) closeBtn.onclick = () => modal.remove();

    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    return modal;
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
}

// ── Loading / error states ────────────────────────────────────────────────────

export function showLoadingState(elementId, text = 'Yükleniyor...') {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = `
            <div style="text-align: center; padding: 40px; color: rgba(255,255,255,0.7);">
                <div class="spinner" style="margin: 0 auto 16px auto;"></div>
                <div>${text}</div>
            </div>
        `;
        el.classList.add('loading');
    }
}

export function hideLoadingState(elementId, originalContent = '') {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = originalContent;
        el.classList.remove('loading');
    }
}

export function showErrorState(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 16px; margin-bottom: 16px;">${message}</div>
                <button onclick="window.location.reload()" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                    Tekrar Dene
                </button>
            </div>
        `;
    }
}

// ── Safe DOM selectors ────────────────────────────────────────────────────────

export function safeQuerySelector(selector) {
    const el = document.querySelector(selector);
    if (!el) console.warn('Element not found:', selector);
    return el;
}

export function safeGetElementById(id) {
    const el = document.getElementById(id);
    if (!el) console.warn('Element not found by ID:', id);
    return el;
}

// ── Event listener helpers ────────────────────────────────────────────────────

export function addSafeEventListener(element, event, handler, options = {}) {
    if (element && typeof handler === 'function') {
        element.addEventListener(event, handler, options);
        return () => element.removeEventListener(event, handler, options);
    }
    return () => {};
}

export function removeSafeEventListener(element, event, handler, options = {}) {
    if (element && typeof handler === 'function') {
        element.removeEventListener(event, handler, options);
    }
}

// ── XSS helpers ───────────────────────────────────────────────────────────────

export function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
