// auth.js
let currentUser = null;

// Import common functions from utils.js
import { getApiUrl, getCsrfToken } from './api.js';
import { showErrorMessage, showSuccessMessage } from './notifications.js';
import { isSecurePassword } from './validation.js';
// Logout function
export async function logout() {
    try {
        await fetch(getApiUrl('/api/auth/logout'), {
            method: 'POST',
            credentials: 'include'
        });
        
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        window.location.href = '/';
    } catch (err) {
        console.error('Logout error:', err);
        // Force logout even if API fails
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        window.location.href = '/';
    }
}

export function initAuth() {
    // Login form handling
    const loginOverlay = document.getElementById('loginOverlay');
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.onsubmit = async function(e) {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                showErrorMessage('Lütfen tüm alanları doldurun!');
                return;
            }
            
            try {
                // Get CSRF token from cache
                const csrfToken = await getCsrfToken();
                
                // Login request
                const res = await fetch(getApiUrl('/api/auth/login'), {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'x-csrf-token': csrfToken 
                    },
                    credentials: 'include',
                    body: JSON.stringify({ username, password })
                });
                
                const data = await res.json();               
if (res.ok && data.success) {
    currentUser = data.username;
    sessionStorage.setItem('currentUser', data.username);
    
    if (loginOverlay) {
        loginOverlay.style.display = 'none';
    }
    
    if (window.initPortfolio) window.initPortfolio();
    if (window.initFx) window.initFx();
    if (window.renderUnifiedPortfolio) window.renderUnifiedPortfolio();
    else if (window.renderPortfolioTable) window.renderPortfolioTable();
    if (window.updateHeaderAvatar) window.updateHeaderAvatar();
    showSuccessMessage('Başarıyla giriş yapıldı!');
} else {
    if (data.message && data.message.includes('doğrulamanız gerekiyor')) {
        const emailVerificationNotice = document.getElementById('emailVerificationNotice');
        if (emailVerificationNotice) {
            emailVerificationNotice.style.display = 'block';
        }
        showErrorMessage(data.message);
    } else {
        showErrorMessage(data.message || 'Kullanıcı adı veya şifre yanlış!');
    }
}
            } catch (err) {
                console.error('Login error:', err);
                showErrorMessage('Sunucuya bağlanılamadı! Lütfen internet bağlantınızı kontrol edin.');
            }
        };
    }
    
