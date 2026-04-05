/** Escape regex special chars. */
function escapeRegex(input) {
    return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word keyword match (case-insensitive).
 * @param {string} text
 * @param {string[]} keywords
 * @returns {boolean}
 */
function matchesAnyKeywordWordBoundary(text, keywords) {
    const source = String(text || '');
    const list = Array.isArray(keywords) ? keywords : [];
    return list.some((kw) => {
        const pattern = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'i');
        return pattern.test(source);
    });
}

/** Simple English word stemmer (strips common suffixes). */
function simpleStem(word) {
    if (word.length <= 3) return word;
    if (word.endsWith('ing') && word.length > 4) return word.slice(0, -3);
    if (word.endsWith('ed') && word.length > 3) return word.slice(0, -2);
    if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
    if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
    return word;
}

/** Strip emoji characters to avoid inflating non-ASCII ratio. */
function stripEmoji(text = '') {
    const emojiRegex = /[\u{1F1E6}-\u{1F1FF}|\u{1F300}-\u{1F5FF}|\u{1F600}-\u{1F64F}|\u{1F680}-\u{1F6FF}|\u{1F700}-\u{1F77F}|\u{1F780}-\u{1F7FF}|\u{1F800}-\u{1F8FF}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FA6F}|\u{1FA70}-\u{1FAFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu;
    return text.replace(emojiRegex, '');
}

/** Get the display name for a Telegram user object. */
function getUserDisplayName(user) {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.username || '';
}

/** Extract a username from text (strips leading @). */
function extractUsername(text) {
    const match = text.match(/@?(\w+)/);
    return match ? match[1] : null;
}

/**
 * Extract combined text content from a Telegram message for similarity caching.
 * Includes main text/caption and quoted text when present.
 */
function getTextContent(msg) {
    const text = (msg?.text || '').trim();
    const caption = (msg?.caption || '').trim();
    const main = text || caption || '';
    const quoteText = (msg?.quote?.text || msg?.quote?.caption || '').trim();
    if (quoteText && main) {
        return `[Quoted]: ${quoteText}\n\n${main}`;
    }
    if (quoteText) {
        return `[Quoted]: ${quoteText}`;
    }
    return main;
}

/**
 * Truncate text to a maximum length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @param {string} suffix - Suffix to append when truncated (default: '...')
 * @returns {string} Truncated text
 */
function truncate(text, maxLength, suffix = '...') {
    const str = String(text || '');
    return str.length > maxLength ? str.substring(0, maxLength) + suffix : str;
}

module.exports = {
    escapeRegex,
    matchesAnyKeywordWordBoundary,
    simpleStem,
    stripEmoji,
    getUserDisplayName,
    extractUsername,
    getTextContent,
    truncate,
};


