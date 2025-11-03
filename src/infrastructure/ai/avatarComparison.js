// Avatar comparison via AI API
// Infrastructure layer module

const axios = require("axios");
const { SECONDARY_SPAM_API_KEY, API_ENDPOINT } = require('../../../config/config.js');

/**
 * Compare two avatars via API
 * @param {string} avatarUrl1 - First avatar URL
 * @param {string} avatarUrl2 - Second avatar URL
 * @param {number} userId - User ID for API tracking
 * @returns {Promise<boolean>} True if avatars are similar (same person)
 */
async function compareAvatars(avatarUrl1, avatarUrl2, userId) {
    try {
        const response = await axios.post(API_ENDPOINT, {
            inputs: {},
            files: [
                {
                    "type": "image",
                    "transfer_method": "remote_url",
                    "url": avatarUrl1
                },
                {
                    "type": "image", 
                    "transfer_method": "remote_url",
                    "url": avatarUrl2
                }
            ],
            query: "is that same?",
            response_mode: "blocking",
            user: String(userId),
        }, {
            headers: {
                Authorization: `Bearer ${SECONDARY_SPAM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30 * 1000,
        });

        const result = JSON.parse(response.data.answer);
        return result.spam === false && result.similar_avatar === true;
    } catch (error) {
        console.error('Avatar comparison API call failed:', error.message);
        return false;
    }
}

module.exports = {
    compareAvatars
};


