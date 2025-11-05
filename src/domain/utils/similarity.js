/**
 * Tokenize text into words/terms
 * @param {string} text - The text to tokenize
 * @returns {string[]} Array of tokens
 */
function tokenize(text) {
    // Split by whitespace and punctuation, filter out empty strings
    return text.toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fa5]/g, ' ') // Keep alphanumeric and Chinese characters
        .split(/\s+/)
        .filter(word => word.length > 0);
}

/**
 * Create term frequency vector from tokens
 * @param {string[]} tokens - Array of tokens
 * @returns {Object} Term frequency vector
 */
function createTermFrequencyVector(tokens) {
    const vector = {};
    for (const token of tokens) {
        vector[token] = (vector[token] || 0) + 1;
    }
    return vector;
}

/**
 * Calculate cosine similarity between two term frequency vectors
 * @param {Object} vector1 - First term frequency vector
 * @param {Object} vector2 - Second term frequency vector
 * @returns {number} Cosine similarity (0-1)
 */
function cosineSimilarity(vector1, vector2) {
    // Get all unique terms from both vectors
    const allTerms = new Set([...Object.keys(vector1), ...Object.keys(vector2)]);
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (const term of allTerms) {
        const val1 = vector1[term] || 0;
        const val2 = vector2[term] || 0;
        
        dotProduct += val1 * val2;
        magnitude1 += val1 * val1;
        magnitude2 += val2 * val2;
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    // Avoid division by zero
    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate similarity percentage between two strings using cosine similarity
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity percentage (0-100)
 */
function calculateTextSimilarity(str1, str2) {
    // Normalize strings: trim
    const normalizedStr1 = str1.trim();
    const normalizedStr2 = str2.trim();

    // Handle edge cases
    if (normalizedStr1 === normalizedStr2) {
        return 100;
    }
    if (!normalizedStr1 || !normalizedStr2) {
        return 0;
    }

    // Tokenize both strings
    const tokens1 = tokenize(normalizedStr1);
    const tokens2 = tokenize(normalizedStr2);
    
    // Handle empty token lists
    if (tokens1.length === 0 || tokens2.length === 0) {
        return 0;
    }
    
    // Create term frequency vectors
    const vector1 = createTermFrequencyVector(tokens1);
    const vector2 = createTermFrequencyVector(tokens2);
    
    // Calculate cosine similarity and convert to percentage
    const similarity = cosineSimilarity(vector1, vector2);
    
    return similarity * 100;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Edit distance (number of edits needed)
 */
function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[len1][len2];
}

/**
 * Calculate similarity percentage based on Levenshtein distance
 * Good for single word/short string spelling correction
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity percentage (0-100)
 */
function calculateStringSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 100;
    
    const distance = levenshteinDistance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    
    if (maxLen === 0) return 100;
    
    const similarity = ((maxLen - distance) / maxLen) * 100;
    return similarity;
}

module.exports = {
    calculateTextSimilarity,
    calculateStringSimilarity,
    levenshteinDistance,
    tokenize,
    createTermFrequencyVector,
    cosineSimilarity,
};

