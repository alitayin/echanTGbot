const { getOutputScriptFromAddress, encodeOutputScript } = require('ecashaddrjs');

function toBigInt(value) {
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') return BigInt(value);
    if (typeof value === 'string' && value !== '') {
        try { return BigInt(value); } catch { return 0n; }
    }
    return 0n;
}

function toXecString(value) {
    const sats = toBigInt(value);
    const xecInteger = sats / 100n;
    const xecFraction = sats % 100n;
    const fracStr = xecFraction.toString().padStart(2, '0');
    return `${xecInteger.toString()}.${fracStr} XEC`;
}

function tryEncode(script) {
    try {
        return encodeOutputScript(script, 'ecash');
    } catch (_) {
        return script;
    }
}

function shortenAddress(addr) {
    if (typeof addr !== 'string') return 'unknown';
    const payload = addr.includes(':') ? addr.split(':').pop() : addr;
    const suffix = payload.slice(-4);
    return `${suffix}`;
}

function linkAddress(addr) {
    if (typeof addr === 'string' && addr.startsWith('ecash:')) {
        const display = shortenAddress(addr);
        const url = `https://explorer.e.cash/address/${addr}`;
        return `<a href="${url}">${display}</a>`;
    }
    return shortenAddress(String(addr || 'unknown'));
}

function linkTx(txid) {
    if (!txid || typeof txid !== 'string') return '';
    const label = `txid:..${txid.slice(-4)}`;
    const url = `https://explorer.e.cash/tx/${txid}`;
    return `<a href="${url}">${label}</a>`;
}

function linkTokenId(tokenId) {
    if (!tokenId || typeof tokenId !== 'string') return 'unknown token';
    const url = `https://explorer.e.cash/token/${tokenId}`;
    const label = `${tokenId.slice(0, 2)}${tokenId.slice(-4)}`;
    return `<a href="${url}">${label}</a>`;
}

function linkThisAddress(addr) {
    if (typeof addr === 'string' && addr.startsWith('ecash:')) {
        const url = `https://explorer.e.cash/address/${addr}`;
        return `<a href="${url}">this address</a>`;
    }
    return 'this address';
}

function padDirection(direction) {
    try {
        return String(direction || '').padEnd(3, ' ');
    } catch (_) {
        return String(direction || '');
    }
}

function isCoinbaseTx(tx, inputs) {
    try {
        if (tx && tx.isCoinbase) return true;
        const ins = Array.isArray(inputs) ? inputs : [];
        if (ins.length === 0) return false;
        return ins.every(i => {
            const txid = String(i?.prevOut?.txid || '').toLowerCase();
            const outIdx = i?.prevOut?.outIdx;
            const allZeros = !!txid && /^0+$/.test(txid);
            return allZeros && (outIdx === 4294967295);
        });
    } catch (_) {
        return false;
    }
}

function isAgoraCanceled(inputScriptHex) {
    try {
        const hex = String(inputScriptHex || '').toLowerCase();
        if (!hex || /[^0-9a-f]/.test(hex)) return false;
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2) {
            bytes.push(hex.substr(i, 2));
        }

        let pos = 0;
        while (pos < bytes.length) {
            const byte = bytes[pos++];
            if (byte === '00') {
                // Independent OP_0 encountered
                return true;
            }
            const b = parseInt(byte, 16);
            if (b > 0 && b <= 0x4b) {
                const dataLength = b;
                pos += dataLength;
            } else if (byte === '4c') {
                const dataLength = parseInt(bytes[pos++] || '00', 16);
                pos += dataLength;
            } else if (byte === '4d') {
                const lo = parseInt(bytes[pos++] || '00', 16);
                const hi = parseInt(bytes[pos++] || '00', 16);
                const dataLength = lo + (hi << 8);
                pos += dataLength;
            } else if (byte === '4e') {
                const b0 = parseInt(bytes[pos++] || '00', 16);
                const b1 = parseInt(bytes[pos++] || '00', 16);
                const b2 = parseInt(bytes[pos++] || '00', 16);
                const b3 = parseInt(bytes[pos++] || '00', 16);
                const dataLength = b0 + (b1 << 8) + (b2 << 16) + (b3 << 24);
                pos += dataLength;
            }
        }
        return false;
    } catch (_) {
        return false;
    }
}

