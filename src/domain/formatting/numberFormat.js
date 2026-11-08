/** Minimal numeric formatting helpers. */

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function formatPrice(price) {
    if (!isFiniteNumber(price)) return '0.0000';
    const value = price < 0.01 ? price.toFixed(8) : price.toFixed(4);
    return value;
}

function formatPercentage(percentage) {
    if (!isFiniteNumber(percentage)) return '0.00%';
    return `${percentage.toFixed(2)}%`;
}

function formatLargeNumber(num) {
    if (!isFiniteNumber(num)) return '$0';
    const sign = num < 0 ? '-' : '';
    const absolute = Math.abs(num);
    if (absolute >= 1e12) return `${sign}$${(absolute / 1e12).toFixed(2)}T`;
    if (absolute >= 1e9) return `${sign}$${(absolute / 1e9).toFixed(1)}B`;
    if (absolute >= 1e6) return `${sign}$${(absolute / 1e6).toFixed(1)}M`;
    if (absolute >= 1e3) return `${sign}$${(absolute / 1e3).toFixed(1)}K`;
    return `${sign}$${absolute.toFixed(0)}`;
}

function formatStake(stake) {
    if (!isFiniteNumber(stake)) return '0';
    if (stake >= 1e12) return `${(stake / 1e12).toFixed(0)}T`;
    if (stake >= 1e9) return `${(stake / 1e9).toFixed(0)}B`;
    if (stake >= 1e6) return `${(stake / 1e6).toFixed(0)}M`;
    if (stake >= 1e3) return `${(stake / 1e3).toFixed(0)}K`;
    return stake.toFixed(0);
}

function formatCurrencyValue(value) {
    if (!isFiniteNumber(value)) return '$0';
    const sign = value < 0 ? '-' : '';
    const absolute = Math.abs(value);
    if (absolute >= 1e9) return `${sign}$${(absolute / 1e9).toFixed(1)}B`;
    if (absolute >= 1e6) return `${sign}$${(absolute / 1e6).toFixed(1)}M`;
    if (absolute >= 1e3) return `${sign}$${(absolute / 1e3).toFixed(1)}K`;
    return `${sign}$${absolute.toFixed(0)}`;
}

module.exports = {
    formatPrice,
    formatPercentage,
    formatLargeNumber,
    formatStake,
    formatCurrencyValue,
};


