const path = require('path');
const { Level } = require('level');

const stores = new Set();

function resolveStorePath(envName, directoryName) {
    if (process.env[envName]) {
        return path.resolve(process.env[envName]);
    }
    const dataRoot = process.env.DATA_DIR
        ? path.resolve(process.env.DATA_DIR)
        : path.resolve(__dirname, '../../../data');
    return path.join(dataRoot, directoryName);
}

function createLevelStore(dbPath, options = { valueEncoding: 'json' }) {
    const db = new Level(dbPath, options);
    stores.add(db);
    return db;
}

async function closeAllLevelStores() {
    const results = await Promise.allSettled(
        [...stores].map(async (db) => {
            if (db.status !== 'closed' && db.status !== 'closing') {
                await db.close();
            }
        })
    );
    stores.clear();
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length > 0) {
        throw new AggregateError(failed.map((result) => result.reason), 'Failed to close LevelDB stores');
    }
}

module.exports = {
    resolveStorePath,
    createLevelStore,
    closeAllLevelStores,
};
