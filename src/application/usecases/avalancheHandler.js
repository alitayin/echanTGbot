const { fetchAvalancheSummary, fetchAvalancheAPY, fetchXecSimplePrice } = require('../../infrastructure/data/avalancheProvider.js');

/** Get eCash Avalanche network data. */
async function getAvalancheData() {
    try {
        const [summaryData, apyData, priceData] = await Promise.all([
            fetchAvalancheSummary(),
            fetchAvalancheAPY(),
            fetchXecSimplePrice()
        ]);

        // Get XEC price
        const xecPrice = priceData.ecash?.usd || 0;
        
        // Compute total staked value
        const totalStakedValue = summaryData.totalStake * xecPrice;

        return {
            totalStake: summaryData.totalStake,
            nodeCount: summaryData.nodeCount,
            proofCount: summaryData.proofCount,
            apy: apyData.apy,
            xecPrice: xecPrice,
            totalStakedValue: totalStakedValue,
            timeStamp: summaryData.timeStamp,
            date: summaryData.date
        };
    } catch (error) {
        console.error('获取Avalanche数据失败:', error.message);
        throw error;
    }
}

// Rendering is done in presentation layer; this use case returns DTO only

/** Main handler for avalanche command. */
async function handleAvalancheCommand() {
    try {
        const avalancheData = await getAvalancheData();
        return avalancheData;
    } catch (error) {
        console.error('处理Avalanche命令失败:', error.message);
        throw error;
    }
}

module.exports = {
    getAvalancheData,
    // Rendering is in presentation/views
    handleAvalancheCommand
}; 