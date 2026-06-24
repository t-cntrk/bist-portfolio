// App initialization and DOM event handlers

document.addEventListener('DOMContentLoaded', () => {
    initializeModals();
    initializeGlobalErrorHandlers();
    initializePasswordToggles();
    initializeRememberMe();
    initializeTabs();
});

// ─── Dashboard tabbed view (Piyasalar / Portföyüm) ────────────────────────────
function initializeTabs() {
    const tabs = document.querySelectorAll('.dash-tab');
    const panels = {
        piyasalar: document.getElementById('tabPiyasalar'),
        portfoy: document.getElementById('tabPortfoy'),
    };
    if (!tabs.length || !panels.piyasalar || !panels.portfoy) return;

    function setActiveTab(tab) {
        if (!panels[tab]) return;
        window.activeTab = tab;
        tabs.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
        Object.entries(panels).forEach(([key, el]) => {
            const show = key === tab;
            el.style.display = show ? 'block' : 'none';
            if (show) {
                // Re-trigger the light opacity fade-in.
                el.classList.remove('tab-panel');
                void el.offsetWidth;
                el.classList.add('tab-panel');
            }
        });
    }

    tabs.forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

    // Default active tab.
    setActiveTab('piyasalar');
}

// ─── Password show/hide toggles (login & register) ────────────────────────────
const EYE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function initializePasswordToggles() {
    // Set initial (eye) icon on every toggle button.
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
        btn.innerHTML = EYE_ICON;
    });

    // Delegated handler (works even for dynamically shown modals).
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.password-toggle-btn');
        if (!btn) return;
        e.preventDefault();
        const input = document.getElementById(btn.getAttribute('data-target'));
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = show ? EYE_OFF_ICON : EYE_ICON;
        btn.setAttribute('aria-label', show ? 'Şifreyi gizle' : 'Şifreyi göster');
    });
}

// ─── Remember Me (prefills the username on the login screen) ───────────────────
function initializeRememberMe() {
    const form = document.getElementById('loginForm');
    const checkbox = document.getElementById('rememberMe');
    const usernameInput = document.getElementById('username');
    if (!form || !checkbox || !usernameInput) return;

    const remembered = localStorage.getItem('rememberedUsername');
    if (remembered) {
        usernameInput.value = remembered;
        checkbox.checked = true;
    }

    // Runs alongside auth.js's own submit handler (which uses .onsubmit).
    form.addEventListener('submit', () => {
        if (checkbox.checked && usernameInput.value.trim()) {
            localStorage.setItem('rememberedUsername', usernameInput.value.trim());
        } else {
            localStorage.removeItem('rememberedUsername');
        }
    });
}

function initializeModals() {
    const modalIds = ['chartModal', 'profileModal', 'registerModal', 'forgotPasswordModal', 'changePasswordModal', 'deleteAccountModal'];
    
    modalIds.forEach(id => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
    });
}

function initializeGlobalErrorHandlers() {
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error);
    });

    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled promise rejection:', e.reason);
        e.preventDefault();
    });
}

function forceRefreshCSS() {
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    links.forEach(link => {
        const href = link.href;
        if (href.includes('style.css')) {
            link.href = href.split('?')[0] + '?v=' + new Date().getTime();
        }
    });
}

// Make globally accessible
window.forceRefreshCSS = forceRefreshCSS;