// Heuristic to detect a successful Agora trade transaction
function isAgoraTx(tx) {
    try {
        const inputs = Array.isArray(tx?.inputs) ? tx.inputs : [];
        const outputs = Array.isArray(tx?.outputs) ? tx.outputs : [];
        if (inputs.length === 0 || outputs.length === 0) return false;

        // Check presence of required scripts in any input script
        const hasRequiredScripts = inputs.some((input) => {
            const s = String(input?.inputScript || '').toLowerCase();
            return s.includes('514d') && s.includes('075041525449414c');
        });
        if (!hasRequiredScripts) return false;

        // Detect cancellation pair: contains '004d' and has an independent OP_0
        const has004d = inputs.some((input) => String(input?.inputScript || '').toLowerCase().includes('004d'));
        const canceled = inputs.some((input) => isAgoraCanceled(input?.inputScript || ''));
        if (has004d && canceled) return false;

        // Token output usually at index 2 or 3
        const thirdOutput = outputs[2];
        const fourthOutput = outputs[3];
        const hasTokenOut = !!(thirdOutput?.token || fourthOutput?.token);
        if (!hasTokenOut) return false;

        return true;
    } catch (_) {
        return false;
    }
}

function renderExplorerMessage(data, page = 0) {
    const address = data.address;
    const myScript = getOutputScriptFromAddress(address);
    const utxos = Array.isArray(data?.utxos?.utxos)
        ? data.utxos.utxos
        : (Array.isArray(data?.utxos) ? data.utxos : []);
    const balanceBig = utxos.reduce((sum, u) => sum + toBigInt(u?.sats || 0), 0n);
    const txs = Array.isArray(data?.history?.txs) ? data.history.txs : [];

    function absBig(n) { return n < 0n ? -n : n; }
    function scriptToHtml(script) {
        const addr = tryEncode(script);
        if (typeof addr === 'string' && addr.startsWith('ecash:')) {
            return linkAddress(addr);
        }
        return shortenAddress(String(addr || 'unknown'));
    }
    function unique(arr) {
        const seen = new Set();
        const out = [];
        for (const v of arr) {
            const key = String(v);
            if (!seen.has(key)) {
                seen.add(key);
                out.push(v);
            }
        }
        return out;
    }
    function canEncodeToAddress(script) {
        try {
            const addr = encodeOutputScript(script, 'ecash');
            return typeof addr === 'string' && addr.startsWith('ecash:');
        } catch (_) {
            return false;
        }
    }
    function formatAddrListFromScripts(scripts, excludeSelf = false, maxItems = 3) {
        const filtered = (excludeSelf ? scripts.filter(s => s !== myScript) : scripts).filter(Boolean);
        const uniq = unique(filtered);
        const shown = uniq.slice(0, maxItems).map(scriptToHtml);
        const others = Math.max(0, uniq.length - shown.length);
        if (shown.length === 0) return 'unknown';
        return others > 0 ? `${shown.join('、')} and ${others} others` : shown.join('、');
    }
    function countOthers(scripts) {
        return unique(scripts.filter(Boolean)).filter(s => s !== myScript).length;
    }

    const lines = [];
    lines.push(`✨ Address: ${linkAddress(address)}`);
    lines.push(`💰 Balance: ${toXecString(balanceBig)}`);
    if (txs.length > 0) {
        const displayPage = (page || 0) + 1;
        const pageSize = 10;
        lines.push(`\n📜 Recent (page ${displayPage})`);
        for (const tx of txs.slice(0, pageSize)) {
            const outputs = Array.isArray(tx.outputs) ? tx.outputs : [];
            const inputs = Array.isArray(tx.inputs) ? tx.inputs : [];

            const outputsToSelf = outputs.filter(o => o.outputScript === myScript);
            const inputsFromSelf = inputs.filter(i => i.outputScript === myScript);
            const selfInOutputs = outputsToSelf.length > 0;
            const selfInInputs = inputsFromSelf.length > 0;

            const sumOutputsToSelf = outputsToSelf.reduce((sum, o) => sum + toBigInt(o?.sats || 0), 0n);
            const sumOutputsToOthers = outputs.reduce((sum, o) => {
                const script = o?.outputScript;
                const isSelf = script === myScript;
                const isEncodable = !!script && canEncodeToAddress(script);
                return sum + (!isSelf && isEncodable ? toBigInt(o?.sats || 0) : 0n);
            }, 0n);
            const sumInputsFromSelf = inputsFromSelf.reduce((sum, i) => sum + toBigInt(i?.sats || 0), 0n);
            const net = sumOutputsToSelf - sumInputsFromSelf; // >0 net IN, <0 net OUT

            const inputScripts = unique(inputs.map(i => i.outputScript).filter(Boolean));
            const outputScripts = unique(outputs.map(o => o.outputScript).filter(Boolean));

            const txAnchor = linkTx(tx.txid);
            const agoraTag = isAgoraTx(tx) ? ' (Agora)' : '';

            if (!selfInInputs && !selfInOutputs) {
                // Shouldn't happen for address-scoped history; skip
                continue;
            }

            if (selfInInputs && selfInOutputs) {
                const direction = net > 0n ? 'IN' : 'OUT';
                const amountSats = direction === 'OUT' ? sumOutputsToOthers : sumOutputsToSelf;
                const DUST_SATS = 546n;
                const hasTokenInSelf = outputsToSelf.some(o => o?.token?.tokenId);
                const dustToSelfTokenSats = outputsToSelf.reduce((acc, o) => acc + (o?.token?.tokenId && toBigInt(o?.sats || 0) === DUST_SATS ? DUST_SATS : 0n), 0n);
                const hideAmount = direction === 'IN' && hasTokenInSelf && amountSats > 0n && amountSats === dustToSelfTokenSats;
                const amount = toXecString(amountSats);

                // Build from label: always include this address; list up to 3 other input addresses; >3 as others
                const inputOthers = unique(inputScripts).filter(s => s && s !== myScript && canEncodeToAddress(s));
                const inputShown = inputOthers.slice(0, 3).map(scriptToHtml);
                const inputRest = Math.max(0, inputOthers.length - inputShown.length);
                const fromLabel = `${linkThisAddress(address)}${inputShown.length ? `、${inputShown.join('、')}` : ''}${inputRest > 0 ? ` and ${inputRest} others` : ''}`;

                let toLabel = '';
                if (direction === 'OUT') {
                    // For spending, treat outputs to self as change; do not show self on the 'to' side
                    const outOthers = unique(outputScripts).filter(s => s && s !== myScript && canEncodeToAddress(s));
                    const outShown = outOthers.slice(0, 3).map(scriptToHtml);
                    const outRest = Math.max(0, outOthers.length - outShown.length);
                    toLabel = outShown.length ? `${outShown.join('、')}${outRest > 0 ? ` and ${outRest} others` : ''}` : 'unknown';
                } else {
                    // For net incoming, include this address on the 'to' side plus other outputs
                    const outOthers = unique(outputScripts).filter(s => s && s !== myScript && canEncodeToAddress(s));
                    const outShown = outOthers.slice(0, 3).map(scriptToHtml);
                    const outRest = Math.max(0, outOthers.length - outShown.length);
                    toLabel = `${linkThisAddress(address)}${outShown.length ? `、${outShown.join('、')}` : ''}${outRest > 0 ? ` and ${outRest} others` : ''}`;
                }

                const entry = [];
                entry.push(`\n🔹 ${padDirection(direction)} ${txAnchor}${agoraTag}`);
                entry.push(`${direction === 'IN' ? '📥' : '📤'} ${fromLabel} ➡️ ${toLabel}`);
                if (!hideAmount) entry.push(`${direction === 'IN' ? '💰' : '💸'} ${amount}`);
                const tokensSegment = buildTokenMovementInline(inputs, outputs, myScript, data?.tokenMeta);
                if (tokensSegment) entry.push(`🪙 ${tokensSegment}`);
                lines.push(entry.join(' | '));
                continue;
            }

            if (selfInInputs && !selfInOutputs) {
                const direction = 'OUT';
                const amount = toXecString(sumOutputsToOthers);
                // Exclude self from output listing; show addresses explicitly if <=3, else append others
                const outOthers = unique(outputScripts).filter(s => s && s !== myScript && canEncodeToAddress(s));
                const outShown = outOthers.slice(0, 3).map(scriptToHtml);
                const outRest = Math.max(0, outOthers.length - outShown.length);
                const toLabel = outShown.length ? `${outShown.join('、')}${outRest > 0 ? ` and ${outRest} others` : ''}` : 'unknown';
                const entry = [];
                entry.push(`\n🔹 ${padDirection(direction)} ${txAnchor}${agoraTag}`);
                entry.push(`📤 ${linkThisAddress(address)} ➡️ ${toLabel}`);
                entry.push(`💸 ${amount}`);
                const tokensSegment = buildTokenMovementInline(inputs, outputs, myScript, data?.tokenMeta);
                if (tokensSegment) entry.push(`🪙 ${tokensSegment}`);
                lines.push(entry.join(' | '));
                continue;
            }

            if (!selfInInputs && selfInOutputs) {
                const direction = 'IN';
                const amountSats = sumOutputsToSelf;
                const DUST_SATS = 546n;
                const hasTokenInSelf = outputsToSelf.some(o => o?.token?.tokenId);
                const dustToSelfTokenSats = outputsToSelf.reduce((acc, o) => acc + (o?.token?.tokenId && toBigInt(o?.sats || 0) === DUST_SATS ? DUST_SATS : 0n), 0n);
                const hideAmount = hasTokenInSelf && amountSats > 0n && amountSats === dustToSelfTokenSats;
                const amount = toXecString(amountSats);
                // Exclude self on from side; list up to 3 senders
                const inOthers = unique(inputScripts).filter(s => s && s !== myScript && canEncodeToAddress(s));
                const inShown = inOthers.slice(0, 3).map(scriptToHtml);
                const inRest = Math.max(0, inOthers.length - inShown.length);
                const isCb = isCoinbaseTx(tx, inputs);
                const fromLabel = isCb ? 'coinbase' : (inShown.length ? `${inShown.join('、')}${inRest > 0 ? ` and ${inRest} others` : ''}` : 'unknown');
                const entry = [];
                entry.push(`\n🔹 ${padDirection(direction)} ${txAnchor}${agoraTag}`);
                entry.push(`📥 ${fromLabel} ➡️ ${linkThisAddress(address)}`);
                if (!hideAmount) entry.push(`💰 ${amount}`);
                const tokensSegment = buildTokenMovementInline(inputs, outputs, myScript, data?.tokenMeta);
                if (tokensSegment) entry.push(`🪙 ${tokensSegment}`);
                lines.push(entry.join(' | '));
                continue;
            }
        }
    }
    return lines.join('\n');
}

