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
        if (bist100Element && stocksData.length > 0) {
            const avgChange = stocksData.reduce((sum, s) => sum + (s.regularMarketChangePercent || 0), 0) / stocksData.length;
            bist100Element.textContent = `${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%`;
            bist100Element.style.color = avgChange >= 0 ? '#22c55e' : '#ef4444';
        }

        console.log('✅ Alt bar (Ticker) güncellendi.');
    } catch (error) {
        console.warn('Ticker güncellenirken hata:', error);
    }
}
