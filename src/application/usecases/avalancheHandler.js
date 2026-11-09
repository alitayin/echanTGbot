const { fetchAvalancheSummary, fetchAvalancheAPY, fetchXecSimplePrice } = require('../../infrastructure/data/avalancheProvider.js');

async function getAvalancheData() {
    try {
        const [summaryResult, apyResult, priceResult] = await Promise.allSettled([
            fetchAvalancheSummary(),
            fetchAvalancheAPY(),
            fetchXecSimplePrice()
        ]);

        if (summaryResult.status === 'rejected') {
            throw summaryResult.reason;
        }
        const summaryData = summaryResult.value;
        if (!summaryData || typeof summaryData !== 'object' || Array.isArray(summaryData)) {
            throw new Error('Avalanche summary data is unavailable');
        }
        const apyData = apyResult.status === 'fulfilled' ? apyResult.value : null;
        const priceData = priceResult.status === 'fulfilled' ? priceResult.value : null;

        if (apyResult.status === 'rejected') {
            console.error('Avalanche APY request failed:', apyResult.reason?.message || apyResult.reason);
        }
        if (priceResult.status === 'rejected') {
            console.error('Avalanche price request failed:', priceResult.reason?.message || priceResult.reason);
        }

        const reportedXecPrice = priceData?.ecash?.usd;
        const xecPrice = Number.isFinite(reportedXecPrice) && reportedXecPrice >= 0 ? reportedXecPrice : null;
        const totalStake = Number.isFinite(summaryData.totalStake) && summaryData.totalStake >= 0
            ? summaryData.totalStake : null;
        const computedValue = totalStake !== null && xecPrice !== null
            ? totalStake * xecPrice
            : null;
        const totalStakedValue = Number.isFinite(computedValue) ? computedValue : null;

        return {
            totalStake,
            nodeCount: summaryData.nodeCount,
            proofCount: summaryData.proofCount,
            apy: apyData?.apy ?? null,
            xecPrice: xecPrice,
            totalStakedValue: totalStakedValue,
            timeStamp: summaryData.timeStamp,
            date: summaryData.date
        };
    } catch (error) {
        console.error('Failed to fetch Avalanche data:', error.message);
        throw error;
    }
}

async function handleAvalancheCommand() {
    try {
        const avalancheData = await getAvalancheData();
        return avalancheData;
    } catch (error) {
        console.error('Failed to handle Avalanche command:', error.message);
        throw error;
    }
}

module.exports = {
    getAvalancheData,
    handleAvalancheCommand
};
