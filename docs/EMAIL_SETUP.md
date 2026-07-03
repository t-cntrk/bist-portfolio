# Email Configuration Setup

## Gmail Authentication Issue Fix

The error you're seeing is because Gmail requires special authentication. Here are the solutions:

### Option 1: App Password (Recommended for Development)

1. **Enable 2-Factor Authentication** on your Gmail account:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable "2-Step Verification"

2. **Generate App Password**:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Other (Custom name)"
   - Enter "Borsa Portal" as the name
   - Copy the 16-character password

3. **Create .env file** in your project root:
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-16-character-app-password
BASE_URL=http://localhost:3100
NODE_ENV=development
```

### Option 2: OAuth2 (Recommended for Production)

1. **Create Google Cloud Project**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable Gmail API

2. **Create OAuth2 Credentials**:
   - Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client ID"
   - Choose "Web application"
   - Add authorized redirect URIs

3. **Update .env file**:
```env
EMAIL_USER=your-email@gmail.com
GMAIL_CLIENT_ID=your-client-id
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
BASE_URL=http://localhost:3100
NODE_ENV=development
```

### Option 3: Development Mode (No Real Emails)

If you just want to test without sending real emails, the system will automatically use a mock transporter in development mode when no credentials are provided.

## Testing

After setup, test the email functionality:
```bash
curl http://localhost:3100/test-email
```

## Setup Script

You can also run the setup helper:
```bash
node scripts/setup-email.js
```

## Troubleshooting

- **535-5.7.8 Username and Password not accepted**: Use App Password, not regular password
- **Less secure app access**: Gmail no longer supports this, use App Passwords or OAuth2
- **2FA required**: You must enable 2FA to use App Passwords
