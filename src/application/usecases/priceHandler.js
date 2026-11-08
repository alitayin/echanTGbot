const { fetchCoinGeckoMarkets, fetchCoinGeckoGlobal, fetchCMCRank } = require('../../infrastructure/data/priceProvider.js');

async function getXECPriceData() {
    return await getFallbackPriceData();
}

async function getFallbackPriceData() {
    try {
        const [marketsData, globalData, cmcRank] = await Promise.all([
            fetchCoinGeckoMarkets(),
            fetchCoinGeckoGlobal(),
            fetchCMCRank()
        ]);

        const coinData = Array.isArray(marketsData) ? marketsData[0] : null;

        if (!coinData) {
            console.error('Fallback API returned empty data:', marketsData);
            throw new Error('eCash data not found in fallback API');
        }
        if (!globalData?.data?.total_market_cap?.usd) {
            console.error('Fallback API global data error:', globalData);
        }

        return {
            currentPrice: coinData.current_price,
            priceChange1h: null,
            priceChange24h: coinData.price_change_percentage_24h || 0,
            marketCap: coinData.market_cap,
            volume24h: coinData.total_volume,
            cmcRank: cmcRank,
            totalCryptoMarketCap: globalData?.data?.total_market_cap?.usd ?? null
        };
    } catch (error) {
        console.error('Failed to fetch price data:', error.message);
        throw error;
    }
}

async function handlePriceCommand() {
    try {
        const priceData = await getXECPriceData();
        return priceData;
    } catch (error) {
        console.error('Failed to handle price command:', error.message);
        throw error;
    }
}

module.exports = {
    getXECPriceData,
    getFallbackPriceData,
    handlePriceCommand
};
