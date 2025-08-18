/** Minimal numeric formatting helpers. */

function formatPrice(price) {
    if (typeof price !== 'number' || Number.isNaN(price)) return '$0.0000';
    const value = price < 0.01 ? price.toFixed(8) : price.toFixed(4);
    return value;
}

function formatPercentage(percentage) {
    if (typeof percentage !== 'number' || Number.isNaN(percentage)) return '0.00%';
    const sign = percentage >= 0 ? '' : '';
    return `${sign}${percentage.toFixed(2)}%`;
}

function formatLargeNumber(num) {
    if (typeof num !== 'number' || Number.isNaN(num)) return '$0';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
}

function formatStake(stake) {
    if (typeof stake !== 'number' || Number.isNaN(stake)) return '0';
    if (stake >= 1e12) return `${(stake / 1e12).toFixed(0)}T`;
    if (stake >= 1e9) return `${(stake / 1e9).toFixed(0)}B`;
    if (stake >= 1e6) return `${(stake / 1e6).toFixed(0)}M`;
    if (stake >= 1e3) return `${(stake / 1e3).toFixed(0)}K`;
    return stake.toFixed(0);
}

function formatCurrencyValue(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '$0';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
}

module.exports = {
    formatPrice,
    formatPercentage,
    formatLargeNumber,
    formatStake,
    formatCurrencyValue,
};


