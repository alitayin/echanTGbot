const { formatPrice, formatPercentage, formatLargeNumber } = require('../../domain/formatting/numberFormat.js');

function formatMetric(value, formatter) {
    return typeof value === 'number' && Number.isFinite(value)
        ? formatter(value)
        : 'N/A';
}

function formatRank(rank) {
    return Number.isInteger(rank) && rank > 0 ? String(rank) : 'N/A';
}

/** Render price message. */
function renderPriceMessage(priceData) {
    if (!priceData || typeof priceData !== 'object' || Array.isArray(priceData)) {
        return 'Price data unavailable. Please try again in a moment.';
    }
    const {
        currentPrice,
        priceChange1h,
        priceChange24h,
        marketCap,
        volume24h,
        cmcRank,
        totalCryptoMarketCap
    } = priceData;

    return `📈 eCash (XEC) Price Update

Current Price: ${formatMetric(currentPrice, value => `$${formatPrice(value)}`)}
Price Change (%) 1h: ${formatMetric(priceChange1h, formatPercentage)}
Price Change (%) 24h: ${formatMetric(priceChange24h, formatPercentage)}
Market Cap: ${formatMetric(marketCap, formatLargeNumber)}
Volume 24h: ${formatMetric(volume24h, formatLargeNumber)}
CMC Rank: ${formatRank(cmcRank)}

💵 Total Crypto Market Cap: ${formatMetric(totalCryptoMarketCap, formatLargeNumber)}`;
}

module.exports = { renderPriceMessage };


