// Inject CSS for animations and UI components once at module load time
const _style = document.createElement('style');
_style.textContent = `
    .confirmation-modal {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex; justify-content: center; align-items: center;
        z-index: 10000;
    }
    .confirmation-content {
        background: white; padding: 30px; border-radius: 10px;
        text-align: center; max-width: 400px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    .confirmation-buttons {
        display: flex; gap: 15px; justify-content: center; margin-top: 20px;
    }
    .confirm-btn, .cancel-btn {
        padding: 10px 20px; border: none; border-radius: 5px;
        cursor: pointer; font-weight: 600;
    }
    .confirm-btn { background: #ef4444; color: white; }
    .cancel-btn  { background: #6b7280; color: white; }
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0);    opacity: 1; }
        to   { transform: translateX(100%); opacity: 0; }
    }
    .data-updating { animation: dataUpdate 0.6s ease-in-out; }
    @keyframes dataUpdate {
        0%   { background-color: rgba(59, 130, 246, 0.1); }
        50%  { background-color: rgba(59, 130, 246, 0.3); }
        100% { background-color: transparent; }
    }
    .spinner {
        width: 20px; height: 20px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(_style);

export function showMessage(message, type = 'info') {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 5000;
        padding: 12px 20px; border-radius: 8px; font-weight: 600;
        max-width: 300px; word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `;

    const colors = {
        success: { bg: '#10b981', color: '#fff' },
        error:   { bg: '#ef4444', color: '#fff' },
        warning: { bg: '#f59e0b', color: '#fff' },
        info:    { bg: '#3b82f6', color: '#fff' }
    };
    const c = colors[type] || colors.info;
    div.style.background = c.bg;
    div.style.color = c.color;
    div.textContent = message;

    document.body.appendChild(div);

    setTimeout(() => {
        div.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 300);
    }, 3000);
}

export function showErrorMessage(message, duration = 5000) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: #ef4444; color: white;
        padding: 12px 20px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
        z-index: 10001; animation: slideIn 0.3s ease-out;
        max-width: 300px; word-wrap: break-word;
    `;
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => {
        div.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 300);
    }, duration);
}

export function showSuccessMessage(message, duration = 3000) {
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: #22c55e; color: white;
        padding: 12px 20px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
        z-index: 10001; animation: slideIn 0.3s ease-out;
        max-width: 300px; word-wrap: break-word;
    `;
    div.textContent = message;
    document.body.appendChild(div);

    setTimeout(() => {
        div.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 300);
    }, duration);
}

export function showDataUpdateAnimation(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.classList.add('data-updating');
        setTimeout(() => el.classList.remove('data-updating'), 600);
    }
}

// Make showMessage globally available for legacy non-module code
if (typeof window !== 'undefined') {
    window.showMessage = showMessage;
}
