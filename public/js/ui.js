// ui.js
import { logout } from './auth.js';
import { showPortfolioModal, renderPortfolioTable } from './portfolio.js';
import { showFxPortfolioModal } from './fx.js';
import { getApiUrl } from './api.js';
import { showMessage, showErrorMessage, showSuccessMessage } from './notifications.js';
import {
    addSafeEventListener,
    safeGetElementById,
    createModal, closeModal
} from './dom-helpers.js';

// REFACTORED: Module-scoped event listener cleanup registry
// BACKUP: window.showMessage = showMessage;
// BACKUP: window.showPortfolioModal = showPortfolioModal;
// BACKUP: window.renderPortfolioTable = renderPortfolioTable;
// BACKUP: window.showFxPortfolioModal = showFxPortfolioModal;

// Module-scoped function registry for cleanup
const uiFunctionRegistry = {
    showMessage,
    showPortfolioModal,
    renderPortfolioTable,
    showFxPortfolioModal
};

// Event listener cleanup registry
const eventListeners = new Map();

// Cleanup function for event listeners
function cleanupEventListeners() {
    eventListeners.forEach(({ element, event, handler, options }) => {
        if (element && element.removeEventListener) {
            element.removeEventListener(event, handler, options);
        }
    });
    eventListeners.clear();
}

// Safe event listener registration with cleanup tracking
function addTrackedEventListener(element, event, handler, options = {}) {
    if (!element || typeof handler !== 'function') {
        console.warn('Invalid event listener parameters:', { element, event, handler });
        return () => {};
    }
    
    const cleanup = addSafeEventListener(element, event, handler, options);
    
    // Track for cleanup
    const listenerId = `${event}_${Date.now()}_${Math.random()}`;
    eventListeners.set(listenerId, { element, event, handler, options, cleanup });
    
    return () => {
        cleanup();
        eventListeners.delete(listenerId);
    };
}

