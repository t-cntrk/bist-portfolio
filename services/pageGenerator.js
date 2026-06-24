/**
 * HTML page generators for email verification and password reset flows.
 * These are server-rendered pages (not API JSON responses).
 */

/**
 * Escape a value for safe interpolation into HTML text and attribute contexts.
 * Prevents stored/reflected XSS via username, token, or message parameters.
 */
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function generateErrorPage(title, heading, message) {
    return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      <style>
        body { 
          background: linear-gradient(135deg, #0f0f23, #1a1a2e); 
          color: white; 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px;
          margin: 0;
        }
        .card {
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          margin: 0 auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        h2 { margin-top: 0; font-size: 24px; }
        p { font-size: 16px; line-height: 1.6; }
        a {
          display: inline-block;
          background: linear-gradient(45deg, #3b82f6, #22c55e);
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          margin-top: 20px;
          font-weight: 600;
          transition: transform 0.2s;
        }
        a:hover { transform: translateY(-2px); }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>${escapeHtml(heading)}</h2>
        <p>${escapeHtml(message)}</p>
        <a href="/">Ana Sayfaya Dön</a>
      </div>
    </body>
    </html>
  `;
}

function generateSuccessPage(title, heading, message, buttonText) {
    return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(title)}</title>
      <style>
        body { 
          background: linear-gradient(135deg, #0f0f23, #1a1a2e); 
          color: white; 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px;
          margin: 0;
        }
        .card {
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          margin: 0 auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        h2 { margin-top: 0; font-size: 24px; }
        p { font-size: 16px; line-height: 1.6; }
        a {
          display: inline-block;
          background: linear-gradient(45deg, #3b82f6, #22c55e);
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          margin-top: 20px;
          font-weight: 600;
          transition: transform 0.2s;
        }
        a:hover { transform: translateY(-2px); }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>${escapeHtml(heading)}</h2>
        <p>${escapeHtml(message)}</p>
        <a href="/">${escapeHtml(buttonText)}</a>
      </div>
    </body>
    </html>
  `;
}

function generatePasswordResetForm(username, token) {
    return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Şifre Sıfırlama</title>
      <style>
        body { 
          background: linear-gradient(135deg, #0f0f23, #1a1a2e); 
          color: white; 
          font-family: Arial, sans-serif; 
          text-align: center; 
          padding: 50px;
          margin: 0;
        }
        .card {
          background: rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          margin: 0 auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        h2 { margin-top: 0; font-size: 24px; }
        p { font-size: 16px; line-height: 1.6; }
        input {
          width: 100%;
          padding: 12px;
          margin: 10px 0;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 8px;
          background: rgba(255,255,255,0.1);
          color: white;
          font-size: 16px;
          box-sizing: border-box;
        }
        input::placeholder { color: rgba(255,255,255,0.5); }
        button {
          width: 100%;
          background: linear-gradient(45deg, #3b82f6, #22c55e);
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          margin-top: 10px;
          font-weight: 600;
          transition: transform 0.2s;
        }
        button:hover { transform: translateY(-2px); }
        .message {
          margin-top: 15px;
          padding: 10px;
          border-radius: 8px;
          display: none;
        }
        .error { background: rgba(239, 68, 68, 0.2); color: #ef4444; display: block; }
        .success { background: rgba(34, 197, 94, 0.2); color: #22c55e; display: block; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🔐 Şifre Sıfırlama</h2>
        <p>Merhaba ${escapeHtml(username)}, yeni şifrenizi belirleyin:</p>
        <form id="resetForm">
          <input type="hidden" id="token" value="${escapeHtml(token)}">
          <input type="password" id="newPassword" placeholder="Yeni Şifre (min 8 karakter)" required minlength="8">
          <input type="password" id="confirmPassword" placeholder="Şifre Tekrar" required minlength="8">
          <button type="submit">Şifremi Sıfırla</button>
        </form>
        <div id="result" class="message"></div>
      </div>
      
      <script>
        document.getElementById('resetForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const token = document.getElementById('token').value;
          const newPassword = document.getElementById('newPassword').value;
          const confirmPassword = document.getElementById('confirmPassword').value;
          const result = document.getElementById('result');
          const showMsg = (text, cls) => { result.textContent = text; result.className = 'message ' + cls; result.style.display = 'block'; };

          result.style.display = 'none';
          
          if (newPassword !== confirmPassword) {
            showMsg('Şifreler eşleşmiyor!', 'error');
            return;
          }
          
          if (newPassword.length < 8) {
            showMsg('Şifre en az 8 karakter olmalıdır!', 'error');
            return;
          }

          const complexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&#^()\\-_.+=[\\]{}|;:'"<>,/])/;
          if (!complexity.test(newPassword)) {
            showMsg('Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir!', 'error');
            return;
          }
          
          try {
            const response = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, newPassword })
            });
            
            const data = await response.json().catch(() => ({}));
            
            if (response.ok) {
              showMsg('Şifreniz başarıyla sıfırlandı! Giriş sayfasına yönlendiriliyorsunuz...', 'success');
              setTimeout(() => {
                window.location.href = '/';
              }, 3000);
            } else {
              showMsg(data.message || 'Şifre sıfırlama başarısız!', 'error');
            }
          } catch (error) {
            showMsg('Sunucu hatası! Lütfen tekrar deneyin.', 'error');
          }
        });
      </script>
    </body>
    </html>
  `;
}

function generatePasswordChangeForm(token) {
    return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Şifre Değiştirme</title>
      <style>
        body { background: linear-gradient(135deg, #0f0f23, #1a1a2e); color: white; font-family: Arial, sans-serif; text-align: center; padding: 50px; margin: 0; }
        .card { background: rgba(255,255,255,0.1); border-radius: 20px; padding: 40px; max-width: 500px; margin: 0 auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        h2 { margin-top: 0; font-size: 24px; }
        p { font-size: 16px; line-height: 1.6; }
        input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; background: rgba(255,255,255,0.1); color: white; font-size: 16px; box-sizing: border-box; }
        input::placeholder { color: rgba(255,255,255,0.5); }
        button { width: 100%; background: linear-gradient(45deg, #3b82f6, #22c55e); color: white; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; font-weight: 600; transition: transform 0.2s; }
        button:hover { transform: translateY(-2px); }
        .message { margin-top: 15px; padding: 10px; border-radius: 8px; display: none; }
        .error { background: rgba(239, 68, 68, 0.2); color: #ef4444; display: block; }
        .success { background: rgba(34, 197, 94, 0.2); color: #22c55e; display: block; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>🔐 Şifre Değiştirme</h2>
        <p>Yeni şifrenizi belirleyin:</p>
        <form id="changeForm">
          <input type="hidden" id="token" value="${escapeHtml(token)}">
          <input type="password" id="currentPassword" placeholder="Mevcut Şifre" required>
          <input type="password" id="newPassword" placeholder="Yeni Şifre (min 8 karakter)" required minlength="8">
          <input type="password" id="confirmPassword" placeholder="Şifre Tekrar" required minlength="8">
          <button type="submit">Şifreyi Değiştir</button>
        </form>
        <div id="result" class="message"></div>
      </div>
      <script>
        document.getElementById('changeForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const token = document.getElementById('token').value;
          const currentPassword = document.getElementById('currentPassword').value;
          const newPassword = document.getElementById('newPassword').value;
          const confirmPassword = document.getElementById('confirmPassword').value;
          const result = document.getElementById('result');
          const showMsg = (text, cls) => { result.textContent = text; result.className = 'message ' + cls; result.style.display = 'block'; };
          result.style.display = 'none';
          if (!currentPassword) { showMsg('Mevcut şifrenizi girin!', 'error'); return; }
          if (newPassword !== confirmPassword) { showMsg('Şifreler eşleşmiyor!', 'error'); return; }
          if (newPassword.length < 8) { showMsg('Şifre en az 8 karakter olmalıdır!', 'error'); return; }
          try {
            const response = await fetch('/api/auth/verify-password-change', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ token, currentPassword, newPassword })
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
              showMsg(data.message || 'Şifreniz başarıyla değiştirildi!', 'success');
              setTimeout(() => { window.location.href = '/'; }, 3000);
            } else {
              showMsg(data.message || 'Şifre değiştirilemedi!', 'error');
            }
          } catch (error) {
            showMsg('Sunucu hatası! Lütfen tekrar deneyin.', 'error');
          }
        });
      </script>
    </body>
    </html>
  `;
}

function generateAccountDeletionConfirm(token) {
    return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hesap Silme</title>
      <style>
        body { background: linear-gradient(135deg, #0f0f23, #1a1a2e); color: white; font-family: Arial, sans-serif; text-align: center; padding: 50px; margin: 0; }
        .card { background: rgba(255,255,255,0.1); border-radius: 20px; padding: 40px; max-width: 500px; margin: 0 auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
        h2 { margin-top: 0; font-size: 24px; }
        p { font-size: 16px; line-height: 1.6; }
        .warn { color: #ef4444; font-weight: 600; }
        button { width: 100%; color: white; padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; margin-top: 10px; font-weight: 600; transition: transform 0.2s; }
        button:hover { transform: translateY(-2px); }
        .delete-btn { background: linear-gradient(45deg, #ef4444, #dc2626); }
        .message { margin-top: 15px; padding: 10px; border-radius: 8px; display: none; }
        .error { background: rgba(239, 68, 68, 0.2); color: #ef4444; display: block; }
        .success { background: rgba(34, 197, 94, 0.2); color: #22c55e; display: block; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>⚠️ Hesap Silme Onayı</h2>
        <p class="warn">Bu işlem geri alınamaz! Tüm verileriniz kalıcı olarak silinecektir.</p>
        <p>Devam etmek için şifrenizi girin:</p>
        <form id="deleteForm">
          <input type="hidden" id="token" value="${escapeHtml(token)}">
          <input type="password" id="password" placeholder="Şifreniz" required style="width: 100%; padding: 12px; margin: 10px 0; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; background: rgba(255,255,255,0.1); color: white; font-size: 16px; box-sizing: border-box;">
          <button type="submit" class="delete-btn">Hesabımı Kalıcı Olarak Sil</button>
        </form>
        <div id="result" class="message"></div>
      </div>
      <script>
        document.getElementById('deleteForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const token = document.getElementById('token').value;
          const password = document.getElementById('password').value;
          const result = document.getElementById('result');
          const showMsg = (text, cls) => { result.textContent = text; result.className = 'message ' + cls; result.style.display = 'block'; };
          result.style.display = 'none';
          if (!password) { showMsg('Şifrenizi girin!', 'error'); return; }
          try {
            const response = await fetch('/api/auth/verify-account-deletion', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ token, password })
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
              showMsg(data.message || 'Hesabınız silindi.', 'success');
              setTimeout(() => { window.location.href = '/'; }, 3000);
            } else {
              showMsg(data.message || 'Hesap silinemedi!', 'error');
            }
          } catch (error) {
            showMsg('Sunucu hatası! Lütfen tekrar deneyin.', 'error');
          }
        });
      </script>
    </body>
    </html>
  `;
}

module.exports = {
    generateErrorPage,
    generateSuccessPage,
    generatePasswordResetForm,
    generatePasswordChangeForm,
    generateAccountDeletionConfirm
};
