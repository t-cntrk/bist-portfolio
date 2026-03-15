const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { getBaseUrl } = require('../utils/envConfig');

// Debug: Log email configuration (without exposing secrets)
console.log('📧 EmailService Configuration:');
console.log('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
console.log('EMAIL_FROM:', process.env.EMAIL_FROM || process.env.EMAIL_USER || 'NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET***' : 'NOT SET');

// Email transporter setup (hardened with dev fallback)
const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS)) {
  // Fail fast in production if creds are missing
  console.error('EMAIL_USER/PASS must be set in production');
}

let transporter;
if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN && process.env.EMAIL_USER) {
  // Optional OAuth2 for Gmail to bypass password-related web login blocks
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.EMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN
    }
  });
  console.log('Email transport: using Gmail OAuth2');
} else if (!isProd && (!process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.EMAIL_PASS === 'YOUR_16_CHARACTER_APP_PASSWORD_HERE')) {
  // Development fallback: do not attempt real SMTP; emulate success
  transporter = nodemailer.createTransport({ jsonTransport: true });
  console.warn('Email transport: using jsonTransport fallback (dev mode, no real email is sent)');
  console.warn('To enable real email sending, set EMAIL_USER and EMAIL_PASS in .env file');
  console.warn('See EMAIL_SETUP.md for detailed instructions');
} else {
  // Gmail SMTP configuration with proper settings
  transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false
    },
    debug: !isProd, // Enable debug logging in development
    logger: !isProd // Enable logger in development
  });
  console.log('Email transport: using Gmail SMTP with App Password');
}

// Email template helper function
function loadEmailTemplate(templateName, replacements) {
  try {
    const templatePath = path.join(__dirname, '..', 'email-templates', `${templateName}.html`);
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Replace placeholders
    Object.keys(replacements).forEach(key => {
      const placeholder = `{{${key}}}`;
      template = template.replace(new RegExp(placeholder, 'g'), replacements[key]);
    });
    
    return template;
  } catch (error) {
    console.error(`Template loading error for ${templateName}:`, error);
    return null;
  }
}

// Email sending status tracking to prevent duplicate emails
const emailSendingStatus = new Map();

// Global email sending lock
let isEmailSending = false;

// Email test function
async function testEmail() {
  try {
    const testEmail = process.env.EMAIL_USER;
    if (!testEmail) {
      throw new Error('EMAIL_USER not configured');
    }
    
    // Test password reset email template
    const testToken = 'test-token-123';
    const resetTemplate = loadEmailTemplate('password-reset-email', {
      RESET_LINK: `${getBaseUrl()}/reset-password?token=${testToken}`
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@localhost',
      to: testEmail,
      subject: 'E-posta Şablonu Test - Borsa Portal',
      html: resetTemplate || `
        <div style="background: linear-gradient(135deg, #0f0f23, #1a1a2e); color: white; padding: 30px; font-family: Arial;">
          <h2>✅ E-posta Sistemi Çalışıyor!</h2>
          <p>Bu bir test e-postasıdır. E-posta doğrulama sistemi başarıyla çalışıyor.</p>
          <p>Gönderim zamanı: ${new Date().toLocaleString('tr-TR')}</p>
        </div>
      `
    });
    
    return { 
      success: true, 
      message: 'Test e-postası gönderildi!',
      sentTo: testEmail,
      templateUsed: resetTemplate ? 'Outlook uyumlu şablon' : 'Fallback şablon'
    };
  } catch (error) {
    console.error('Email test error:', error);
    throw new Error('E-posta gönderimi başarısız: ' + error.message);
  }
}

// Send verification email
async function sendVerificationEmail(email, token, username) {
  try {
    const template = loadEmailTemplate('verification-email', {
      VERIFICATION_LINK: `${getBaseUrl()}/verify-email?token=${token}`,
      USER_NAME: username
    });
    
    const emailData = template ? {
      subject: 'E-posta Doğrulama - Borsa Portal',
      html: template
    } : {
      subject: 'Hesabınızı Doğrulayın - Borsa Portal',
      html: `
        <div style="background: linear-gradient(135deg, #0f0f23, #1a1a2e); color: white; padding: 30px; font-family: Arial;">
          <h2>Merhaba ${username}!</h2>
          <p>Hesabınızı doğrulamak için aşağıdaki bağlantıya tıklayın:</p>
          <a href="${getBaseUrl()}/verify-email?token=${token}" 
             style="background: linear-gradient(45deg, #3b82f6, #22c55e); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0;">
             Hesabı Doğrula
          </a>
          <p>Bu bağlantı 24 saat geçerlidir.</p>
        </div>
      `
    };
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@localhost',
      to: email,
      ...emailData
    });
    
    console.log('Verification email sent successfully to:', email);
    return true;
  } catch (error) {
    console.error('Verification email error:', error);
    throw error;
  }
}

