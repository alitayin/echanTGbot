const REDACTED = '[REDACTED]';

function redact(value) {
  return String(value ?? '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, `Bearer ${REDACTED}`)
    .replace(/\b(api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, `$1=${REDACTED}`)
    .slice(0, 500);
}

function getErrorSummary(error) {
  const data = error?.response?.data;
  const payload = data && typeof data === 'object' ? data : {};
  return {
    status: error?.response?.status ?? payload.status ?? null,
    code: redact(payload.code || error?.code || ''),
    message: redact(payload.message || (typeof data === 'string' ? data : error?.message) || 'Unknown error'),
  };
}

function isNetworkError(error) {
  return Boolean(error?.request) && !error?.response;
}

function isRetryable(error) {
  const status = error?.response?.status;
  return isNetworkError(error) || status === 408 || status === 429 || status >= 500;
}

function shouldRotateKey(error) {
  return [401, 403, 429].includes(error?.response?.status);
}

async function withKeyRotation(clients, fn, opts = {}) {
  if (!clients || clients.length === 0) {
    throw new Error('withKeyRotation: clients array must not be empty');
  }
  const maxRetriesPerKey = opts.maxRetriesPerKey ?? 3;
  const maxTotalAttempts = opts.maxTotalAttempts ?? clients.length * maxRetriesPerKey;

  let totalAttempts = 0;
  let lastError;

  for (let clientIndex = 0; clientIndex < clients.length && totalAttempts < maxTotalAttempts; clientIndex++) {
    const client = clients[clientIndex];

    for (let attempt = 1; attempt <= maxRetriesPerKey && totalAttempts < maxTotalAttempts; attempt++) {
      totalAttempts++;
      try {
        return await fn(client);
      } catch (error) {
        lastError = error;
        console.warn('AI API request failed', getErrorSummary(error));

        if (shouldRotateKey(error) && clientIndex < clients.length - 1) {
          break;
        }
        if (!isRetryable(error)) {
          throw error;
        }
      }
    }
  }

  const exhausted = new Error('withKeyRotation: all attempts exhausted');
  exhausted.cause = lastError;
  throw exhausted;
}

module.exports = {
  withKeyRotation,
  getErrorSummary,
  isRetryable,
  shouldRotateKey,
};
