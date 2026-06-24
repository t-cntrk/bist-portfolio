/**
 * ticker.js — Updates the bottom market ticker bar (USD/TRY %, BIST100 avg %).
 */

export function updateTickerUI(stocksData, fxData) {
    try {
        const usdtryElement = document.getElementById('usdtryTicker');
        const usdData = fxData.find(f => f.symbol === 'USDTRY=X');
        if (usdtryElement && usdData) {
            const changePct = usdData.regularMarketChangePercent || 0;
            usdtryElement.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
            usdtryElement.style.color = changePct >= 0 ? '#22c55e' : '#ef4444';
        }

        const bist100Element = document.getElementById('bist100Ticker');
        if (bist100Element) {
            // Prefer the real BIST100 index (^XU100); fall back to average of tracked stocks
            const xu100 = fxData.find(f => f.symbol === '^XU100');
            let changePct;
            if (xu100 && typeof xu100.regularMarketChangePercent === 'number') {
                changePct = xu100.regularMarketChangePercent;
            } else if (stocksData.length > 0) {
                changePct = stocksData.reduce((sum, s) => sum + (s.regularMarketChangePercent || 0), 0) / stocksData.length;
            }
            if (changePct !== undefined) {
                bist100Element.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
                bist100Element.style.color = changePct >= 0 ? '#22c55e' : '#ef4444';
            }
        }

        const goldElement = document.getElementById('goldTicker');
        const goldData = fxData.find(f => f.symbol === 'GC=F');
        if (goldElement && goldData) {
            const changePct = goldData.regularMarketChangePercent || 0;
            goldElement.textContent = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`;
            goldElement.style.color = changePct >= 0 ? '#22c55e' : '#ef4444';
        }

        console.log('✅ Alt bar (Ticker) güncellendi.');
    } catch (error) {
        console.warn('Ticker güncellenirken hata:', error);
    }
}
