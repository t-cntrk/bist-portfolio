/**
 * AppState — Centralized client-side state with localStorage persistence.
 * ES-module singleton: every importer gets the same object reference.
 *
 * Only durable data is persisted. Live market data ("stocks", "fx") is
 * ephemeral: it would be stale on reload and bloats localStorage, so it is
 * kept in memory only and re-fetched on boot.
 */
const EPHEMERAL_KEYS = new Set(['stocks', 'fx']);

export const AppState = {
    _state: {},
    _listeners: new Map(),

    get(key) {
        return this._state[key];
    },

    set(key, value) {
        const oldValue = this._state[key];
        this._state[key] = value;
        this._persistState();

        if (this._listeners.has(key)) {
            this._listeners.get(key).forEach(cb => {
                try { cb(value, oldValue); }
                catch (e) { console.error('State listener error:', e); }
            });
        }
    },

    subscribe(key, callback) {
        if (!this._listeners.has(key)) this._listeners.set(key, []);
        this._listeners.get(key).push(callback);

        return () => {
            const list = this._listeners.get(key);
            if (list) {
                const i = list.indexOf(callback);
                if (i > -1) list.splice(i, 1);
            }
        };
    },

    _persistState() {
        try {
            const persistable = {};
            for (const [key, value] of Object.entries(this._state)) {
                if (!EPHEMERAL_KEYS.has(key)) persistable[key] = value;
            }
            if (Object.keys(persistable).length === 0) {
                localStorage.removeItem('app_state');
            } else {
                localStorage.setItem('app_state', JSON.stringify(persistable));
            }
        } catch (e) {
            console.warn('Failed to persist state:', e);
        }
    },

    init() {
        try {
            const saved = localStorage.getItem('app_state');
            this._state = saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.warn('Failed to load saved state:', e);
            this._state = {};
        }
        // Drop any ephemeral market data lingering from older versions so we
        // never render stale prices on reload, then rewrite the cleaned state.
        for (const key of EPHEMERAL_KEYS) delete this._state[key];
        this._persistState();
    },

    reset() {
        this._state = {};
        this._listeners.clear();
        localStorage.removeItem('app_state');
    }
};
