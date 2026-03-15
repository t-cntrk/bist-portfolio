/**
 * sorting.js — Stock table sort functionality.
 * Depends on: AppState (state.js), translations + getCurrentLang (i18n.js).
 * Exposes window.refreshSorting for use by refreshData() in app.js.
 */
import { AppState } from './state.js';
import { translations, getCurrentLang } from './i18n.js';

let currentStockData = [];
let currentSortType = 'default';

function sortStocks(sortType) {
    console.log('🔄 Starting sort with type:', sortType);
    currentStockData = collectStockDataForSorting();
    console.log('📊 Collected stock data:', currentStockData.length, 'rows');
    if (!currentStockData.length) { console.warn('⚠️ No stock data found for sorting'); return; }

    const sortedData = [...currentStockData];

    switch (sortType) {
        case 'gainers':
            sortedData.sort((a, b) => (parseFloat(b.changePercent) || 0) - (parseFloat(a.changePercent) || 0));
            break;
        case 'losers':
            sortedData.sort((a, b) => (parseFloat(a.changePercent) || 0) - (parseFloat(b.changePercent) || 0));
            break;
        case 'alphabetical':
            sortedData.sort((a, b) => (a.symbol || '').toLowerCase().localeCompare((b.symbol || '').toLowerCase()));
            break;
        case 'price':
            sortedData.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
            break;
        case 'volume':
            sortedData.sort((a, b) => {
                const aVol = parseFloat(String(a.volume).replace(/[^\d.-]/g, '')) || 0;
                const bVol = parseFloat(String(b.volume).replace(/[^\d.-]/g, '')) || 0;
                return bVol - aVol;
            });
            break;
        case 'default':
        default:
            sortedData.sort((a, b) => (a.symbol || '').toLowerCase().localeCompare((b.symbol || '').toLowerCase()));
            break;
    }

    renderSortedStocks(sortedData);
}

function collectStockDataForSorting() {
    const stocks = AppState.get('stocks');
    console.log('📊 CollectStockDataForSorting - stocks:', {
        isArray: Array.isArray(stocks), length: stocks ? stocks.length : 0
    });
    if (!Array.isArray(stocks)) { console.warn('⚠️ stocks is not an array, returning empty array'); return []; }
    return stocks.map(s => ({
        symbol: s.symbol,
        name: s.longName,
        price: s.regularMarketPrice,
        changePercent: s.regularMarketChangePercent,
        volume: s.regularMarketVolume || 0,
        rowElement: document.querySelector(`tr[data-symbol="${s.symbol}"]`)
    })).filter(item => item.rowElement !== null);
}

function renderSortedStocks(sortedData) {
    console.log('🎨 Rendering sorted stocks:', sortedData.length, 'rows');
    const tbody = document.getElementById('stocksData');
    if (!tbody) { console.error('❌ stocksData tbody not found'); return; }
    sortedData.forEach((stock, index) => {
        if (stock.rowElement && stock.rowElement.parentNode === tbody) {
            tbody.appendChild(stock.rowElement);
            console.log(`✅ Moved row ${index + 1}: ${stock.symbol}`);
        } else {
            console.warn(`⚠️ Row element not found for ${stock.symbol}`);
        }
    });
    console.log('✅ Sorting completed successfully');
}

