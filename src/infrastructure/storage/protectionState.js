const { createLevelStore, resolveStorePath } = require('./levelStoreRegistry.js');

const DEFAULT_PROTECTION_ENABLED = false;
const STATE_KEY = 'protection';
const dbPath = resolveStorePath('PROTECTION_STATE_DB_PATH', 'protectionSettings');
const db = createLevelStore(dbPath, { valueEncoding: 'json' });

let cachedState = null;
let loadPromise = null;

function normalizeState(value) {
  return {
    enabled: value?.enabled === true,
    updatedAt: Number.isFinite(Number(value?.updatedAt)) ? Number(value.updatedAt) : null,
    updatedBy: value?.updatedBy == null ? null : String(value.updatedBy),
  };
}

async function ensureLoaded() {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const stored = await db.get(STATE_KEY);
        cachedState = normalizeState(stored);
      } catch (error) {
        if (error.code !== 'LEVEL_NOT_FOUND') {
          console.error('Failed to load protection state:', error);
        }
        cachedState = normalizeState({ enabled: DEFAULT_PROTECTION_ENABLED });
      }
      return cachedState;
    })();
  }
  return loadPromise;
}

async function getProtectionState() {
  await ensureLoaded();
  return { ...cachedState };
}

async function isProtectionEnabled() {
  const state = await getProtectionState();
  return state.enabled;
}

async function setProtectionEnabled(enabled, updatedBy = null) {
  await ensureLoaded();
  cachedState = normalizeState({
    enabled: enabled === true,
    updatedAt: Date.now(),
    updatedBy,
  });
  await db.put(STATE_KEY, cachedState);
  return { ...cachedState };
}

async function closeProtectionState() {
  await db.close();
}

module.exports = {
  DEFAULT_PROTECTION_ENABLED,
  getProtectionState,
  isProtectionEnabled,
  setProtectionEnabled,
  closeProtectionState,
};
