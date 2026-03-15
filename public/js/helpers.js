// ── Auth ─────────────────────────────────────────────────────────────────────

export function getAuthToken() {
    // Token lives in HttpOnly cookie — not accessible from JS.
    // Kept for backwards compatibility.
    return null;
}

// ── String / JSON ─────────────────────────────────────────────────────────────

export function safeParse(json) {
    try { return JSON.parse(json); }
    catch { return null; }
}

// ── Timing ───────────────────────────────────────────────────────────────────

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => { clearTimeout(timeout); func(...args); };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}

export function retryOperation(operation, maxRetries = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
        let retryCount = 0;
        function attempt() {
            operation()
                .then(resolve)
                .catch(error => {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log(`Retry attempt ${retryCount}/${maxRetries}`);
                        setTimeout(attempt, delay * retryCount);
                    } else {
                        reject(error);
                    }
                });
        }
        attempt();
    });
}

export function measurePerformance(name, operation) {
    const start = performance.now();
    return operation().finally(() => {
        const ms = performance.now() - start;
        console.log(`${name} took ${ms.toFixed(2)}ms`);
        if (ms > 1000) console.warn(`Slow operation detected: ${name} took ${ms.toFixed(2)}ms`);
    });
}

// ── localStorage helpers ──────────────────────────────────────────────────────

export function safeSetItem(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { console.error('Failed to save to localStorage:', e); return false; }
}

export function safeGetItem(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) { console.error('Failed to read from localStorage:', e); return defaultValue; }
}

export function safeRemoveItem(key) {
    try { localStorage.removeItem(key); return true; }
    catch (e) { console.error('Failed to remove from localStorage:', e); return false; }
}

// ── sessionStorage cache helpers ──────────────────────────────────────────────

export function getCachedData(key) {
    try {
        const cached = sessionStorage.getItem(key);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 5 * 60 * 1000) return data;
            sessionStorage.removeItem(key);
        }
    } catch (e) { console.warn('Cache read error:', e); }
    return null;
}

export function setCachedData(key, data) {
    try {
        sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) { console.warn('Cache write error:', e); }
}

export function clearCache() {
    try { sessionStorage.clear(); }
    catch (e) { console.warn('Cache clear error:', e); }
}

// ── Error logging ─────────────────────────────────────────────────────────────

export function sendErrorLog(error) {
    try {
        const errorLog = {
            timestamp: new Date().toISOString(),
            message:   error.message  || 'Unknown error',
            stack:     error.stack    || '',
            filename:  error.filename || '',
            lineno:    error.lineno   || '',
            colno:     error.colno    || '',
            userAgent: navigator.userAgent,
            url:       window.location.href,
            userId:    localStorage.getItem('currentUser') || 'anonymous'
        };

        fetch('/api/error-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorLog)
        }).catch(err => console.warn('Failed to send error log:', err));

    } catch (err) { console.warn('Error logging failed:', err); }
}
