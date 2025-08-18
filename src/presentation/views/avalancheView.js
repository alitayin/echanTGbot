const { formatStake, formatCurrencyValue } = require('../../domain/formatting/numberFormat.js');

/** Render avalanche message. */
function renderAvalancheMessage(avalancheData) {
    const {
        totalStake,
        nodeCount,
        proofCount,
        apy,
        totalStakedValue
    } = avalancheData;

    return `🗻 eCash Avalanche Network Update

Total Staked: ${formatStake(totalStake)} XEC
Current APY: ${(apy * 100).toFixed(1)}%
Total Staked Value: ${formatCurrencyValue(totalStakedValue)}
Number of Peers: ${proofCount}
Number of Nodes: ${nodeCount}

🔗 Avalanche.cash`;
}

module.exports = { renderAvalancheMessage };


