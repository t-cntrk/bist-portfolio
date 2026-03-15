#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Email Configuration Setup for Borsa Portal');
console.log('==============================================\n');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('✅ .env file already exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  if (envContent.includes('EMAIL_USER') && envContent.includes('EMAIL_PASS')) {
    console.log('✅ Email credentials are configured');
  } else {
    console.log('⚠️  Email credentials are missing from .env file');
  }
} else {
  console.log('❌ .env file not found');
}

console.log('\n📧 Gmail Setup Instructions:');
console.log('1. Go to https://myaccount.google.com/security');
console.log('2. Enable "2-Step Verification"');
console.log('3. Go to https://myaccount.google.com/apppasswords');
console.log('4. Generate an App Password for "Mail"');
console.log('5. Copy the 16-character password');
console.log('\n📝 Create .env file with:');
console.log('EMAIL_USER=your_gmail@gmail.com');
console.log('EMAIL_PASS=your_gmail_app_password');
console.log('BASE_URL=http://localhost:3000');
console.log('NODE_ENV=development');

console.log('\n🧪 Test email functionality:');
console.log('curl http://localhost:3000/test-email');

console.log('\n📖 For detailed instructions, see docs/EMAIL_SETUP.md');
