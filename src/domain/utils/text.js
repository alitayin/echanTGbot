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

module.exports = {
    escapeRegex,
    matchesAnyKeywordWordBoundary,
};


