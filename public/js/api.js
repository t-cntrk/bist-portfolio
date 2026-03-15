// CSRF token cache
let cachedCsrfToken = null;
let csrfTokenExpiry = 0;

export function getApiUrl(endpoint = '') {
    const baseUrl = window.location.origin;
    return `${baseUrl}${endpoint}`;
}

export async function getCsrfToken() {
    const now = Date.now();

    if (cachedCsrfToken && csrfTokenExpiry > now) {
        return cachedCsrfToken;
    }

    try {
        const res = await fetch(getApiUrl('/api/csrf-token'), {
            credentials: 'include',
            method: 'GET'
        });

        if (!res.ok) {
            throw new Error('CSRF token request failed');
        }

        const { csrfToken } = await res.json();

        cachedCsrfToken = csrfToken;
        csrfTokenExpiry = now + 5 * 60 * 1000; // 5-minute cache

        return csrfToken;
    } catch (err) {
        console.error('CSRF token error:', err);
        throw err;
    }
}

export function createApiRequest(url, options = {}) {
    const defaultOptions = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    };
    return fetch(getApiUrl(url), { ...defaultOptions, ...options });
}

export function handleApiResponse(response) {
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

export function handleApiError(error, defaultMessage = 'Bir hata oluştu') {
    console.error('API Error:', error);

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.';
    }
    if (error.status === 401) return 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.';
    if (error.status === 403) return 'Bu işlem için yetkiniz bulunmuyor.';
    if (error.status === 404) return 'İstenen kaynak bulunamadı.';
    if (error.status >= 500) return 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';

    return error.message || defaultMessage;
}
