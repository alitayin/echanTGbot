/**
 * Run an async task with a timeout.
 * @param {Function|Promise<any>} task
 * @param {number} timeoutMs
 * @param {string} [timeoutMessage='Timeout']
 * @returns {Promise<any>}
 */
function withTimeout(task, timeoutMs, timeoutMessage = 'Timeout') {
    const taskPromise = typeof task === 'function' ? task() : task;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), Number(timeoutMs) || 0);
    });
    return Promise.race([taskPromise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

module.exports = { withTimeout };


