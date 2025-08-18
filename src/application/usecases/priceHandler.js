const { fetchCoinGeckoMarkets, fetchCoinGeckoGlobal, fetchCMCRank } = require('../../infrastructure/data/priceProvider.js');

/** Get eCash (XEC) price data via free APIs. */
async function getXECPriceData() {
    return await getFallbackPriceData();
}

// CMC rank retrieval lives in infrastructure/data/priceProvider.js

/** Fallback: use CoinGecko APIs. */
async function getFallbackPriceData() {
    try {
        const [marketsData, globalData, cmcRank] = await Promise.all([
            fetchCoinGeckoMarkets(),
            fetchCoinGeckoGlobal(),
            fetchCMCRank()
        ]);

        const coinData = Array.isArray(marketsData) ? marketsData[0] : null;

        if (!coinData) {
            console.error('Fallback API返回数据为空:', marketsResponse.data);
            throw new Error('eCash data not found in fallback API');
        }
        if (!globalData || !globalData.data || !globalData.data.total_market_cap) {
            console.error('Fallback API global数据异常:', globalData);
        }

        return {
            currentPrice: coinData.current_price,
            priceChange1h: 0, // free API has no 1h
            priceChange24h: coinData.price_change_percentage_24h || 0,
            marketCap: coinData.market_cap,
            volume24h: coinData.total_volume,
            cmcRank: cmcRank,
            totalCryptoMarketCap: globalData.data.total_market_cap.usd
        };
    } catch (error) {
        console.error('免费API获取失败:', error.message);
        throw error;
    }
}

// Rendering is done in presentation layer; this use case returns DTO only

/** Main handler for price command. */
async function handlePriceCommand() {
    try {
        const priceData = await getXECPriceData();
        return priceData;
    } catch (error) {
        console.error('处理价格命令失败:', error.message);
        throw error;
    }
}

module.exports = {
    getXECPriceData,
    getFallbackPriceData,
    // Rendering is in presentation/views
    handlePriceCommand
}; 