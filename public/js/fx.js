// fx.js
// Import common functions from utils.js
import { getApiUrl, createApiRequest } from './api.js';
import { showErrorMessage, showSuccessMessage, showDataUpdateAnimation } from './notifications.js';
import { computeDataQuality, renderDataQualityBadge } from './dom-helpers.js';

// --- GLOBALS & CONSTANTS ---
const FX_GRAM_CONVERT = 31.1035;
const FX_CLASSES = {
    USD: { price: '.usd-price', change: '.usd-change', percent: '.usd-change-percent', key: 'USD/TRY', api: 'USDTRY=X' },
    EUR: { price: '.eur-price', change: '.eur-change', percent: '.eur-change-percent', key: 'EUR/TRY', api: 'EURTRY=X' },
    ONS: { price: '.ons-price', change: '.ons-change', percent: '.ons-change-percent', key: 'XAU/USD', api: 'GC=F' },
    GRAM: { price: '.gram-price', change: '.gram-change', percent: '.gram-change-percent', key: 'XAU/TRY' }
};

// Global variables
if (!window.fxLatestPrices) {
    window.fxLatestPrices = {};
}

// --- UTILS ---
function safeQuerySelector(selector) {
    const el = document.querySelector(selector);
    if (!el) console.warn('Element not found:', selector);
    return el;
}

// Enhanced error handling and loading states for FX
function showFxLoading(operation = 'Döviz verileri yükleniyor...') {
    const currencyData = document.getElementById('currencyData');
    if (currencyData) {
        let loadingDiv = currencyData.querySelector('.fx-loading-overlay');
        if (!loadingDiv) {
            loadingDiv = document.createElement('div');
            loadingDiv.className = 'fx-loading-overlay';
            loadingDiv.style.cssText = `
                text-align: center;
                padding: 40px;
                color: rgba(255,255,255,0.7);
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.8);
                border-radius: 12px;
                z-index: 10;
            `;
            currencyData.appendChild(loadingDiv);
        }
        loadingDiv.innerHTML = `
            <div class="spinner" style="margin: 0 auto 16px auto;"></div>
            <div>${operation}</div>
        `;
    }
}

function hideFxLoading() {
    const currencyData = document.getElementById('currencyData');
    if (currencyData) {
        const loadingDiv = currencyData.querySelector('.fx-loading-overlay');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }
}

