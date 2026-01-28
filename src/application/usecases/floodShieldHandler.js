const { banUser, unbanUser } = require('../../infrastructure/telegram/adminActions.js');

const SHIELD_JOIN_WINDOW_MS = 10 * 1000;
const SHIELD_JOIN_THRESHOLD = 5;
const SHIELD_IDLE_RESET_MS = 60 * 1000;

const shieldStates = new Map();

function getShieldState(chatId) {
    const key = String(chatId);
    if (!shieldStates.has(key)) {
        shieldStates.set(key, {
            active: false,
            joinTimestamps: [],
            lastJoinAt: 0,
            idleTimer: null
        });
    }
    return shieldStates.get(key);
}

function resetShieldIdleTimer(state, chatId) {
    if (state.idleTimer) {
        clearTimeout(state.idleTimer);
    }
    state.idleTimer = setTimeout(() => {
        const idleFor = Date.now() - state.lastJoinAt;
        if (idleFor >= SHIELD_IDLE_RESET_MS) {
            if (state.active) {
                console.log(`\n--- Shield mode OFF (idle) for chat ${chatId} ---`);
            }
            state.active = false;
            state.joinTimestamps = [];
        }
    }, SHIELD_IDLE_RESET_MS);
}

function updateShieldOnJoin(chatId, joinCount) {
    const state = getShieldState(chatId);
    const now = Date.now();
    state.joinTimestamps = state.joinTimestamps.filter((ts) => now - ts <= SHIELD_JOIN_WINDOW_MS);
    for (let i = 0; i < joinCount; i += 1) {
        state.joinTimestamps.push(now);
    }
    state.lastJoinAt = now;
    if (!state.active && state.joinTimestamps.length > SHIELD_JOIN_THRESHOLD) {
        state.active = true;
        console.log(`\n--- Shield mode ON for chat ${chatId} ---`);
    }
    resetShieldIdleTimer(state, chatId);
    return state.active;
}

async function rejectNewMembers(bot, chatId, newMembers) {
    for (const newMember of newMembers) {
        try {
            const banned = await banUser(bot, chatId, newMember.id);
            if (banned) {
                await unbanUser(bot, chatId, newMember.id);
            }
        } catch (error) {
            console.error('Failed to reject new member:', error);
        }
    }
}

async function handleFloodShieldJoins(bot, chatId, newMembers) {
    if (!newMembers || newMembers.length === 0) {
        return false;
    }
    const shouldReject = updateShieldOnJoin(chatId, newMembers.length);
    if (!shouldReject) {
        return false;
    }
    console.log(`\n--- Shield active: rejecting ${newMembers.length} new member(s) ---`);
    await rejectNewMembers(bot, chatId, newMembers);
    return true;
}

module.exports = {
    handleFloodShieldJoins
};