function buildTokenMovementLines(inputs, outputs, myScript, tokenMeta, direction) {
    try {
        const inTokenById = new Map();
        const outTokenById = new Map();
        for (const o of Array.isArray(outputs) ? outputs : []) {
            if (o?.outputScript === myScript && o?.token?.tokenId) {
                const key = o.token.tokenId;
                const atoms = BigInt(o.token.atoms || 0);
                inTokenById.set(key, (inTokenById.get(key) || 0n) + atoms);
            }
        }
        for (const i of Array.isArray(inputs) ? inputs : []) {
            if (i?.outputScript === myScript && i?.token?.tokenId) {
                const key = i.token.tokenId;
                const atoms = BigInt(i.token.atoms || 0);
                outTokenById.set(key, (outTokenById.get(key) || 0n) + atoms);
            }
        }
        const lines = [];
        // Incoming tokens
        for (const [tokenId, atoms] of inTokenById.entries()) {
            const meta = tokenMeta?.[tokenId];
            const decimals = meta?.genesisInfo?.decimals ?? 0;
            const name = meta?.genesisInfo?.tokenTicker || meta?.genesisInfo?.tokenName || 'Token';
            const amountStr = formatTokenAmount(atoms, decimals);
            lines.push(`IN ${amountStr} ${name} (${linkTokenId(tokenId)})`);
        }
        // Outgoing tokens
        for (const [tokenId, atoms] of outTokenById.entries()) {
            const meta = tokenMeta?.[tokenId];
            const decimals = meta?.genesisInfo?.decimals ?? 0;
            const name = meta?.genesisInfo?.tokenTicker || meta?.genesisInfo?.tokenName || 'Token';
            const amountStr = formatTokenAmount(atoms, decimals);
            lines.push(`OUT ${amountStr} ${name} (${linkTokenId(tokenId)})`);
        }
        return lines.join('\n  ');
    } catch (_) {
        return '';
    }
}

function formatTokenAmount(atoms, decimals) {
    try {
        const a = typeof atoms === 'bigint' ? atoms : BigInt(atoms || 0);
        const d = Math.max(0, Number(decimals || 0));
        if (d === 0) return a.toString();
        const base = 10n ** BigInt(d);
        const integer = a / base;
        const frac = a % base;
        const fracStr = frac.toString().padStart(d, '0').replace(/0+$/, '');
        return fracStr ? `${integer.toString()}.${fracStr}` : integer.toString();
    } catch {
        return String(atoms || '0');
    }
}

function buildTokenMovementInline(inputs, outputs, myScript, tokenMeta) {
    const block = buildTokenMovementLines(inputs, outputs, myScript, tokenMeta);
    if (!block) return '';
    // Convert the multi-line token summary to a compact inline form
    const parts = block.split('\n').map(s => s.trim()).filter(Boolean);
    return parts.join(' • ');
}

module.exports = {
    renderExplorerMessage,
};


