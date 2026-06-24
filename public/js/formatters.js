export function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString('tr-TR');
}

export function formatVolume(volume) {
    if (volume >= 1_000_000) return (volume / 1_000_000).toFixed(1) + 'M';
    if (volume >= 1_000)     return (volume / 1_000).toFixed(1) + 'K';
    return String(volume);
}

export function formatDate(date, format = 'tr-TR') {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(format, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateTime(date, format = 'tr-TR') {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString(format, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

export function formatRelativeTime(date) {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';

    const diffMs    = Date.now() - d;
    const diffMins  = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays  = Math.floor(diffMs / 86_400_000);

    if (diffMins  < 1)  return 'Az önce';
    if (diffMins  < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays  < 7)  return `${diffDays} gün önce`;
    return formatDate(date);
}

export function formatCurrency(amount, currency = 'TRY', locale = 'tr-TR') {
    if (amount === null || amount === undefined || isNaN(amount)) return '-';
    return new Intl.NumberFormat(locale, {
        style: 'currency', currency,
        minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(amount);
}

// Turkish Lira with thousands separators and a trailing ₺ (e.g. "1.234,56 ₺").
// Shared by the portfolio tables and the allocation chart so they format identically.
export function formatTRY(value) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export function formatNumber(number, decimals = 2, locale = 'tr-TR') {
    if (number === null || number === undefined || isNaN(number)) return '-';
    return new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(number);
}

export function formatPercentage(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
}

// Simple value formatters (no Intl)
export function formatCurrencyValue(value, currency = '₺', decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return `${value.toFixed(decimals)} ${currency}`;
}

export function formatPercentageValue(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(decimals)}%`;
}

export function formatNumberValue(value, decimals = 2) {
    if (value === null || value === undefined || isNaN(value)) return '-';
    return value.toFixed(decimals);
}
