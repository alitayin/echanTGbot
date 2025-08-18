const EchanApiClient = require('./echanApi.js');
const { 
    API_ENDPOINT,
    ADDITIONAL_API_KEY,
    ADDITIONAL_API_KEY_BACKUP
} = require('../../../config/config.js');

/**
 * Get message analysis.
 * @param {string} query
 * @param {string|number} userId
 * @returns {Promise<Object|null>}
 */
async function fetchMessageAnalysis(query, userId) {
    const maxRetries = 3;
    let attempt = 0;
    let totalAttempts = 0;
    const maxTotalAttempts = 6;
    let currentKey = ADDITIONAL_API_KEY;

    const primaryClient = new EchanApiClient(ADDITIONAL_API_KEY, API_ENDPOINT);
    const backupClient = new EchanApiClient(ADDITIONAL_API_KEY_BACKUP, API_ENDPOINT);

    while (attempt < maxRetries && totalAttempts < maxTotalAttempts) {
        try {
            attempt++;
            totalAttempts++;

            const client = currentKey === ADDITIONAL_API_KEY ? primaryClient : backupClient;
            const data = await client.sendTextRequest(query, userId);
            const answer = JSON.parse(data.answer);
            console.log(`✅ 消息分析成功 (尝试 ${totalAttempts}/${maxTotalAttempts})`);
            return answer;

        } catch (error) {
            if (error.response?.status === 400) {
                console.log(`Message analysis failed, attempt ${totalAttempts}/${maxTotalAttempts}`);
            } else {
                console.error(`❌ 消息分析数据获取失败 (尝试 ${totalAttempts}/${maxTotalAttempts}):`, error.message || error);
            }

            // Switch to backup key if primary exhausted or 400
            if ((error.response?.status === 400 || attempt === maxRetries) &&
                currentKey === ADDITIONAL_API_KEY &&
                totalAttempts < maxTotalAttempts) {
                currentKey = ADDITIONAL_API_KEY_BACKUP;
                attempt = 0; // reset per-key retries
                console.log('🔄 切换到备用消息分析API密钥');
            } else if (totalAttempts >= maxTotalAttempts) {
                console.log('⚠️ 达到最大总尝试次数，停止重试');
                break;
            }
        }
    }
    
    console.log('❌ 消息分析失败，返回null');
    return null;
}

/**
 * Batch analyze messages.
 * @param {{query:string,userId:string|number}[]} messages
 * @returns {Promise<Array>}
 */
async function batchMessageAnalysis(messages) {
    const results = [];
    
    for (const message of messages) {
        try {
            const result = await fetchMessageAnalysis(message.query, message.userId);
            results.push({
                ...message,
                analysis: result
            });
        } catch (error) {
            console.error(`批量分析失败 - 消息: ${message.query.substring(0, 50)}...`, error.message);
            results.push({
                ...message,
                analysis: null,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * Check if a message needs response.
 * @param {string} query
 * @param {string|number} userId
 * @returns {Promise<boolean>}
 */
async function checkNeedsResponse(query, userId) {
    try {
        const analysis = await fetchMessageAnalysis(query, userId);
        return analysis?.needs_response === true;
    } catch (error) {
        console.error('检查是否需要响应失败:', error.message);
        return false;
    }
}

module.exports = {
    fetchMessageAnalysis,
    batchMessageAnalysis,
    checkNeedsResponse
}; 
