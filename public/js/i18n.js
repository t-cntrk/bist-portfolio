/**
 * i18n — Internationalization: translations, language toggle, DOM text update.
 * Exposes window.t, window.getCurrentLang, window.setCurrentLang,
 * window.toggleLanguage, window.applyI18n for inline HTML handlers.
 */

export const translations = {
    tr: {
        'login.title': 'Borsa Portal',
        'login.subtitle': 'Anlık veriler, akıllı yatırım',
        'login.usernameLabel': 'Kullanıcı Adı',
        'login.usernamePlaceholder': 'Kullanıcı adınızı girin',
        'login.passwordLabel': 'Şifre',
        'login.passwordPlaceholder': 'Şifrenizi girin',
        'login.submit': 'Giriş Yap',
        'login.rememberMe': 'Beni Hatırla',
        'tabs.markets': 'Piyasalar',
        'tabs.portfolio': 'Portföyüm',
        'allocation.title': 'Varlık Dağılımı',
        'allocation.empty': 'Varlık Bulunmuyor',
        'login.forgot': 'Şifremi Unuttum?',
        'login.verifyNotice': '📧 E-postanızı doğrulamanız gerekiyor',
        'login.resend': 'Yeniden Gönder',
        'login.or': 'veya',
        'login.create': 'Hesap oluştur',
        'dash.status': 'Durum',
        'dash.lastUpdate': 'Son güncelleme',
        'dash.nextUpdate': 'Sonraki güncelleme',
        'dash.api': 'API Kullanımı',
        'dash.refresh': 'Yenile',
        'dash.testChart': 'Test Chart',
        'dash.currencyTitle': 'Döviz Kurları',
        'dash.portfolioTitle': 'Portföyüm',
        // Register
        'register.firstName': 'İsim',
        'register.lastName': 'Soyisim',
        'register.email': 'E-posta',
        'register.birthdate': 'Doğum Tarihi',
        'register.username': 'Kullanıcı Adı',
        'register.password': 'Şifre',
        'register.passwordConfirm': 'Şifrenizi Tekrar Giriniz',
        'register.passwordHint': 'Şifre en az 8 karakter, büyük harf, küçük harf, rakam ve özel karakter içermelidir.',
        'register.passwordMismatch': 'Şifreler eşleşmiyor.',
        'register.submit': 'Kaydol',
        // Tables
        'tbl.symbol': 'Sembol',
        'tbl.currentPrice': 'Güncel Fiyat',
        'tbl.prevClose': 'Önceki Kapanış',
        'tbl.change': 'Değişim',
        'tbl.changePct': 'Değişim %',
        'tbl.volume': 'Hacim',
        'tbl.chart': 'Grafik',
        'tbl.portfolio': 'Portföy',
        'tbl.currency': 'Döviz',
        'tbl.asset': 'Varlık',
        'tbl.qty': 'Miktar',
        'tbl.buy': 'Alış',
        'tbl.buyPrice': 'Alış Fiyatı',
        'tbl.invest': 'Yatırım',
        'tbl.investTotal': 'Toplam Yatırım (₺)',
        'tbl.currentValue': 'Güncel Değer (₺)',
        'tbl.pnl': 'Kar/Zarar (₺)',
        'tbl.pnlPct': 'Kar/Zarar (%)',
        'tbl.action': 'İşlem',
        // Modals & prompts
        'modal.deleteTitle': 'Silme Onayı',
        'modal.deleteBody': '{item} {type} silinsin mi?',
        'modal.cancel': 'İptal',
        'modal.delete': 'Sil',
        'modal.addQty': 'Miktar',
        'modal.addPrice': 'Alış Fiyatı (₺)',
        'modal.addSubmit': 'Ekle',
        'fx.promptQty': '{name} miktarını girin:',
        'fx.promptPrice': '{name} alış fiyatını girin:',
        // FX add modal
        'fx.addTitle': '{name} Portföye Ekle',
        'fx.type': 'Döviz Türü',
        'fx.qty': 'Miktar',
        'fx.price': 'Alış Fiyatı',
        'fx.qtyPh': 'Miktar giriniz',
        'fx.pricePh': 'Alış fiyatı giriniz',
        'fx.submit': 'Portföye Ekle',
        // Messages
        'msg.addSuccess': 'Portföye başarıyla eklendi',
        'msg.addError': 'Portföye ekleme hatası: ',
        'msg.delSuccess': 'Portföy öğesi silindi',
        'msg.delError': 'Silme hatası: ',
        'msg.viewLogin': 'Portföyü görüntülemek için giriş yapmanız gerekiyor.',
        'msg.noStocks': 'Portföyünüzde henüz hisse senedi bulunmuyor.',
        'msg.loadError': 'Portföy yüklenirken hata oluştu.',
        'msg.portfolioFetchError': 'Portföy verileri yüklenirken hata oluştu',
        // Forgot password
        'forgot.title': 'Şifremi Unuttum',
        'forgot.emailLabel': 'E-posta Adresi',
        'forgot.submit': 'Şifre Sıfırlama Bağlantısı Gönder',
        // Currency names
        'currency.usd': 'Amerikan Doları',
        'currency.eur': 'Euro',
        'currency.goldOunce': 'Altın (Ons)',
        'currency.goldGram': 'Gram Altın',
        // Summary
        'summary.totalInvestment': 'Toplam Yatırım',
        'summary.currentValue': 'Güncel Değer',
        'summary.totalPnL': 'Toplam Kar/Zarar',
        'summary.pnlPct': 'Kar/Zarar %',
        // Chart ranges
        'chart.1w': '1 Hafta',
        'chart.1m': '1 Ay',
        'chart.1y': '1 Yıl',
        'chart.10y': '10 Yıl',
        // Status messages
        'status.loading': 'Veriler yükleniyor...',
        'status.updated': 'Veriler güncellendi',
        'status.error': 'Veri yükleme hatası',
        // Ticker labels
        'ticker.bist100': 'BIST100',
        'ticker.usdtry': 'USD/TRY',
        'ticker.gold': 'GOLD',
        // Sorting options
        'sort.label': 'Sıralama:',
        'sort.default': 'Varsayılan',
        'sort.gainers': 'En Çok Kazanan',
        'sort.losers': 'En Çok Kaybeden',
        'sort.alphabetical': 'Alfabetik',
        'sort.price': 'Fiyata Göre',
        'sort.volume': 'En Yüksek Hacim'
    },
    en: {
        'login.title': 'Stock Portal',
        'login.subtitle': 'Live data, smarter investing',
        'login.usernameLabel': 'Username',
        'login.usernamePlaceholder': 'Enter your username',
        'login.passwordLabel': 'Password',
        'login.passwordPlaceholder': 'Enter your password',
        'login.submit': 'Sign In',
        'login.rememberMe': 'Remember Me',
        'tabs.markets': 'Markets',
        'tabs.portfolio': 'My Portfolio',
        'allocation.title': 'Asset Allocation',
        'allocation.empty': 'No Assets',
        'login.forgot': 'Forgot Password?',
        'login.verifyNotice': '📧 Please verify your email address',
        'login.resend': 'Resend',
        'login.or': 'or',
        'login.create': 'Create account',
        'dash.status': 'Status',
        'dash.lastUpdate': 'Last update',
        'dash.nextUpdate': 'Next update',
        'dash.api': 'API Usage',
        'dash.refresh': 'Refresh',
        'dash.testChart': 'Test Chart',
        'dash.currencyTitle': 'Currency Rates',
        'dash.portfolioTitle': 'My Portfolio',
        // Register
        'register.firstName': 'First Name',
        'register.lastName': 'Last Name',
        'register.email': 'Email',
        'register.birthdate': 'Birth Date',
        'register.username': 'Username',
        'register.password': 'Password',
        'register.passwordConfirm': 'Confirm Password',
        'register.passwordHint': 'Password must be at least 8 characters with uppercase, lowercase, number and special char.',
        'register.passwordMismatch': 'Passwords do not match.',
        'register.submit': 'Register',
        // Tables
        'tbl.symbol': 'Symbol',
        'tbl.currentPrice': 'Current Price',
        'tbl.prevClose': 'Previous Close',
        'tbl.change': 'Change',
        'tbl.changePct': 'Change %',
        'tbl.volume': 'Volume',
        'tbl.chart': 'Chart',
        'tbl.portfolio': 'Portfolio',
        'tbl.currency': 'Currency',
        'tbl.asset': 'Asset',
        'tbl.qty': 'Quantity',
        'tbl.buy': 'Buy',
        'tbl.buyPrice': 'Buy Price',
        'tbl.invest': 'Investment',
        'tbl.investTotal': 'Total Investment (₺)',
        'tbl.currentValue': 'Current Value (₺)',
        'tbl.pnl': 'P/L (₺)',
        'tbl.pnlPct': 'P/L (%)',
        'tbl.action': 'Action',
        // Modals & prompts
        'modal.deleteTitle': 'Delete Confirmation',
        'modal.deleteBody': 'Delete {item} {type}?',
        'modal.cancel': 'Cancel',
        'modal.delete': 'Delete',
        'modal.addQty': 'Quantity',
        'modal.addPrice': 'Buy Price (₺)',
        'modal.addSubmit': 'Add',
        'fx.promptQty': 'Enter quantity for {name}:',
        'fx.promptPrice': 'Enter buy price for {name}:',
        // FX add modal
        'fx.addTitle': 'Add {name} to Portfolio',
        'fx.type': 'Currency Type',
        'fx.qty': 'Quantity',
        'fx.price': 'Buy Price',
        'fx.qtyPh': 'Enter quantity',
        'fx.pricePh': 'Enter buy price',
        'fx.submit': 'Add to Portfolio',
        // Ticker labels
        'ticker.bist100': 'BIST100',
        'ticker.usdtry': 'USD/TRY',
        'ticker.gold': 'GOLD',
        // Sorting options
        'sort.label': 'Sort by:',
        'sort.default': 'Default',
        'sort.gainers': 'Top Gainers',
        'sort.losers': 'Top Losers',
        'sort.alphabetical': 'Alphabetical',
        'sort.price': 'By Price',
        'sort.volume': 'Highest Volume',
        // Table headers (duplicates from TR kept for completeness)
        'tbl.symbol': 'Symbol',
        // Messages
        'msg.addSuccess': 'Added to portfolio successfully',
        'msg.addError': 'Add to portfolio error: ',
        'msg.delSuccess': 'Portfolio item deleted',
        'msg.delError': 'Delete error: ',
        'msg.viewLogin': 'You need to log in to view the portfolio.',
        'msg.noStocks': 'There are no stocks in your portfolio yet.',
        'msg.loadError': 'An error occurred while loading the portfolio.',
        'msg.portfolioFetchError': 'Error occurred while loading portfolio data',
        // Forgot password
        'forgot.title': 'Forgot Password',
        'forgot.emailLabel': 'Email Address',
        'forgot.submit': 'Send Reset Link',
        // Currency names
        'currency.usd': 'US Dollar',
        'currency.eur': 'Euro',
        'currency.goldOunce': 'Gold (Ounce)',
        'currency.goldGram': 'Gold (Gram)',
        // Summary
        'summary.totalInvestment': 'Total Investment',
        'summary.currentValue': 'Current Value',
        'summary.totalPnL': 'Total P/L',
        'summary.pnlPct': 'P/L %',
        // Chart ranges
        'chart.1w': '1 Week',
        'chart.1m': '1 Month',
        'chart.1y': '1 Year',
        'chart.10y': '10 Years',
        // Status messages
        'status.loading': 'Loading data...',
        'status.updated': 'Data updated',
        'status.error': 'Data loading error'
    }
};

