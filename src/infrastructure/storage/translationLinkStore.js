const { createLevelStore, resolveStorePath } = require('./levelStoreRegistry.js');

const LINK_TTL_MS = 48 * 60 * 60 * 1000;
const dbPath = resolveStorePath('TRANSLATION_LINK_DB_PATH', 'translationLinks');
const db = createLevelStore(dbPath, { valueEncoding: 'json' });

function makeKey(chatId, originalMessageId) {
  return `${chatId}:${originalMessageId}`;
}

async function getLink(chatId, originalMessageId) {
  const key = makeKey(chatId, originalMessageId);
  try {
    const value = await db.get(key);
    if (!value) return null;
    const createdAt = Number(value.createdAt);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > LINK_TTL_MS) {
      await db.del(key).catch(() => {});
      return null;
    }
    const translationMessageIds = Array.isArray(value.translationMessageIds)
      ? value.translationMessageIds.filter((id) => id != null)
      : [];
    return { createdAt, translationMessageIds };
  } catch (error) {
    if (error.code !== 'LEVEL_NOT_FOUND') {
      console.error('Failed to read translation link:', error);
    }
    return null;
  }
}

async function recordTranslationLink(chatId, originalMessageId, translationMessageId) {
  if (chatId == null || originalMessageId == null || translationMessageId == null) {
    return false;
  }
  const key = makeKey(chatId, originalMessageId);
  const existing = await getLink(chatId, originalMessageId);
  const ids = new Set(existing?.translationMessageIds || []);
  ids.add(translationMessageId);
  await db.put(key, {
    createdAt: existing?.createdAt || Date.now(),
    translationMessageIds: [...ids],
  });
  return true;
}

async function deleteLinkedTranslations(bot, chatId, originalMessageId) {
  const key = makeKey(chatId, originalMessageId);
  const link = await getLink(chatId, originalMessageId);
  if (!link) return 0;

  let deleted = 0;
  for (const translationMessageId of link.translationMessageIds) {
    try {
      await bot.deleteMessage(chatId, translationMessageId);
      deleted += 1;
    } catch (_) {
      // The translation may already be gone or outside Telegram's deletion window.
    }
  }
  await db.del(key).catch(() => {});
  return deleted;
}

async function pruneExpiredLinks(now = Date.now()) {
  let deleted = 0;
  for await (const [key, value] of db.iterator()) {
    const createdAt = Number(value?.createdAt);
    if (!Number.isFinite(createdAt) || now - createdAt > LINK_TTL_MS) {
      await db.del(key);
      deleted += 1;
    }
  }
  return deleted;
}

const cleanupTimer = setInterval(() => {
  pruneExpiredLinks().catch((error) => console.error('Failed to prune translation links:', error));
}, 60 * 60 * 1000);
cleanupTimer.unref?.();

async function closeTranslationLinkStore() {
  await db.close();
}

module.exports = {
  LINK_TTL_MS,
  getLink,
  recordTranslationLink,
  deleteLinkedTranslations,
  pruneExpiredLinks,
  closeTranslationLinkStore,
};