export function initUI() {
    // Cleanup any existing event listeners
    cleanupEventListeners();
    
    // Register modal open/close events with proper cleanup
    const registerModal = safeGetElementById('registerModal');
    const registerLink = safeGetElementById('registerLink');
    const closeRegisterModalBtn = safeGetElementById('closeRegisterModalBtn');
    
    if (registerLink && registerModal) {
        addTrackedEventListener(registerLink, 'click', function(e) {
            e.preventDefault();
            registerModal.style.display = 'flex';
        });
    }
    
    if (closeRegisterModalBtn && registerModal) {
        addTrackedEventListener(closeRegisterModalBtn, 'click', function() {
            registerModal.style.display = 'none';
        });
    }
    
    // Forgot password modal open/close with cleanup
    const forgotModal = safeGetElementById('forgotPasswordModal');
    const forgotLink = safeGetElementById('forgotPasswordLink');
    const closeForgotModalBtn = safeGetElementById('closeForgotModalBtn');
    
    if (forgotLink && forgotModal) {
        addTrackedEventListener(forgotLink, 'click', function(e) {
            e.preventDefault();
            forgotModal.style.display = 'flex';
            const forgotResult = safeGetElementById('forgotResult');
            if (forgotResult) forgotResult.style.display = 'none';
        });
    }
    
    if (closeForgotModalBtn && forgotModal) {
        addTrackedEventListener(closeForgotModalBtn, 'click', function() {
            forgotModal.style.display = 'none';
        });
    }
    
    // NOTE: Forgot-password submit handler lives in auth.js (initAuth).
    // It was duplicated here previously, causing two requests per click — removed.

    // NOTE: Click delegation for add-portfolio / currency-add / delete / chart
    // buttons lives ONLY in app.js (setupEventDelegation). It was duplicated here,
    // which caused modals and charts to open/fire twice — removed.

    // Chart modal close with cleanup
    const chartModal = safeGetElementById('chartModal');
    if (chartModal) {
        const closeBtn = chartModal.querySelector('.chart-close');
        if (closeBtn) {
            addTrackedEventListener(closeBtn, 'click', function() {
                chartModal.classList.remove('active');
                if (window.chartInstance) {
                    window.chartInstance.destroy();
                    window.chartInstance = null;
                }
                const ctx = document.getElementById('stockChart');
                if (ctx) {
                    const context = ctx.getContext('2d');
                    context.clearRect(0, 0, 400, 220);
                }
            });
        }
    }
    
    // Profile modal open/close with cleanup
    const profileBtn = safeGetElementById('profileBtn');
    const profileModal = safeGetElementById('profileModal');
    if (profileBtn && profileModal) {
        addTrackedEventListener(profileBtn, 'click', function() {
            fillProfileModal();
            profileModal.style.display = 'flex';
        });
    }
    
    const closeProfileModalBtn = safeGetElementById('closeProfileModalBtn');
    if (closeProfileModalBtn && profileModal) {
        addTrackedEventListener(closeProfileModalBtn, 'click', function() {
            profileModal.style.display = 'none';
            const settingsMenu = safeGetElementById('profileSettingsMenu');
            if (settingsMenu) settingsMenu.style.display = 'none';
        });
    }
    
    // Settings button toggle with cleanup
    const profileSettingsBtn = safeGetElementById('profileSettingsBtn');
    const profileSettingsMenu = safeGetElementById('profileSettingsMenu');
    if (profileSettingsBtn && profileSettingsMenu) {
        addTrackedEventListener(profileSettingsBtn, 'click', function(e) {
            e.stopPropagation();
            profileSettingsMenu.style.display = (profileSettingsMenu.style.display === 'flex') ? 'none' : 'flex';
        });
    }
    
    // Fill personal information
    window.fillProfileModal = async function() {
        let userInfo = { username: '', name: '', surname: '', birthdate: '' };
        
        try {
            const res = await fetch(getApiUrl('/api/auth/userinfo'), {
                credentials: 'include'
            });
            if (res.ok) {
                userInfo = await res.json();
            }
        } catch (e) {
            console.error('Error fetching user info:', e);
        }
        
        const usernameDisplay = safeGetElementById('profileUsernameDisplay2');
        const nameDisplay = safeGetElementById('profileNameDisplay');
        const surnameDisplay = safeGetElementById('profileSurnameDisplay');
        const birthdateDisplay = safeGetElementById('profileBirthdateDisplay');
        
        if (usernameDisplay) usernameDisplay.textContent = userInfo.username || '';
        if (nameDisplay) nameDisplay.textContent = userInfo.name || '';
        if (surnameDisplay) surnameDisplay.textContent = userInfo.surname || '';
        if (birthdateDisplay) {
            // Format birthdate from timestamp or date string
            let formattedDate = '';
            if (userInfo.birthdate) {
                try {
                    // Check if it's a timestamp (number)
                    if (typeof userInfo.birthdate === 'number' || !isNaN(userInfo.birthdate)) {
                        const date = new Date(parseFloat(userInfo.birthdate));
                        formattedDate = date.toLocaleDateString('tr-TR');
                    } else {
                        // It's already a date string
                        const date = new Date(userInfo.birthdate);
                        formattedDate = date.toLocaleDateString('tr-TR');
                    }
                } catch (error) {
                    formattedDate = userInfo.birthdate;
                }
            }
            birthdateDisplay.textContent = formattedDate;
        }
        
        // Avatar initials (modal)
        let initials = '';
        if (userInfo.name && userInfo.surname) {
            initials = (userInfo.name[0] || '').toUpperCase() + (userInfo.surname[0] || '').toUpperCase();
        } else if (userInfo.username) {
            initials = (userInfo.username[0] || '').toUpperCase();
        }
        
        const avatar = document.querySelector('#profileModal .user-avatar');
        if (avatar) avatar.textContent = initials;
    };
    
    // Logout with cleanup
    const profileLogoutBtn = safeGetElementById('profileLogoutBtn');
    if (profileLogoutBtn) {
        addTrackedEventListener(profileLogoutBtn, 'click', function() {
            // Clear all client-side auth state (both storages for safety)
            sessionStorage.removeItem('currentUser');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken');

            if (profileModal) profileModal.style.display = 'none';
            const settingsMenu = safeGetElementById('profileSettingsMenu');
            if (settingsMenu) settingsMenu.style.display = 'none';

            // Route through auth.js logout(): clears server cookie + redirects to '/'
            logout();
        });
    }
    
    
    // Secure password change with email verification
    const profileChangePasswordBtn = safeGetElementById('profileChangePasswordBtn');
    if (profileChangePasswordBtn) {
        addTrackedEventListener(profileChangePasswordBtn, 'click', async function() {
            profileChangePasswordBtn.disabled = true;
            try {
                const res = await fetch(getApiUrl('/api/auth/request-password-change'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    showSuccessMessage(data.message || 'Şifre değiştirme bağlantısı e-postanıza gönderildi.');
                    const settingsMenu = safeGetElementById('profileSettingsMenu');
                    if (settingsMenu) settingsMenu.style.display = 'none';
                } else {
                    showErrorMessage(data.message || 'E-posta gönderilemedi!');
                }
            } catch (err) {
                console.error('Request password change error:', err);
                showErrorMessage('Sunucuya bağlanılamadı!');
            } finally {
                profileChangePasswordBtn.disabled = false;
            }
        });
    }

    // Request password change verification email
    const requestPasswordChangeBtn = safeGetElementById('requestPasswordChangeBtn');
    if (requestPasswordChangeBtn) {
        addTrackedEventListener(requestPasswordChangeBtn, 'click', async function() {
            const resultDiv = safeGetElementById('passwordChangeResult1');
            
            if (resultDiv) resultDiv.style.display = 'none';
            
            try {
                const res = await fetch(getApiUrl('/api/auth/request-password-change'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                
                const data = await res.json();
                
                if (resultDiv) {
                    if (res.ok) {
                        resultDiv.textContent = data.message;
                        resultDiv.style.color = '#22c55e';
                        resultDiv.style.display = 'block';
                        
                        // Show step 2
                        const step1 = safeGetElementById('passwordChangeStep1');
                        const step2 = safeGetElementById('passwordChangeStep2');
                        if (step1) step1.style.display = 'none';
                        if (step2) step2.style.display = 'block';
                    } else {
                        resultDiv.textContent = data.message || 'E-posta gönderilemedi!';
                        resultDiv.style.color = '#e57373';
                        resultDiv.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error('Request password change error:', err);
                if (resultDiv) {
                    resultDiv.textContent = 'Sunucuya bağlanılamadı!';
                    resultDiv.style.color = '#e57373';
                    resultDiv.style.display = 'block';
                }
            }
        });
    }

    // Verify password change
    const verifyPasswordChangeBtn = safeGetElementById('verifyPasswordChangeBtn');
    if (verifyPasswordChangeBtn) {
        addTrackedEventListener(verifyPasswordChangeBtn, 'click', async function() {
            const verificationToken = safeGetElementById('passwordChangeToken')?.value;
            const newPassword = safeGetElementById('newPassword')?.value;
            const newPasswordConfirm = safeGetElementById('newPasswordConfirm')?.value;
            const resultDiv = safeGetElementById('passwordChangeResult2');
            
            if (resultDiv) resultDiv.style.display = 'none';
            
            if (!verificationToken || !newPassword || !newPasswordConfirm) {
                if (resultDiv) {
                    resultDiv.textContent = 'Lütfen tüm alanları doldurun!';
                    resultDiv.style.color = '#e57373';
                    resultDiv.style.display = 'block';
                }
                return;
            }
            
            if (newPassword !== newPasswordConfirm) {
                if (resultDiv) {
                    resultDiv.textContent = 'Şifreler eşleşmiyor!';
                    resultDiv.style.color = '#e57373';
                    resultDiv.style.display = 'block';
                }
                return;
            }
            
            try {
                const res = await fetch(getApiUrl('/api/auth/verify-password-change'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ token: verificationToken, newPassword: newPassword })
                });
                
                const data = await res.json();
                
                if (resultDiv) {
                    if (res.ok) {
                        resultDiv.textContent = data.message;
                        resultDiv.style.color = '#22c55e';
                        resultDiv.style.display = 'block';
                        setTimeout(() => { 
                            closeModal('changePasswordModal');
                            showSuccessMessage('Şifre başarıyla değiştirildi!');
                        }, 1200);
                    } else {
                        resultDiv.textContent = data.message || 'Şifre değiştirilemedi!';
                        resultDiv.style.color = '#e57373';
                        resultDiv.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error('Verify password change error:', err);
                if (resultDiv) {
                    resultDiv.textContent = 'Sunucuya bağlanılamadı!';
                    resultDiv.style.color = '#e57373';
                    resultDiv.style.display = 'block';
                }
            }
        });
    }

    // Secure account deletion with email verification
    const profileDeleteBtn = safeGetElementById('profileDeleteBtn');
    if (profileDeleteBtn) {
        addTrackedEventListener(profileDeleteBtn, 'click', async function() {
            if (!confirm('Hesabınızı silmek için e-posta adresinize bir onay bağlantısı gönderilecek. Devam edilsin mi?')) {
                return;
            }
            profileDeleteBtn.disabled = true;
            try {
                const res = await fetch(getApiUrl('/api/auth/request-account-deletion'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    showSuccessMessage(data.message || 'Hesap silme bağlantısı e-postanıza gönderildi.');
                    const settingsMenu = safeGetElementById('profileSettingsMenu');
                    if (settingsMenu) settingsMenu.style.display = 'none';
                } else {
                    showErrorMessage(data.message || 'E-posta gönderilemedi!');
                }
            } catch (err) {
                console.error('Request account deletion error:', err);
                showErrorMessage('Sunucuya bağlanılamadı!');
            } finally {
                profileDeleteBtn.disabled = false;
            }
        });
    }

    // Request account deletion verification email
    const requestAccountDeletionBtn = safeGetElementById('requestAccountDeletionBtn');
    if (requestAccountDeletionBtn) {
        addTrackedEventListener(requestAccountDeletionBtn, 'click', async function() {
            const resultDiv = safeGetElementById('deleteAccountResult1');
            
            if (resultDiv) resultDiv.style.display = 'none';
            
            try {
                const res = await fetch(getApiUrl('/api/auth/request-account-deletion'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                
                const data = await res.json();
                
                if (resultDiv) {
                    if (res.ok) {
                        resultDiv.textContent = data.message;
                        resultDiv.style.color = '#22c55e';
                        resultDiv.style.display = 'block';
                        
                        // Show step 2
                        const step1 = safeGetElementById('deleteAccountStep1');
                        const step2 = safeGetElementById('deleteAccountStep2');
                        if (step1) step1.style.display = 'none';
                        if (step2) step2.style.display = 'block';
                    } else {
                        resultDiv.textContent = data.message || 'E-posta gönderilemedi!';
                        resultDiv.style.color = '#e57373';
                        resultDiv.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error('Request account deletion error:', err);
                if (resultDiv) {
                    resultDiv.textContent = 'Sunucuya bağlanılamadı!';
                    resultDiv.style.color = '#e57373';
                    resultDiv.style.display = 'block';
                }
            }
        });
    }

    // Verify account deletion
    const verifyAccountDeletionBtn = safeGetElementById('verifyAccountDeletionBtn');
    if (verifyAccountDeletionBtn) {
        addTrackedEventListener(verifyAccountDeletionBtn, 'click', async function() {
            const verificationToken = safeGetElementById('deleteAccountToken')?.value;
            const resultDiv = safeGetElementById('deleteAccountResult2');
            
            if (resultDiv) resultDiv.style.display = 'none';
            
            if (!verificationToken) {
                if (resultDiv) {
                    resultDiv.textContent = 'Lütfen doğrulama kodunu girin!';
                    resultDiv.style.color = '#e57373';
                    resultDiv.style.display = 'block';
                }
                return;
            }
            
            try {
                const res = await fetch(getApiUrl('/api/auth/verify-account-deletion'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ token: verificationToken })
                });
                
                const data = await res.json();
                
                if (resultDiv) {
                    if (res.ok) {
                        resultDiv.textContent = data.message;
                        resultDiv.style.color = '#22c55e';
                        resultDiv.style.display = 'block';
                        
                        // Clear all data and logout
                        setTimeout(() => {
                            localStorage.removeItem('currentUser');
                            localStorage.removeItem('authToken');
                            
                            // Clear portfolio and other data
                            const user = localStorage.getItem('currentUser');
                            for (let key in localStorage) {
                                if (key.startsWith(user + '_')) {
                                    localStorage.removeItem(key);
                                }
                            }
                            
                            const loginOverlay = safeGetElementById('loginOverlay');
                            if (loginOverlay) loginOverlay.style.display = 'flex';
                            
                            if (uiFunctionRegistry.renderPortfolioTable) uiFunctionRegistry.renderPortfolioTable();
                            
                            showSuccessMessage('Hesap başarıyla silindi!');
                        }, 1200);
                    } else {
                        resultDiv.textContent = data.message || 'Hesap silinemedi!';
                        resultDiv.style.color = '#e57373';
                        resultDiv.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error('Verify account deletion error:', err);
                if (resultDiv) {
                    resultDiv.textContent = 'Sunucuya bağlanılamadı!';
                    resultDiv.style.color = '#e57373';
                    resultDiv.style.display = 'block';
                }
            }
        });
    }
    
    // Close password change modal
    const closeChangePasswordModalBtn = safeGetElementById('closeChangePasswordModalBtn');
    if (closeChangePasswordModalBtn) {
        addTrackedEventListener(closeChangePasswordModalBtn, 'click', function() {
            const modal = safeGetElementById('changePasswordModal');
            if (modal) modal.style.display = 'none';
        });
    }

    // Close delete account modal
    const closeDeleteAccountModalBtn = safeGetElementById('closeDeleteAccountModalBtn');
    if (closeDeleteAccountModalBtn) {
        addTrackedEventListener(closeDeleteAccountModalBtn, 'click', function() {
            const modal = safeGetElementById('deleteAccountModal');
            if (modal) modal.style.display = 'none';
        });
    }

    // NOTE: The legacy per-table #refreshPortfolioBtn was removed with the old
    // portfolio layout; refreshing now goes through the header #globalRefreshBtn.

    // Avatar and username display (always from backend)
    async function updateProfileHeaderFromBackend() {
        let userInfo = { username: '', name: '', surname: '', birthdate: '' };
        
        try {
            const res = await fetch(getApiUrl('/api/auth/userinfo'), {
                credentials: 'include'
            });
            if (res.ok) {
                userInfo = await res.json();
            }
        } catch (e) {
            console.error('Error fetching user info:', e);
        }
        
        // Username
        const display = safeGetElementById('profileUsernameDisplay');
        if (display) display.textContent = userInfo.username || '';
        
        // Avatar initials
        let initials = '';
        if (userInfo.name && userInfo.surname) {
            initials = (userInfo.name[0] || '').toUpperCase() + (userInfo.surname[0] || '').toUpperCase();
        } else if (userInfo.username) {
            initials = (userInfo.username[0] || '').toUpperCase();
        }
        
        const avatar = document.querySelector('.header .user-avatar');
        if (avatar) avatar.textContent = initials;
    }
    
    // Update on page load and after login
    addTrackedEventListener(window, 'DOMContentLoaded', updateProfileHeaderFromBackend);
    window.updateHeaderAvatar = updateProfileHeaderFromBackend;
    
    console.log('UI module loaded successfully with event listener cleanup');
}

// Export cleanup function for external use
export function cleanupUI() {
    cleanupEventListeners();
    console.log('UI event listeners cleaned up');
}