const EchanApiClient = require('./echanApi.js');
const { withKeyRotation } = require('./withKeyRotation.js');
const {
    API_ENDPOINT,
    ADDITIONAL_API_KEY,
    ADDITIONAL_API_KEY_BACKUP
} = require('../../../config/config.js');

function makeClients() {
    return [
        new EchanApiClient(ADDITIONAL_API_KEY, API_ENDPOINT),
        new EchanApiClient(ADDITIONAL_API_KEY_BACKUP, API_ENDPOINT),
    ];
}

const CLIENTS = makeClients();

/**
 * Get message analysis.
 * @param {string} query
 * @param {string|number} userId
 * @returns {Promise<Object|null>}
 */
async function fetchMessageAnalysis(query, userId) {
    try {
        const answer = await withKeyRotation(
            CLIENTS,
            async (client) => {
                const data = await client.sendTextRequest(query, userId);
                try {
                    return JSON.parse(data.answer);
                } catch {
                    throw new Error('Invalid JSON: ' + String(data.answer).slice(0, 80));
                }
            }
        );
        console.log('Message analysis successful');
        return answer;
    } catch (error) {
        console.warn('Message analysis failed, returning null', error.message);
        return null;
    }
}

/**
 * Get message analysis with image support.
 * @param {string} query - text content
 * @param {string|string[]} imageUrl - single image URL or array of image URLs
 * @param {string|number} userId
 * @returns {Promise<Object|null>}
 */
async function fetchMessageAnalysisWithImage(query, imageUrl, userId) {
    try {
        const answer = await withKeyRotation(
            CLIENTS,
            async (client) => {
                const data = await client.sendImageRequest(imageUrl, query, userId);
                try {
                    return JSON.parse(data.answer);
                } catch {
                    throw new Error('Invalid JSON: ' + String(data.answer).slice(0, 80));
                }
            }
        );
        console.log('Image message analysis successful');
        return answer;
    } catch (error) {
        console.warn('Image message analysis failed, returning null', error.message);
        return null;
    }
}

/**
 * Batch analyze messages.
 * @param {{query:string,userId:string|number}[]} messages
 * @returns {Promise<Array>}
 */
async function batchMessageAnalysis(messages) {
    const settled = await Promise.allSettled(
        messages.map((message) => fetchMessageAnalysis(message.query, message.userId))
    );
    return settled.map((result, i) => {
        const message = messages[i];
        if (result.status === 'fulfilled') {
            return { ...message, analysis: result.value };
        }
        console.error(`Batch analysis failed - message: ${message.query.substring(0, 50)}...`, result.reason?.message);
        return { ...message, analysis: null, error: result.reason?.message };
    });
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
        console.error('Failed to check if response needed:', error.message);
        return false;
    }
}

module.exports = {
    fetchMessageAnalysis,
    fetchMessageAnalysisWithImage,
    batchMessageAnalysis,
    checkNeedsResponse
};