// Check if user is already logged in
if (sessionStorage.getItem('currentUser')) {
    currentUser = sessionStorage.getItem('currentUser');
}
    // Resend verification email functionality
    const resendVerificationBtn = document.getElementById('resendVerificationBtn');
    if (resendVerificationBtn) {
        resendVerificationBtn.addEventListener('click', async () => {
            const email = document.getElementById('registerEmail')?.value || prompt('E-posta adresinizi girin:');
            if (!email) return;
            
            try {
                // Get CSRF token from cache
                const csrfToken = await getCsrfToken();
                
                // Send resend verification request
                const res = await fetch(getApiUrl('/api/auth/resend-verification'), {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'x-csrf-token': csrfToken 
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    showSuccessMessage(data.message);
                } else {
                    showErrorMessage(data.message || 'E-posta gönderimi başarısız!');
                }
            } catch (err) {
                console.error('Resend verification error:', err);
                showErrorMessage('Sunucuya bağlanılamadı!');
            }
        });
    }

    // Register form handling
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async function(e) {
            e.preventDefault();
            
            const name = document.getElementById('registerName').value.trim();
            const surname = document.getElementById('registerSurname').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const birthdate = document.getElementById('registerBirthdate').value.trim();
            const username = document.getElementById('registerUsername').value.trim();
            const password = document.getElementById('registerPassword').value;
            const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
            
            const registerResult = document.getElementById('registerResult');
            const registerPasswordHelp = document.getElementById('registerPasswordHelp');
            const registerPasswordConfirmHelp = document.getElementById('registerPasswordConfirmHelp');
            const registerEmailHelp = document.getElementById('registerEmailHelp');
            
            // Clear previous messages
            registerResult.style.display = 'none';
            registerPasswordHelp.style.display = 'none';
            registerPasswordConfirmHelp.style.display = 'none';
            registerEmailHelp.style.display = 'none';
            
            // Validation
            if (!name || !surname || !email || !birthdate || !username || !password || !passwordConfirm) {
                registerResult.textContent = 'Lütfen tüm alanları doldurun!';
                registerResult.style.color = '#e57373';
                registerResult.style.display = 'block';
                return;
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                registerResult.textContent = 'Geçerli bir e-posta adresi giriniz!';
                registerResult.style.color = '#e57373';
                registerResult.style.display = 'block';
                registerEmailHelp.style.display = 'block';
                return;
            }
            
            if (!isSecurePassword(password)) {
                registerResult.textContent = 'Şifreniz güvenli değil! En az 8 karakter, büyük harf, küçük harf, rakam ve özel karakter içermelidir.';
                registerResult.style.color = '#e57373';
                registerResult.style.display = 'block';
                registerPasswordHelp.style.display = 'block';
                registerPasswordHelp.style.color = '#e57373';
                return;
            }
            
            if (password !== passwordConfirm) {
                registerPasswordConfirmHelp.style.display = 'block';
                registerResult.textContent = 'Şifreler eşleşmiyor!';
                registerResult.style.color = '#e57373';
                registerResult.style.display = 'block';
                return;
            }
            
            try {
                // Get CSRF token from cache
                const csrfToken = await getCsrfToken();
                
                // Register request
                const res = await fetch(getApiUrl('/api/auth/register'), {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'x-csrf-token': csrfToken 
                    },
                    credentials: 'include',
                    body: JSON.stringify({ name, surname, email, birthdate, username, password })
                });
                
                const data = await res.json();
                
                if (res.ok) {
                    registerResult.textContent = 'Kayıt başarılı! Giriş yapabilirsiniz.';
                    registerResult.style.color = '#22c55e';
                    registerResult.style.display = 'block';
                    showSuccessMessage('Kayıt başarılı! Giriş yapabilirsiniz.');
                    
                    setTimeout(() => {
                        const registerModal = document.getElementById('registerModal');
                        if (registerModal) registerModal.style.display = 'none';
                        registerResult.style.display = 'none';
                        registerForm.reset();
                        registerPasswordConfirmHelp.style.display = 'none';
                    }, 2000);
                } else {
                    registerResult.textContent = data.message || 'Kayıt başarısız!';
                    registerResult.style.color = '#e57373';
                    registerResult.style.display = 'block';
                    showErrorMessage(data.message || 'Kayıt başarısız!');
                }
            } catch (err) {
                console.error('Register error:', err);
                registerResult.textContent = 'Sunucuya bağlanılamadı!';
                registerResult.style.color = '#e57373';
                registerResult.style.display = 'block';
                showErrorMessage('Sunucuya bağlanılamadı! Lütfen internet bağlantınızı kontrol edin.');
            }
        };
    }
    
    // Forgot password handling
    const forgotSubmitBtn = document.getElementById('forgotSubmitBtn');
    if (forgotSubmitBtn) {
        forgotSubmitBtn.onclick = async function() {
            const email = document.getElementById('forgotEmail').value.trim();
            const result = document.getElementById('forgotResult');
            
            if (!email) {
                result.textContent = 'Lütfen e-posta adresinizi girin!';
                result.style.color = '#e57373';
                result.style.display = 'block';
                return;
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                result.textContent = 'Geçerli bir e-posta adresi girin!';
                result.style.color = '#e57373';
                result.style.display = 'block';
                return;
            }
            
            result.style.transition = 'opacity 0.4s';
            result.style.opacity = 0;
            
            setTimeout(async () => {
                let res, data;
                try {
                    // Get CSRF token from cache
                    const csrfToken = await getCsrfToken();
            
                    // Forgot password request
                    res = await fetch(getApiUrl('/api/auth/forgot'), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-csrf-token': csrfToken
                        },
                        credentials: 'include',
                        body: JSON.stringify({ email })
                    });
                    data = await res.json();
                } catch (err) {
                    console.error('Forgot password error:', err);
                    result.textContent = 'Sunucuya bağlanılamadı!';
                    result.style.color = '#e57373';
                    result.style.display = 'block';
                    setTimeout(() => { result.style.opacity = 1; }, 10);
                    return;
                }
                
                if (res && res.ok) {
                    result.textContent = data.message || 'Şifre sıfırlama bağlantısı gönderildi!';
                    result.style.color = '#22c55e';
                    result.style.display = 'block';
                    setTimeout(() => { result.style.opacity = 1; }, 10);
                    
                    setTimeout(() => {
                        result.style.opacity = 0;
                        setTimeout(() => { 
                            const forgotModal = document.getElementById('forgotPasswordModal');
                            if (forgotModal) forgotModal.style.display = 'none'; 
                        }, 400);
                    }, 5000);
                } else {
                    result.textContent = data?.message || 'E-posta bulunamadı!';
                    result.style.color = '#e57373';
                    result.style.display = 'block';
                    setTimeout(() => { result.style.opacity = 1; }, 10);
                }
            }, 50);
        };
    }
    
    console.log('Auth module loaded successfully');
} 