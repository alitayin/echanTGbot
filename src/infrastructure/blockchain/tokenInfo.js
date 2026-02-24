// Token information retrieval from blockchain
// Infrastructure layer module

const { ChronikClient } = require('chronik-client');
const { CHRONIK_URLS } = require('../../../config/config.js');
const TOKEN_ALIASES = require('../../../config/tokenAliases.js');

/**
 * Create Chronik client
 * @returns {ChronikClient}
 */
function createChronikClient() {
    const chronikUrl = CHRONIK_URLS[0];
    if (!chronikUrl) {
        throw new Error('CHRONIK_URLS is empty. Please set CHRONIK_URLS in environment variables.');
    }
    return new ChronikClient(chronikUrl);
}

/**
 * Resolve token alias to token ID
 * @param {string} aliasOrTokenId - Token alias or full token ID
 * @returns {string} Resolved token ID
 */
function resolveTokenAlias(aliasOrTokenId) {
    const alias = aliasOrTokenId.toLowerCase();
    if (TOKEN_ALIASES[alias]) {
        const tokenId = TOKEN_ALIASES[alias];
        console.log(`🔄 Resolved alias '${aliasOrTokenId}' to token ID: ${tokenId}`);
        return tokenId;
    }
    return aliasOrTokenId;
}

/**
 * Get token information from blockchain
 * @param {string} tokenId - Token ID
 * @returns {Promise<{decimals: number, ticker: string, name: string, protocol: string}>}
 */
async function getTokenInfo(tokenId) {
    const chronik = createChronikClient();
    
    try {
        const tokenInfo = await chronik.token(tokenId);
        
        if (tokenInfo && tokenInfo.genesisInfo) {
            const decimals = tokenInfo.genesisInfo.decimals || 0;
            const ticker = tokenInfo.genesisInfo.tokenTicker || '';
            const name = tokenInfo.genesisInfo.tokenName || 'tokens';
            
            // Determine token protocol (SLP or ALP)
            let protocol = 'SLP'; // Default
            if (tokenInfo.tokenType && tokenInfo.tokenType.protocol) {
                protocol = tokenInfo.tokenType.protocol.toUpperCase();
            }
            
            console.log(`📊 Token info: ${protocol} | ${ticker} | Decimals: ${decimals}`);
            
            return { decimals, ticker, name, protocol };
        } else {
            console.warn(`⚠️ Could not fetch token info for ${tokenId}, using defaults`);
            return { decimals: 0, ticker: '', name: 'tokens', protocol: 'SLP' };
        }
    } catch (error) {
        console.error(`❌ Error fetching token info for ${tokenId}:`, error.message);
        console.warn(`⚠️ Using defaults: SLP protocol, 0 decimals`);
        return { decimals: 0, ticker: '', name: 'tokens', protocol: 'SLP' };
    }
}

module.exports = {
    resolveTokenAlias,
    getTokenInfo
};


