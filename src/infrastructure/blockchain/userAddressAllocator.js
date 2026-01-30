const { Wallet } = require('ecash-wallet');
const { ChronikClient } = require('chronik-client');
const { CHRONIK_URLS } = require('../../../config/config.js');

let cachedWallet = null;
let cachedMnemonic = null;

function getMnemonic() {
    return process.env.MNEMONIC || null;
}

function isMnemonicConfigured() {
    return !!getMnemonic();
}

function getWallet() {
    const mnemonic = getMnemonic();
    if (!mnemonic) {
        throw new Error('MNEMONIC not configured in environment variables');
    }

    if (cachedWallet && cachedMnemonic === mnemonic) {
        return cachedWallet;
    }

    const chronikUrl = CHRONIK_URLS[0];
    if (!chronikUrl) {
        throw new Error('CHRONIK_URLS not configured properly');
    }

    const chronik = new ChronikClient(chronikUrl);
    cachedWallet = Wallet.fromMnemonic(mnemonic, chronik, { hd: true });
    cachedMnemonic = mnemonic;
    return cachedWallet;
}

function getReceiveAddressAtIndex(index) {
    if (!Number.isInteger(index) || index < 0) {
        throw new Error(`Invalid address index: ${index}`);
    }

    const wallet = getWallet();
    if (typeof wallet.getReceiveAddress !== 'function') {
        throw new Error('Wallet does not support getReceiveAddress');
    }

    return wallet.getReceiveAddress(index);
}

module.exports = {
    getReceiveAddressAtIndex,
    isMnemonicConfigured
};

