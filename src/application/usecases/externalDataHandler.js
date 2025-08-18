const getData = require('../../infrastructure/data/data.js');
const { withTimeout } = require('../../domain/utils/async.js');
const { wrapInContext } = require('../../domain/formatting/context.js');

/**
 * Get external data via chat port.
 * @param {string} query
 * @param {number} userId
 * @param {number} timeout
 * @returns {Promise<string|null>}
 */
async function fetchExternalDataViaPort(ports, query, userId, timeout = 60000) {
    try {
        console.log('🔧 检测到需要外部工具或最新数据，调用外部API');
        
        const getExternalData = async () => {
            const externalResponse = await ports.chat.sendStreamingText(query, userId);
            return externalResponse.answer;
        };

        const externalData = await withTimeout(getExternalData, timeout, 'External API Timeout');
        
        if (externalData && externalData.trim()) {
            console.log('✅ 成功获取外部API数据，长度:', externalData.length);
            return externalData;
        } else {
            console.log('⚠️ 外部API返回空数据');
            return null;
        }
    } catch (error) {
        console.log('⚠️ 外部API调用失败或超时，继续处理原始请求:', error.message);
        
        // 详细错误日志
        if (error.response) {
            console.log('📋 错误详情:');
            console.log('- 状态码:', error.response.status);
            console.log('- 响应头:', JSON.stringify(error.response.headers, null, 2));
            console.log('- 响应体:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.log('📋 请求错误详情:', error.request);
        } else {
            console.log('📋 其他错误详情:', error.message);
        }
        
        return null;
    }
}

/**
 * Prepend external data to query when needed.
 * @param {string} query
 * @param {Object} analysis
 * @param {number} userId
 * @returns {Promise<string>}
 */
async function processExternalData(query, analysis, userId, ports) {
    // 检查是否需要调用外部工具或获取最新数据
    if (analysis && (analysis.needs_tool === true || analysis.wants_latest_data === true)) {
        const externalData = await fetchExternalDataViaPort(ports, query, userId);
        
        if (externalData) {
            const wrappedExternalData = wrapInContext('External Tool Data', externalData);
            query = `${wrappedExternalData}\n\n${query}`;
            console.log('🔄 已将外部数据添加到query中');
        }
    }
    
    return query;
}

/**
 * Prepare conversation query with analysis and optional external data.
 * @param {string} query
 * @param {number} userId
 * @returns {Promise<{shouldRespond:boolean, query:string}>}
 */
async function prepareConversationQuery(ports, query, userId) {
    const getAnalysis = async () => {
        const analysis = await ports.analysis.analyzeMessage(query, userId);
        if (!analysis || analysis.needs_response === undefined) {
            throw new Error('Invalid analysis result');
        }
        return analysis;
    };

    try {
        const analysisResult = await withTimeout(getAnalysis, 5000, 'Timeout');
        if (!analysisResult.needs_response) {
            return { shouldRespond: false, query };
        }
        const enriched = await processExternalData(query, analysisResult, userId, ports);
        return { shouldRespond: true, query: enriched };
    } catch (error) {
        // 分析失败或超时：默认继续处理原始查询
        return { shouldRespond: true, query };
    }
}

/**
 * Inject network data when keyword is present.
 * @param {string} query
 * @param {string[]} dataKeywords
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
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
        // 忽略超时/错误，直接返回原始query
    }
    return query;
}

module.exports = {
    fetchExternalDataViaPort,
    processExternalData,
    prepareConversationQuery,
    injectNetworkDataIfKeyword
};