function showFxError(message) {
    const currencyData = document.getElementById('currencyData');
    if (currencyData) {
        currencyData.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <div style="font-size: 48px; margin-bottom: 16px;">💱</div>
                <div style="font-size: 16px; margin-bottom: 16px;">${message}</div>
                <button type="button" class="fx-retry-btn" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                    Tekrar Dene
                </button>
            </div>
        `;
    }
}

function validateFxData(fxName, quantity, price) {
    const errors = [];
    
    if (!fxName || fxName.trim() === '') {
        errors.push('Döviz türü gereklidir');
    }
    
    if (!quantity || isNaN(quantity) || quantity <= 0) {
        errors.push('Geçerli bir miktar giriniz');
    }
    
    if (!price || isNaN(price) || price <= 0) {
        errors.push('Geçerli bir alış fiyatı giriniz');
    }
    
    return errors;
}

// Clear cache function for manual refresh (uses /api/stocks/clear-cache)
export async function clearFxCache() {
    try {
        // createApiRequest attaches the x-csrf-token header the endpoint now requires.
        const response = await createApiRequest('/api/stocks/clear-cache', { method: 'POST' });
        if (response.ok) {
            return true;
        }
    } catch (error) {
        console.error('Cache clear error:', error);
    }
    return false;
}

// Enhanced fetchCurrencyData with retry mechanism
export async function fetchCurrencyData(retryCount = 0, forceRefresh = false) {
    const maxRetries = 3;
    
    try {
        showFxLoading('Döviz kurları güncelleniyor...');
        
        // Clear cache if force refresh is requested
        if (forceRefresh) {
            await clearFxCache();
        }
        
        const response = await fetch(getApiUrl('/api/stocks/fx'), { credentials: 'include' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const raw = await response.json();
        // Flag mock/stale data so users don't mistake placeholder or cached rates for live ones.
        renderDataQualityBadge(document.querySelector('.currency-section .section-title'), computeDataQuality(Array.isArray(raw) ? raw : []));
        // Backend returns array; normalize to object keyed by symbol
        const fxData = Array.isArray(raw) ? Object.fromEntries((raw || []).map(d => [d.symbol, d])) : (raw || {});
        
        if (!fxData || typeof fxData !== 'object') {
            throw new Error('Invalid FX data received');
        }
        
        // Update global prices
        window.fxLatestPrices = fxData;
        
        // Update display
        updateCurrencyDisplay(fxData);
        
        hideFxLoading();
        showDataUpdateAnimation('currencyData');
        
    } catch (error) {
        console.error('FX fetch error:', error);
        
        if (retryCount < maxRetries) {
            console.log(`Retrying FX fetch (${retryCount + 1}/${maxRetries})`);
            setTimeout(() => {
                fetchCurrencyData(retryCount + 1);
            }, 1000 * (retryCount + 1));
        } else {
            hideFxLoading();
            showFxError('Döviz verileri yüklenemedi: ' + error.message);
        }
    }
}

async function addFxToPortfolio(fxName, quantity, price) {
    try {
        const response = await createApiRequest('/api/portfolio', {
            method: 'POST',
            body: JSON.stringify({
                symbol: fxName,
                quantity: parseFloat(quantity),
                purchase: parseFloat(price),
                type: 'fx'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || errorData.message || 'Portföye ekleme başarısız');
        }
        
        showSuccessMessage('Döviz portföye başarıyla eklendi');
        return true;
    } catch (error) {
        console.error('FX portfolio add error:', error);
        showErrorMessage('Döviz portföye ekleme hatası: ' + error.message);
        return false;
    }
}

export function updateCurrencyDisplay(fxData) {
    try {
        // SAFETY CHECK: Ensure table structure is intact
        const currencyTable = document.querySelector('.currency-section .stocks-container table');
        if (!currencyTable) {
            console.warn('Currency table not found, skipping update');
            return;
        }
        
        // SAFETY CHECK: Verify table has correct structure
        const headers = currencyTable.querySelectorAll('thead th');
        if (headers.length !== 5) {
            console.warn('Currency table structure corrupted, headers count:', headers.length);
            return;
        }
        
        // USD/TRY
        if (fxData['USDTRY=X']) {
            const usd = fxData['USDTRY=X'];
            const price = usd.regularMarketPrice || 0;
            const prevClose = usd.regularMarketPreviousClose || 0;
            const change = price - prevClose;
            const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
            
            const priceEl = document.querySelector('.usd-price');
            const changeEl = document.querySelector('.usd-change');
            const percentEl = document.querySelector('.usd-change-percent');
            
            if (priceEl) priceEl.textContent = price.toFixed(4) + ' ₺';
            if (changeEl) {
                changeEl.textContent = (change > 0 ? '+' : '') + change.toFixed(4) + ' ₺';
                changeEl.classList.remove('change-positive', 'change-negative', 'neutral');
                changeEl.classList.add(change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : 'neutral');
            }
            if (percentEl) {
                percentEl.textContent = (changePercent > 0 ? '+' : '') + changePercent.toFixed(2) + '%';
                percentEl.classList.remove('change-positive', 'change-negative', 'neutral');
                percentEl.classList.add(changePercent > 0 ? 'change-positive' : changePercent < 0 ? 'change-negative' : 'neutral');
            }
        }
        
        // EUR/TRY
        if (fxData['EURTRY=X']) {
            const eur = fxData['EURTRY=X'];
            const price = eur.regularMarketPrice || 0;
            const prevClose = eur.regularMarketPreviousClose || 0;
            const change = price - prevClose;
            const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
            
            const priceEl = document.querySelector('.eur-price');
            const changeEl = document.querySelector('.eur-change');
            const percentEl = document.querySelector('.eur-change-percent');
            
            if (priceEl) priceEl.textContent = price.toFixed(4) + ' ₺';
            if (changeEl) {
                changeEl.textContent = (change > 0 ? '+' : '') + change.toFixed(4) + ' ₺';
                changeEl.classList.remove('change-positive', 'change-negative', 'neutral');
                changeEl.classList.add(change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : 'neutral');
            }
            if (percentEl) {
                percentEl.textContent = (changePercent > 0 ? '+' : '') + changePercent.toFixed(2) + '%';
                percentEl.classList.remove('change-positive', 'change-negative', 'neutral');
                percentEl.classList.add(changePercent > 0 ? 'change-positive' : changePercent < 0 ? 'change-negative' : 'neutral');
            }
        }
        
        // Gold (XAU/USD)
        if (fxData['GC=F']) {
            const gold = fxData['GC=F'];
            const price = gold.regularMarketPrice || 0;
            const prevClose = gold.regularMarketPreviousClose || 0;
            const change = price - prevClose;
            const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
            
            const priceEl = document.querySelector('.ons-price');
            const changeEl = document.querySelector('.ons-change');
            const percentEl = document.querySelector('.ons-change-percent');
            
            if (priceEl) priceEl.textContent = price.toFixed(2) + ' $';
            if (changeEl) {
                changeEl.textContent = (change > 0 ? '+' : '') + change.toFixed(2) + ' $';
                changeEl.classList.remove('change-positive', 'change-negative', 'neutral');
                changeEl.classList.add(change > 0 ? 'change-positive' : change < 0 ? 'change-negative' : 'neutral');
            }
            if (percentEl) {
                percentEl.textContent = (changePercent > 0 ? '+' : '') + changePercent.toFixed(2) + '%';
                percentEl.classList.remove('change-positive', 'change-negative', 'neutral');
                percentEl.classList.add(changePercent > 0 ? 'change-positive' : changePercent < 0 ? 'change-negative' : 'neutral');
            }
            
            // Calculate gram gold (XAU/TRY) — requires live USD/TRY rate
            const gramPriceEl = document.querySelector('.gram-price');
            const gramChangeEl = document.querySelector('.gram-change');
            const gramPercentEl = document.querySelector('.gram-change-percent');
            
            const usdTry = fxData['USDTRY=X']?.regularMarketPrice ?? null;
            if (usdTry === null || usdTry === 0) {
                if (gramPriceEl) gramPriceEl.textContent = 'Kur verisi alınamadı';
                if (gramChangeEl) gramChangeEl.textContent = '-';
                if (gramPercentEl) gramPercentEl.textContent = '-';
            } else {
                const gramPrice = (price / FX_GRAM_CONVERT) * usdTry;
                const gramPrevPrice = (prevClose / FX_GRAM_CONVERT) * usdTry;
                const gramChange = gramPrice - gramPrevPrice;
                const gramChangePercent = gramPrevPrice !== 0 ? (gramChange / gramPrevPrice) * 100 : 0;
                
                if (gramPriceEl) gramPriceEl.textContent = gramPrice.toFixed(2) + ' ₺';
                if (gramChangeEl) {
                    gramChangeEl.textContent = (gramChange > 0 ? '+' : '') + gramChange.toFixed(2) + ' ₺';
                    gramChangeEl.classList.remove('change-positive', 'change-negative', 'neutral');
                    gramChangeEl.classList.add(gramChange > 0 ? 'change-positive' : gramChange < 0 ? 'change-negative' : 'neutral');
                }
                if (gramPercentEl) {
                    gramPercentEl.textContent = (gramChangePercent > 0 ? '+' : '') + gramChangePercent.toFixed(2) + '%';
                    gramPercentEl.classList.remove('change-positive', 'change-negative', 'neutral');
                    gramPercentEl.classList.add(gramChangePercent > 0 ? 'change-positive' : gramChangePercent < 0 ? 'change-negative' : 'neutral');
                }
            }
        }
        
    } catch (error) {
        console.error('Currency display update error:', error);
        showErrorMessage('Döviz verileri güncellenirken hata oluştu');
    }
}

let fxAutoRefreshInterval = null;

// FX Portfolio modal
export function showFxPortfolioModal(fxName) {
    try {
        // Remove old modal if exists
        const old = document.getElementById('fxPortfolioModal');
        if (old) old.remove();
        
        // Create new modal
        const modal = document.createElement('div');
        modal.id = 'fxPortfolioModal';
        const t = window.t || ((k, v) => k);
        const titleText = t('fx.addTitle', { name: fxName });
        const lblType = t('fx.type');
        const lblQty = t('fx.qty');
        const lblPrice = t('fx.price');
        const phQty = t('fx.qtyPh');
        const phPrice = t('fx.pricePh');
        const submitText = t('fx.submit');

        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            ">
                <div style="
                    background: #23243a;
                    padding: 30px;
                    border-radius: 15px;
                    min-width: 320px;
                    max-width: 95vw;
                    position: relative;
                    border: 1px solid #3b82f6;
                ">
                    <button id="closeFxPortfolioModalBtn" style="
                        position: absolute;
                        top: 15px;
                        right: 15px;
                        background: transparent;
                        border: none;
                        color: white;
                        font-size: 20px;
                        cursor: pointer;
                        width: 30px;
                        height: 30px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">×</button>
                    
                    <h3 style="
                        margin: 0 0 20px 0;
                        color: white;
                        text-align: center;
                        font-size: 1.5em;
                    ">${titleText}</h3>
                    
                    <form id="fxPortfolioForm">
                        <div style="margin-bottom: 15px;">
                            <label style="
                                display: block;
                                color: #b0b3c6;
                                margin-bottom: 5px;
                                font-size: 14px;
                            ">${lblType}</label>
                            <input type="text" id="fxSymbol" value="${fxName}" readonly style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #444;
                                border-radius: 8px;
                                background: rgba(255,255,255,0.1);
                                color: white;
                                font-size: 16px;
                                box-sizing: border-box;
                            ">
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                            <label style="
                                display: block;
                                color: #b0b3c6;
                                margin-bottom: 5px;
                                font-size: 14px;
                            ">${lblQty}</label>
                            <input type="number" id="fxQuantity" step="0.01" min="0.01" required style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #444;
                                border-radius: 8px;
                                background: rgba(255,255,255,0.1);
                                color: white;
                                font-size: 16px;
                                box-sizing: border-box;
                            " placeholder="${phQty}">
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="
                                display: block;
                                color: #b0b3c6;
                                margin-bottom: 5px;
                                font-size: 14px;
                            ">${lblPrice}</label>
                            <input type="number" id="fxPrice" step="0.0001" min="0.0001" required style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #444;
                                border-radius: 8px;
                                background: rgba(255,255,255,0.1);
                                color: white;
                                font-size: 16px;
                                box-sizing: border-box;
                            " placeholder="${phPrice}">
                        </div>
                        
                        <button type="submit" style="
                            width: 100%;
                            padding: 12px;
                            background: linear-gradient(135deg, #3b82f6, #22c55e);
                            border: none;
                            border-radius: 8px;
                            color: white;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                        ">${submitText}</button>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close button event
        const closeBtn = document.getElementById('closeFxPortfolioModalBtn');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.remove();
            };
        }
        
        // Form submission
        const form = document.getElementById('fxPortfolioForm');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                
                const symbol = document.getElementById('fxSymbol').value;
                const quantity = document.getElementById('fxQuantity').value;
                const price = document.getElementById('fxPrice').value;
                
                // Validation
                const errors = validateFxData(symbol, quantity, price);
                if (errors.length > 0) {
                    showErrorMessage(errors.join(', '));
                    return;
                }
                
                // Add to portfolio
                const success = await addFxToPortfolio(symbol, quantity, price);
                if (success) {
                    modal.remove();
                    // Refresh portfolio table
                    if (window.renderFxPortfolioTable) {
                        window.renderFxPortfolioTable();
                    }
                }
            };
        }
        
        // Close on outside click
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };
        
    } catch (error) {
        console.error('FX Portfolio modal error:', error);
        showErrorMessage('Modal açılırken hata oluştu');
    }
}

// NOTE: FX portfolio backend operations (fetch/add/delete) live in
// js/portfolio-crud.js and js/fx-portfolio.js. Duplicate copies that used to
// live here were never called and have been removed.

export function initFx() {
    try {
        // Initial FX data fetch (renders the currency table once on boot/login).
        fetchCurrencyData();

        // Periodic FX updates are driven by the single master refresh loop in
        // app.js (refreshData → updateCurrencyDisplay). We intentionally do NOT
        // start a separate setInterval here — that previously stacked a new timer
        // on every login, leaking timers and multiplying /api/stocks/fx calls.
        if (fxAutoRefreshInterval) {
            clearInterval(fxAutoRefreshInterval);
            fxAutoRefreshInterval = null;
        }

        // Global helpers for manual refresh
        window.refreshFxData = () => fetchCurrencyData(0, true);
        window.clearFxCache = clearFxCache;

        console.log('FX module initialized successfully');
    } catch (error) {
        console.error('FX initialization error:', error);
        showErrorMessage('FX modülü başlatılırken hata oluştu');
    }
}

 