export function initSorting() {
    console.log('🔧 Initializing sorting functionality...');
    const dropdownBtn = document.getElementById('sortDropdownBtn');
    const dropdownMenu = document.getElementById('sortDropdownMenu');
    const sortOptions = document.querySelectorAll('.sort-option');

    console.log('📋 Found elements:', { dropdownBtn: !!dropdownBtn, dropdownMenu: !!dropdownMenu, sortOptions: sortOptions.length });

    if (!dropdownBtn || !dropdownMenu) { console.error('❌ Required elements not found for sorting'); return; }
    if (sortOptions.length === 0) { console.error('❌ No sort options found'); return; }

    sortOptions.forEach((option, index) => {
        const sortType = option.getAttribute('data-sort');
        let optionTextEl = option.querySelector('.option-text');
        if (!sortType) console.warn(`⚠️ Sort option ${index} missing data-sort attribute`);
        if (!optionTextEl) {
            const i18nKey = option.getAttribute('data-i18n');
            const dict = translations[getCurrentLang()] || translations.tr || {};
            const derivedText = (i18nKey && dict[i18nKey]) ? dict[i18nKey] : (option.textContent || '');
            optionTextEl = document.createElement('span');
            optionTextEl.className = 'option-text';
            optionTextEl.textContent = derivedText.trim();
            option.appendChild(optionTextEl);
        }
    });

    dropdownBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdownMenu.classList.contains('active') ? closeDropdown() : openDropdown();
    });

    sortOptions.forEach(option => {
        option.addEventListener('click', function() {
            const sortType = this.getAttribute('data-sort');
            if (!sortType) { console.error('❌ No sort type found'); return; }

            sortOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');

            let optionText = 'Sırala';
            try {
                const el = this.querySelector('.option-text');
                if (el && el.textContent) optionText = el.textContent.trim();
            } catch (err) { console.warn('⚠️ Could not read option text:', err); }

            const sortTextEl = dropdownBtn.querySelector('.sort-text');
            if (sortTextEl) sortTextEl.textContent = optionText;

            currentSortType = sortType;
            sortStocks(sortType);
            closeDropdown();
        });
    });

    document.addEventListener('click', function(e) {
        if (!dropdownBtn.contains(e.target) && !dropdownMenu.contains(e.target)) closeDropdown();
    });

    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeDropdown(); });

    window.addEventListener('resize', function() {
        if (dropdownMenu.classList.contains('active')) {
            closeDropdown();
            setTimeout(() => openDropdown(), 50);
        }
    });

    function openDropdown() {
        console.log('🔓 Opening dropdown...');
        const btnRect = dropdownBtn.getBoundingClientRect();

        if (dropdownMenu.parentElement !== document.body) {
            try { document.body.appendChild(dropdownMenu); }
            catch (e) { console.warn('Could not portal dropdown menu to body:', e); }
        }

        const viewportHeight = window.innerHeight;
        const menuHeight = 200;
        const spaceBelow = viewportHeight - btnRect.bottom;
        const spaceAbove = btnRect.top;

        let topPosition;
        if (spaceBelow >= menuHeight + 20) topPosition = btnRect.bottom + 8;
        else if (spaceAbove >= menuHeight + 20) topPosition = btnRect.top - menuHeight - 8;
        else topPosition = Math.max(20, btnRect.bottom + 8);

        const viewportWidth = window.innerWidth;
        const desiredWidth = Math.max(btnRect.width, 220);
        const clampedLeft = Math.min(Math.max(8, btnRect.left), Math.max(8, viewportWidth - desiredWidth - 8));

        Object.assign(dropdownMenu.style, {
            position: 'fixed', top: topPosition + 'px', left: clampedLeft + 'px',
            right: 'auto', minWidth: desiredWidth + 'px', maxHeight: '200px',
            overflowY: 'auto', display: 'block', opacity: '1',
            visibility: 'visible', transform: 'translateY(0)', pointerEvents: 'auto'
        });

        dropdownMenu.classList.add('active');
        dropdownBtn.classList.add('active');
        console.log('✅ Dropdown opened');
    }

    function closeDropdown() {
        console.log('🔒 Closing dropdown...');
        dropdownMenu.classList.remove('active');
        dropdownBtn.classList.remove('active');
        Object.assign(dropdownMenu.style, {
            display: 'none', opacity: '0', visibility: 'hidden',
            transform: 'translateY(-10px)', pointerEvents: 'none',
            position: '', top: '', left: '', right: '', minWidth: ''
        });
        console.log('✅ Dropdown closed');
    }

    if (currentSortType === 'default') {
        const sortTextEl = dropdownBtn.querySelector('.sort-text');
        if (sortTextEl) {
            const defaultOption = document.querySelector('.sort-option[data-sort="default"] .option-text');
            if (defaultOption) sortTextEl.textContent = defaultOption.textContent;
        }
        sortOptions.forEach(opt => opt.classList.remove('active'));
        const defaultOptionEl = document.querySelector('.sort-option[data-sort="default"]');
        if (defaultOptionEl) defaultOptionEl.classList.add('active');
        sortStocks('default');
    }

    console.log('✅ Sorting functionality initialized');
}

export function refreshSorting() {
    if (currentSortType && currentSortType !== 'default') {
        if (window.sortingTimeout) clearTimeout(window.sortingTimeout);
        window.sortingTimeout = setTimeout(() => sortStocks(currentSortType), 100);
    }
}

// Expose globally so refreshData() in app.js can call it
window.refreshSorting = refreshSorting;
