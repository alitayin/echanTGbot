const { formatStake, formatCurrencyValue } = require('../../domain/formatting/numberFormat.js');

function formatCount(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString('en-US') : 'N/A';
}

/** Render avalanche message. */
function renderAvalancheMessage(avalancheData) {
    if (!avalancheData || typeof avalancheData !== 'object') {
        return 'Avalanche data unavailable.';
    }

    const {
        totalStake,
        nodeCount,
        proofCount,
        apy,
        totalStakedValue
    } = avalancheData;
    const stake = Number.isFinite(totalStake) ? `${formatStake(totalStake)} XEC` : 'N/A';
    const apyText = Number.isFinite(apy) && Number.isFinite(apy * 100) ? `${(apy * 100).toFixed(1)}%` : 'N/A';
    const value = Number.isFinite(totalStakedValue) ? formatCurrencyValue(totalStakedValue) : 'N/A';

    return `🗻 eCash Avalanche Network Update

Total Staked: ${stake}
Current APY: ${apyText}
Total Staked Value: ${value}
Number of Peers: ${formatCount(proofCount)}
Number of Nodes: ${formatCount(nodeCount)}

🔗 Avalanche.cash`;
}

module.exports = { renderAvalancheMessage };


