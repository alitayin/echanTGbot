/**
 * Run an async task with a timeout.
 * @param {Function|Promise<any>} task
 * @param {number} timeoutMs
 * @param {string} [timeoutMessage='Timeout']
 * @returns {Promise<any>}
 */
function withTimeout(task, timeoutMs, timeoutMessage = 'Timeout') {
    const taskPromise = typeof task === 'function' ? task() : task;
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(timeoutMessage)), Number(timeoutMs) || 0)
    );
    return Promise.race([taskPromise, timeoutPromise]);
}

module.exports = { withTimeout };


