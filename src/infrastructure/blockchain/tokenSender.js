// Token sending operations via ecash-quicksend
// Infrastructure layer module

const quick = require('ecash-quicksend');
const { ChronikClient } = require('chronik-client');
const { CHRONIK_URLS } = require('../../../config/config.js');

/**
 * Get mnemonic from environment
 * @returns {string|null} Mnemonic or null if not configured
 */
function getMnemonic() {
    return process.env.MNEMONIC || null;
}

/**
 * Create Chronik client
 * @returns {ChronikClient} Chronik client instance
 */
function createChronikClient() {
    const chronikUrl = CHRONIK_URLS[0];
    if (!chronikUrl) {
        throw new Error('CHRONIK_URLS not configured properly');
    }
    console.log(`📡 Using Chronik client: ${chronikUrl}`);
    return new ChronikClient(chronikUrl);
}

/**
 * Send XEC to recipients
 * @param {Array<{address: string, amount: number}>} recipients - Array of recipients with amounts in satoshis
 * @returns {Promise<{txid: string}>} Transaction result
 */
async function sendXec(recipients) {
    const mnemonic = getMnemonic();
    if (!mnemonic) {
        throw new Error('MNEMONIC not configured in environment variables');
    }

    const chronik = createChronikClient();
    
    return await quick.sendXec(recipients, {
        mnemonic: mnemonic,
        chronik: chronik
    });
}

/**
 * Send SLP tokens to recipients
 * @param {Array<{address: string, amount: number}>} recipients - Recipients with amounts in base units
 * @param {string} tokenId - Token ID
 * @param {number} tokenDecimals - Token decimals
 * @returns {Promise<{txid: string}>} Transaction result
 */
async function sendSlp(recipients, tokenId, tokenDecimals) {
    const mnemonic = getMnemonic();
    if (!mnemonic) {
        throw new Error('MNEMONIC not configured in environment variables');
    }

    const chronik = createChronikClient();
    
    return await quick.sendSlp(recipients, {
        tokenId: tokenId,
        tokenDecimals: tokenDecimals,
        mnemonic: mnemonic,
        chronik: chronik
    });
}

/**
 * Send ALP tokens to recipients
 * @param {Array<{address: string, amount: number}>} recipients - Recipients with amounts in base units
 * @param {string} tokenId - Token ID
 * @param {number} tokenDecimals - Token decimals
 * @returns {Promise<{txid: string}>} Transaction result
 */
async function sendAlp(recipients, tokenId, tokenDecimals) {
    const mnemonic = getMnemonic();
    if (!mnemonic) {
        throw new Error('MNEMONIC not configured in environment variables');
    }

    const chronik = createChronikClient();
    
    return await quick.sendAlp(recipients, {
        tokenId: tokenId,
        tokenDecimals: tokenDecimals,
        mnemonic: mnemonic,
        chronik: chronik
    });
}

/**
 * Check if mnemonic is configured
 * @returns {boolean}
 */
function isMnemonicConfigured() {
    return !!getMnemonic();
}

module.exports = {
    sendXec,
    sendSlp,
    sendAlp,
    isMnemonicConfigured
};


