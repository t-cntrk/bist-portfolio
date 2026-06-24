const path = require('path');

const ENV_CONFIG_PATH = path.join(__dirname, '..', 'utils', 'envConfig.js');

function loadEnvConfig() {
    // Re-require fresh so env changes are picked up
    delete require.cache[require.resolve(ENV_CONFIG_PATH)];
    return require(ENV_CONFIG_PATH);
}

describe('envConfig', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    test('getEnvironment defaults to development when NODE_ENV is unset', () => {
        delete process.env.NODE_ENV;
        const { getEnvironment } = loadEnvConfig();
        expect(getEnvironment()).toBe('development');
    });

    test('isProduction / isDevelopment reflect NODE_ENV', () => {
        process.env.NODE_ENV = 'production';
        let cfg = loadEnvConfig();
        expect(cfg.isProduction()).toBe(true);
        expect(cfg.isDevelopment()).toBe(false);

        process.env.NODE_ENV = 'development';
        cfg = loadEnvConfig();
        expect(cfg.isProduction()).toBe(false);
        expect(cfg.isDevelopment()).toBe(true);
    });

    test('getBaseUrl returns production URL in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.BASE_URL_PROD = 'https://example.com';
        const { getBaseUrl } = loadEnvConfig();
        expect(getBaseUrl()).toBe('https://example.com');
    });

    test('getAllowedOrigins always includes localhost in development', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.ALLOWED_ORIGINS;
        const { getAllowedOrigins } = loadEnvConfig();
        expect(getAllowedOrigins()).toContain('http://localhost:3000');
    });
});
