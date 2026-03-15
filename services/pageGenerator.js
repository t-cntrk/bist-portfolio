/**
 * HTML page generators for email verification and password reset flows.
 * These are server-rendered pages (not API JSON responses).
 */

function generateErrorPage(title, heading, message) {
    return `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
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
        <h2>${heading}</h2>
        <p>${message}</p>
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
      <title>${title}</title>
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
        <h2>${heading}</h2>
        <p>${message}</p>
        <a href="/">${buttonText}</a>
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
        <p>Merhaba ${username}, yeni şifrenizi belirleyin:</p>
        <form id="resetForm">
          <input type="hidden" id="token" value="${token}">
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
          
          result.className = 'message';
          result.style.display = 'none';
          
          if (newPassword !== confirmPassword) {
            result.textContent = 'Şifreler eşleşmiyor!';
            result.className = 'message error';
            return;
          }
          
          if (newPassword.length < 8) {
            result.textContent = 'Şifre en az 8 karakter olmalıdır!';
            result.className = 'message error';
            return;
          }
          
          try {
            const response = await fetch('/api/auth/reset-password', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token, newPassword })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              result.textContent = 'Şifreniz başarıyla sıfırlandı! Giriş sayfasına yönlendiriliyorsunuz...';
              result.className = 'message success';
              setTimeout(() => {
                window.location.href = '/';
              }, 3000);
            } else {
              result.textContent = data.message || 'Şifre sıfırlama başarısız!';
              result.className = 'message error';
            }
          } catch (error) {
            result.textContent = 'Sunucu hatası! Lütfen tekrar deneyin.';
            result.className = 'message error';
          }
        });
      </script>
    </body>
    </html>
  `;
}

module.exports = { generateErrorPage, generateSuccessPage, generatePasswordResetForm };
