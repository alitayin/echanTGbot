const { formatPrice, formatPercentage, formatLargeNumber } = require('../../domain/formatting/numberFormat.js');

/** Render price message. */
function renderPriceMessage(priceData) {
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

Current Price: $${formatPrice(currentPrice)}
Price Change (%) 1h: ${formatPercentage(priceChange1h)}
Price Change (%) 24h: ${formatPercentage(priceChange24h)}
Market Cap: ${formatLargeNumber(marketCap)}
Volume 24h: ${formatLargeNumber(volume24h)}
CMC Rank: ${cmcRank ? cmcRank : 'N/A'}

💵 Total Crypto Market Cap: ${formatLargeNumber(totalCryptoMarketCap)}`;
}

module.exports = { renderPriceMessage };


