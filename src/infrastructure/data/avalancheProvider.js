const axios = require('axios');

/** Fetch Avalanche summary. */
async function fetchAvalancheSummary() {
    const url = 'https://avalanche.cash/api/avalanche/summary';
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
}

/** Fetch Avalanche APY. */
async function fetchAvalancheAPY() {
    const url = 'https://avalanche.cash/api/apy/XEC';
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
}

/** Fetch XEC simple price (CoinGecko). */
async function fetchXecSimplePrice() {
    const url = 'https://api.coingecko.com/api/v3/simple/price';
    const response = await axios.get(url, {
        timeout: 10000,
        params: { ids: 'ecash', vs_currencies: 'usd' }
    });
    return response.data;
}

module.exports = {
    fetchAvalancheSummary,
    fetchAvalancheAPY,
    fetchXecSimplePrice
};