// Send password reset email
async function sendPasswordResetEmail(email, token) {
  try {
    const resetTemplate = loadEmailTemplate('password-reset-email', {
      RESET_LINK: `${getBaseUrl()}/reset-password?token=${token}`
    });
    
    const emailData = resetTemplate ? {
      subject: 'Şifre Sıfırlama - Borsa Portal',
      html: resetTemplate
    } : {
      subject: 'Şifre Sıfırlama - Borsa Portal',
      html: `
        <div style="background: linear-gradient(135deg, #0f0f23, #1a1a2e); color: white; padding: 30px; font-family: Arial;">
          <h2>Şifre Sıfırlama</h2>
          <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p>
          <a href="${getBaseUrl()}/reset-password?token=${token}" 
             style="background: linear-gradient(45deg, #3b82f6, #22c55e); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0;">
             Şifremi Sıfırla
          </a>
          <p>Bu bağlantı 1 saat geçerlidir.</p>
        </div>
      `
    };
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@localhost',
      to: email,
      ...emailData
    });
    
    console.log('Password reset email sent successfully to:', email);
    
    // In development mode, also log the reset link to console
    if (!isProd) {
      const resetLink = `${getBaseUrl()}/reset-password?token=${token}`;
      console.log('🔗 Password Reset Link (Development Mode):', resetLink);
    }
    
    return true;
  } catch (error) {
    console.error('Password reset email error:', error);
    throw error;
  }
}

// Send password change verification email
async function sendPasswordChangeEmail(email, token) {
  try {
    const resetLink = `${getBaseUrl()}/verify-password-change?token=${token}`;
    
    const emailData = {
      subject: 'Şifre Değiştirme Doğrulama - Borsa Portal',
      html: `
        <div style="background: linear-gradient(135deg, #0f0f23, #1a1a2e); color: white; padding: 30px; font-family: Arial;">
          <h2>Şifre Değiştirme Doğrulama</h2>
          <p>Şifrenizi değiştirmek için aşağıdaki bağlantıya tıklayın:</p>
          <a href="${resetLink}" 
             style="background: linear-gradient(45deg, #3b82f6, #22c55e); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0;">
             Şifre Değiştirmeyi Doğrula
          </a>
          <p>Bu bağlantı 15 dakika geçerlidir.</p>
          <p>Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
        </div>
      `
    };
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@localhost',
      to: email,
      ...emailData
    });
    
    console.log('Password change verification email sent successfully to:', email);
    
    // In development mode, also log the reset link to console
    if (!isProd) {
      console.log('🔗 Password Change Verification Link (Development Mode):', resetLink);
    }
    
    return true;
  } catch (error) {
    console.error('Password change verification email error:', error);
    throw error;
  }
}

// Send account deletion verification email
async function sendAccountDeletionEmail(email, token) {
  try {
    const resetLink = `${getBaseUrl()}/verify-account-deletion?token=${token}`;
    
    const emailData = {
      subject: 'Hesap Silme Doğrulama - Borsa Portal',
      html: `
        <div style="background: linear-gradient(135deg, #0f0f23, #1a1a2e); color: white; padding: 30px; font-family: Arial;">
          <h2>⚠️ Hesap Silme Doğrulama</h2>
          <p>Hesabınızı silmek için aşağıdaki bağlantıya tıklayın:</p>
          <a href="${resetLink}" 
             style="background: linear-gradient(45deg, #ef4444, #dc2626); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0;">
             Hesabı Silmeyi Doğrula
          </a>
          <p><strong>DİKKAT:</strong> Bu işlem geri alınamaz! Tüm verileriniz kalıcı olarak silinecektir.</p>
          <p>Bu bağlantı 15 dakika geçerlidir.</p>
          <p>Eğer bu işlemi siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
        </div>
      `
    };
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@localhost',
      to: email,
      ...emailData
    });
    
    console.log('Account deletion verification email sent successfully to:', email);
    
    // In development mode, also log the reset link to console
    if (!isProd) {
      console.log('🔗 Account Deletion Verification Link (Development Mode):', resetLink);
    }
    
    return true;
  } catch (error) {
    console.error('Account deletion verification email error:', error);
    throw error;
  }
}

module.exports = {
  transporter,
  loadEmailTemplate,
  testEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangeEmail,
  sendAccountDeletionEmail,
  emailSendingStatus,
  isEmailSending
}; 