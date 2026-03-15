/**
 * Environment configuration utility
 * Centralizes environment-based URL and configuration management
 */

function getBaseUrl() {
    if (process.env.NODE_ENV === 'production') {
        return process.env.BASE_URL_PROD || process.env.BASE_URL || 'https://yourdomain.com';
    }
    
    if (process.env.NODE_ENV === 'staging') {
        return process.env.BASE_URL_STAGING || process.env.BASE_URL || 'https://staging.yourdomain.com';
    }
    
    // Development environment
    if (process.env.ALLOW_LOCAL_NETWORK === 'true' && process.env.LOCAL_NETWORK_IP) {
        return `http://${process.env.LOCAL_NETWORK_IP}:${process.env.PORT || 3000}`;
    }
    
    return process.env.BASE_URL_DEV || process.env.BASE_URL || 'http://localhost:3000';
}

function getAllowedOrigins() {
    const baseOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
        : [];

    if (process.env.NODE_ENV === 'production') {
        return baseOrigins.length > 0 ? baseOrigins : [getBaseUrl()];
    }

    // Development environment
    const devOrigins = [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        getBaseUrl()
    ];

    // Add local network IP if mobile development is enabled
    if (process.env.ALLOW_LOCAL_NETWORK === 'true' && process.env.LOCAL_NETWORK_IP) {
        devOrigins.push(`http://${process.env.LOCAL_NETWORK_IP}:${process.env.PORT || 3000}`);
    }

    return [...new Set([...devOrigins, ...baseOrigins])];
}

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

function isDevelopment() {
    return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
}

function getEnvironment() {
    return process.env.NODE_ENV || 'development';
}

module.exports = {
    getBaseUrl,
    getAllowedOrigins,
    isProduction,
    isDevelopment,
    getEnvironment
};