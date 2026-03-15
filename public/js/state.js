/**
 * AppState — Centralized client-side state with localStorage persistence.
 * ES-module singleton: every importer gets the same object reference.
 */
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
            localStorage.setItem('app_state', JSON.stringify(this._state));
        } catch (e) {
            console.warn('Failed to persist state:', e);
        }
    },

    init() {
        try {
            const saved = localStorage.getItem('app_state');
            if (saved) this._state = JSON.parse(saved);
        } catch (e) {
            console.warn('Failed to load saved state:', e);
            this._state = {};
        }
    },

    reset() {
        this._state = {};
        this._listeners.clear();
        localStorage.removeItem('app_state');
    }
};
