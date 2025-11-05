const getData = require('../../infrastructure/data/data.js');
const { withTimeout } = require('../../domain/utils/async.js');
const { wrapInContext } = require('../../domain/formatting/context.js');

async function fetchExternalDataViaPort(ports, query, userId, timeout = 60000) {
    try {
        console.log('Calling external API for latest data');
        
        const getExternalData = async () => {
            const externalResponse = await ports.chat.sendStreamingText(query, userId);
            return externalResponse.answer;
        };

        const externalData = await withTimeout(getExternalData, timeout, 'External API Timeout');
        
        if (externalData && externalData.trim()) {
            console.log('External API data received, length:', externalData.length);
            return externalData;
        } else {
            console.log('External API returned empty data');
            return null;
        }
    } catch (error) {
        console.log('External API call failed or timeout:', error.message);
        
        if (error.response) {
            console.log('Error details:');
            console.log('- Status:', error.response.status);
            console.log('- Headers:', JSON.stringify(error.response.headers, null, 2));
            console.log('- Body:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.log('Request error details:', error.request);
        } else {
            console.log('Other error details:', error.message);
        }
        
        return null;
    }
}

async function processExternalData(query, analysis, userId, ports) {
    if (analysis && (analysis.needs_tool === true || analysis.wants_latest_data === true)) {
        const externalData = await fetchExternalDataViaPort(ports, query, userId);
        
        if (externalData) {
            const wrappedExternalData = wrapInContext('External Tool Data', externalData);
            query = `${wrappedExternalData}\n\n${query}`;
            console.log('External data added to query');
        }
    }
    
    return query;
}

async function prepareConversationQuery(ports, query, userId, skipNeedsResponseCheck = false) {
    const getAnalysis = async () => {
        const analysis = await ports.analysis.analyzeMessage(query, userId);
        if (!analysis || analysis.needs_response === undefined) {
            throw new Error('Invalid analysis result');
        }
        return analysis;
    };

    try {
        const analysisResult = await withTimeout(getAnalysis, 5000, 'Timeout');
        
        // Only check needs_response if not skipped (for direct @ mentions)
        if (!skipNeedsResponseCheck && !analysisResult.needs_response) {
            console.log('✋ needs_response is false, skipping response');
            return { shouldRespond: false, query };
        }
        
        const enriched = await processExternalData(query, analysisResult, userId, ports);
        return { shouldRespond: true, query: enriched };
    } catch (error) {
        console.error('⚠️ Analysis error, defaulting to respond:', error.message);
        return { shouldRespond: true, query };
    }
}

async function injectNetworkDataIfKeyword(query, dataKeywords = [], timeoutMs = 3000) {
    const { matchesAnyKeywordWordBoundary } = require('../../domain/utils/text.js');
    const containsDataKeyword = matchesAnyKeywordWordBoundary(query, dataKeywords);
    if (!containsDataKeyword) {
        return query;
    }

    try {
        const latestData = await withTimeout(getData, timeoutMs, 'Timeout');
        if (latestData) {
            const dataContent = [
                `- Total Staked: ${latestData.totalStakedAmount} XEC`,
                `- Staking APY: ${latestData.StakingAPY.toFixed(2)}%`,
                `- 24h Volume: $${latestData.volume24h}`,
                `- XEC Price: $${latestData.LastesteCashPrice}`,
                `- 24h Transactions: ${latestData.transactions24h}`,
                `- Current Block Height: ${latestData.blocks}`
            ].join('\n');
            const dataString = wrapInContext('Network Data', dataContent);
            return `${dataString}\n\n${query}`;
        }
    } catch (error) {
    }
    return query;
}

module.exports = {
    fetchExternalDataViaPort,
    processExternalData,
    prepareConversationQuery,
    injectNetworkDataIfKeyword
};

