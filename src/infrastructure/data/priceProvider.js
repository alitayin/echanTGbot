const axios = require('axios');
const { CMC_API_KEY } = require('../../../config/config.js');

/** Fetch CoinGecko markets (XEC). */
async function fetchCoinGeckoMarkets() {
    const url = 'https://api.coingecko.com/api/v3/coins/markets';
    const response = await axios.get(url, {
        timeout: 10000,
        params: {
            vs_currency: 'usd',
            ids: 'ecash',
            order: 'market_cap_desc',
            per_page: 1,
            page: 1,
            sparkline: false,
            price_change_percentage: '24h'
        }
    });
    return response.data;
}

/** Fetch CoinGecko global data. */
async function fetchCoinGeckoGlobal() {
    const url = 'https://api.coingecko.com/api/v3/global';
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
}

/** Fetch XEC CMC rank (or null). */
async function fetchCMCRank() {
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest';
    try {
        const response = await axios.get(url, {
            headers: {
                'X-CMC_PRO_API_KEY': CMC_API_KEY
            },
            params: {
                start: 1,
                limit: 500,
                convert: 'USD'
            },
            timeout: 10000
        });
        const data = response.data.data;
        const xec = Array.isArray(data) ? data.find(coin => coin.symbol === 'XEC') : null;
        return xec ? xec.cmc_rank : null;
    } catch (error) {
        console.error('fetchCMCRank failed:', error.message);
        return null;
    }
}

module.exports = {
    fetchCoinGeckoMarkets,
    fetchCoinGeckoGlobal,
    fetchCMCRank
};


