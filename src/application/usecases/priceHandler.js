const { fetchCoinGeckoMarkets, fetchCoinGeckoGlobal, fetchCMCRank } = require('../../infrastructure/data/priceProvider.js');

function availableAmount(value) {
    return Number.isFinite(value) && value >= 0 ? value : null;
}

async function getXECPriceData() {
    return await getFallbackPriceData();
}

async function getFallbackPriceData() {
    try {
        const [marketsResult, globalResult, rankResult] = await Promise.allSettled([
            fetchCoinGeckoMarkets(),
            fetchCoinGeckoGlobal(),
            fetchCMCRank()
        ]);

        if (marketsResult.status === 'rejected') {
            throw marketsResult.reason;
        }

        const marketsData = marketsResult.value;
        const globalData = globalResult.status === 'fulfilled' ? globalResult.value : null;
        const cmcRank = rankResult.status === 'fulfilled' ? rankResult.value : null;

        if (globalResult.status === 'rejected') {
            console.error('Fallback API global data request failed:', globalResult.reason?.message || globalResult.reason);
        }
        if (rankResult.status === 'rejected') {
            console.error('CMC rank request failed:', rankResult.reason?.message || rankResult.reason);
        }

        const coinData = Array.isArray(marketsData) ? marketsData[0] : null;

        if (!coinData || typeof coinData !== 'object' || Array.isArray(coinData)) {
            console.error('Fallback API returned empty data:', marketsData);
            throw new Error('eCash data not found in fallback API');
        }
        if (globalResult.status === 'fulfilled' && !Number.isFinite(globalData?.data?.total_market_cap?.usd)) {
            console.error('Fallback API global data error:', globalData);
        }

        return {
            currentPrice: availableAmount(coinData.current_price),
            priceChange1h: Number.isFinite(coinData.price_change_percentage_1h_in_currency)
                ? coinData.price_change_percentage_1h_in_currency
                : null,
            priceChange24h: Number.isFinite(coinData.price_change_percentage_24h)
                ? coinData.price_change_percentage_24h
                : null,
            marketCap: availableAmount(coinData.market_cap),
            volume24h: availableAmount(coinData.total_volume),
            cmcRank: cmcRank,
            totalCryptoMarketCap: availableAmount(globalData?.data?.total_market_cap?.usd)
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
