// App initialization and DOM event handlers

document.addEventListener('DOMContentLoaded', () => {
    initializeModals();
    initializePortfolioFixes();
    initializeGlobalErrorHandlers();
});

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

function initializePortfolioFixes() {
    applyPortfolioFixes();
    setInterval(applyPortfolioFixes, 1000);
}

function applyPortfolioFixes() {
    // Force right-align numerical values (except new portfolio table)
    const numericalCells = document.querySelectorAll(`
        .modern-table td:nth-child(n+3),
        #stockPortfolioBody td:nth-child(n+3),
        #fxPortfolioBody td:nth-child(n+3)
    `);
    numericalCells.forEach(cell => {
        if (cell.closest('.new-portfolio-table')) return;
        cell.style.textAlign = 'right';
    });

    // Force left-align first two columns
    const firstTwoColumns = document.querySelectorAll(`
        .modern-table td:nth-child(1),
        .modern-table td:nth-child(2),
        #stockPortfolioBody td:nth-child(1),
        #stockPortfolioBody td:nth-child(2)
    `);
    firstTwoColumns.forEach(cell => {
        if (cell.closest('.new-portfolio-table')) return;
        cell.style.textAlign = 'left';
    });

    // Center alignment for new portfolio table
    const newPortfolioNumeric = document.querySelectorAll(`
        .new-portfolio-table tbody td:nth-child(2),
        .new-portfolio-table tbody td:nth-child(3),
        .new-portfolio-table tbody td:nth-child(4),
        .new-portfolio-table tbody td:nth-child(5),
        .new-portfolio-table tbody td:nth-child(6),
        .new-portfolio-table tbody td:nth-child(7)
    `);
    newPortfolioNumeric.forEach(cell => {
        cell.style.textAlign = 'center';
    });
}

// Make globally accessible
window.applyPortfolioFixes = applyPortfolioFixes;
window.forceRefreshCSS = forceRefreshCSS;