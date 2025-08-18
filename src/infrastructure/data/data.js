const axios = require('axios');

async function getData() {
    // Request data
    const responseStake = await axios.get('https://avalanche.cash/api/avalanche/network');
    const dataStake = responseStake.data;

    // Ensure nodes exist
    if (!Array.isArray(dataStake.nodes) || !dataStake.nodes.length) {
        console.log('No data received from avalanche network');
        return;
    }

    // Sum stake amounts
    const stakeSum = dataStake.nodes
        .filter(node => node.type === 'stake')
        .reduce((sum, node) => sum + node.amount, 0);

    // Compute APY (rough)
    const totalSupply = 32850000000;
    const APY = (totalSupply / stakeSum) * 50;

    // Get data from Blockchair
    const responseBlock = await axios.get('https://api.blockchair.com/ecash/stats');
    const dataBlock = responseBlock.data;

    if (!dataBlock.data) {
        console.log('No data received from Blockchair');
        return;
    }

    const currentTime = new Date();
    const currentBlock = dataBlock.data.blocks;

    return {
        currentTime: currentTime.toISOString(),
        totalStakedAmount: stakeSum,
        StakingAPY: APY,
        blocks: currentBlock,
        transactions24h: dataBlock.data.transactions_24h,
        LastesteCashPrice: dataBlock.data.market_price_usd,
        volume24h: dataBlock.data.volume_24h
    };
}

module.exports = getData;