export function getCurrentLang() {
    return localStorage.getItem('lang') || 'tr';
}

export function setCurrentLang(lang) {
    localStorage.setItem('lang', lang);
}

function formatI18n(key, vars) {
    const lang = getCurrentLang();
    const str = (translations[lang] && translations[lang][key])
        || (translations.tr && translations.tr[key])
        || key;
    if (!vars) return str;
    return Object.keys(vars).reduce(
        (s, k) => s.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]), str
    );
}

export function t(key, vars) {
    return formatI18n(key, vars);
}

export function applyI18n() {
    const lang = getCurrentLang();
    const dict = translations[lang] || translations.tr;

    document.querySelectorAll('[data-i18n]:not(.sort-option):not(#sortDropdownBtn)')
        .forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) el.textContent = dict[key];
        });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (dict[key]) el.setAttribute('placeholder', dict[key]);
    });

    const stats = document.querySelectorAll('.stats-bar .stat-item .stat-label');
    if (stats[0]) stats[0].textContent = dict['dash.status'];
    if (stats[1]) stats[1].textContent = dict['dash.lastUpdate'];
    if (stats[2]) stats[2].textContent = dict['dash.nextUpdate'];
    if (stats[3]) stats[3].textContent = dict['dash.api'];

    const refreshText = document.querySelector('#globalRefreshBtn .global-refresh-label');
    if (refreshText) refreshText.textContent = dict['dash.refresh'];

    const currencyTitle = document.querySelector('.currency-section .section-title');
    if (currencyTitle) currencyTitle.textContent = dict['dash.currencyTitle'];

    const portfolioTitle = document.querySelector('.new-portfolio-title');
    if (portfolioTitle && portfolioTitle.childNodes.length > 1) {
        portfolioTitle.lastChild.nodeValue = ' ' + dict['dash.portfolioTitle'];
    }

    const lastUpdLbl = document.querySelector('.new-portfolio-update [data-i18n="dash.lastUpdate"]');
    if (lastUpdLbl) lastUpdLbl.textContent = dict['dash.lastUpdate'];

    const langToggle = document.getElementById('langToggle');
    if (langToggle) langToggle.style.display = 'block';

    // Table headers — stocks
    document.querySelectorAll('.stocks-container thead th').forEach((th, idx) => {
        const keys = ['tbl.symbol', 'tbl.currentPrice', 'tbl.prevClose', 'tbl.change', 'tbl.changePct', 'tbl.volume', 'tbl.chart', 'tbl.portfolio'];
        if (keys[idx] && dict[keys[idx]]) th.textContent = dict[keys[idx]];
    });

    // Currency table headers
    document.querySelectorAll('.currency-section thead th').forEach((th, idx) => {
        const keys = ['tbl.currency', 'tbl.currentPrice', 'tbl.change', 'tbl.changePct', 'tbl.portfolio'];
        if (keys[idx] && dict[keys[idx]]) th.textContent = dict[keys[idx]];
    });

    // Portfolio table headers
    document.querySelectorAll('.new-portfolio-table thead th').forEach((th, idx) => {
        const keys = ['tbl.asset', 'tbl.qty', 'tbl.buyPrice', 'tbl.investTotal', 'tbl.currentValue', 'tbl.pnl', 'tbl.pnlPct', 'tbl.action'];
        if (keys[idx] && dict[keys[idx]]) th.textContent = dict[keys[idx]];
    });

    // Forgot password modal
    const forgotTitle = document.querySelector('#forgotPasswordModal [data-i18n="forgot.title"]');
    if (forgotTitle) forgotTitle.textContent = dict['forgot.title'];
    const forgotEmailLbl = document.querySelector('#forgotPasswordModal [data-i18n="forgot.emailLabel"]');
    if (forgotEmailLbl) forgotEmailLbl.textContent = dict['forgot.emailLabel'];
    const forgotBtn = document.getElementById('forgotSubmitBtn');
    if (forgotBtn && dict['forgot.submit']) forgotBtn.textContent = dict['forgot.submit'];

    // Currency names
    const usdName = document.querySelector('.currency-section .currency-name[data-i18n="currency.usd"]');
    if (usdName) usdName.textContent = dict['currency.usd'];
    const goldOunce = document.querySelector('.currency-section .currency-name[data-i18n="currency.goldOunce"]');
    if (goldOunce) goldOunce.textContent = dict['currency.goldOunce'];
    const goldGram = document.querySelector('.currency-section .currency-name[data-i18n="currency.goldGram"]');
    if (goldGram) goldGram.textContent = dict['currency.goldGram'];

    // Portfolio summary cards
    document.querySelectorAll('.new-portfolio-summary [data-i18n^="summary."]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
    });

    // Sort dropdown button text
    const sortDropdownBtn = document.getElementById('sortDropdownBtn');
    if (sortDropdownBtn) {
        const sortTextEl = sortDropdownBtn.querySelector('.sort-text');
        if (sortTextEl && dict['sort.label']) sortTextEl.textContent = dict['sort.label'];
    }

    // Sort option texts
    document.querySelectorAll('.sort-option[data-i18n]').forEach(option => {
        const key = option.getAttribute('data-i18n');
        const optionTextEl = option.querySelector('.option-text');
        if (optionTextEl && dict[key]) optionTextEl.textContent = dict[key];
    });

    // Ticker labels
    document.querySelectorAll('[data-i18n^="ticker."]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
    });

    // Portfolio refresh buttons
    const refreshPortfolioBtn = document.getElementById('refreshPortfolioBtn');
    if (refreshPortfolioBtn) {
        const span = refreshPortfolioBtn.querySelector('.btn-text');
        if (span) span.textContent = dict['dash.refresh'];
    }
    const newRefreshPortfolioBtn = document.getElementById('newRefreshPortfolioBtn');
    if (newRefreshPortfolioBtn) {
        const span = newRefreshPortfolioBtn.querySelector('.btn-text');
        if (span) span.textContent = dict['dash.refresh'];
    }

    // Chart range options
    document.querySelectorAll('#chartRange option').forEach(opt => {
        const key = opt.getAttribute('data-i18n');
        if (key && dict[key]) opt.textContent = dict[key];
    });

    // Profile modal
    const profileDict = {
        tr: { title: 'Hesap Bilgileri', subtitle: 'Yatırım hesabınızın detayları', username: 'KULLANICI ADI', name: 'İSİM', surname: 'SOYİSİM', birthdate: 'DOĞUM TARİHİ', changePwd: 'Şifre Değiştir', logout: 'Çıkış Yap', deleteAcc: 'Hesabı Sil' },
        en: { title: 'Account Details', subtitle: 'Details of your investment account', username: 'USERNAME', name: 'FIRST NAME', surname: 'LAST NAME', birthdate: 'BIRTH DATE', changePwd: 'Change Password', logout: 'Log Out', deleteAcc: 'Delete Account' }
    }[lang];
    const pTitle = document.querySelector('#profileModal > div > div div:nth-child(2)');
    if (pTitle) pTitle.textContent = profileDict.title;
    const pSub = document.querySelector('#profileModal > div > div div:nth-child(3)');
    if (pSub) pSub.textContent = profileDict.subtitle;
    const lblUsername = document.querySelector('#profileModal #profileUsernameDisplay2')?.previousElementSibling;
    if (lblUsername) lblUsername.textContent = profileDict.username;
    const lblName = document.querySelector('#profileModal #profileNameDisplay')?.previousElementSibling;
    if (lblName) lblName.textContent = profileDict.name;
    const lblSurname = document.querySelector('#profileModal #profileSurnameDisplay')?.previousElementSibling;
    if (lblSurname) lblSurname.textContent = profileDict.surname;
    const lblBirth = document.querySelector('#profileModal #profileBirthdateDisplay')?.previousElementSibling;
    if (lblBirth) lblBirth.textContent = profileDict.birthdate;
    const btnChange = document.getElementById('profileChangePasswordBtn');
    if (btnChange) btnChange.textContent = profileDict.changePwd;
    const btnLogout = document.getElementById('profileLogoutBtn');
    if (btnLogout) btnLogout.textContent = profileDict.logout;
    const btnDelete = document.getElementById('profileDeleteBtn');
    if (btnDelete) btnDelete.textContent = profileDict.deleteAcc;

    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'tr');
}

export function toggleLanguage() {
    const next = getCurrentLang() === 'tr' ? 'en' : 'tr';
    setCurrentLang(next);
    applyI18n();
}

// Global assignments — needed by inline HTML handlers and other non-module scripts
window.t = t;
window.getCurrentLang = getCurrentLang;
window.setCurrentLang = setCurrentLang;
window.toggleLanguage = toggleLanguage;
window.applyI18n = applyI18n;
