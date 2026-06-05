const fs = require('fs');
const path = require('path');
const util = require('util');
const winston = require('winston');

const originalConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

function envFlag(name, defaultValue) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const serviceName = process.env.SERVICE_NAME || 'xecbot';
const logLevel = process.env.LOG_LEVEL || 'info';
const localLogEnabled = envFlag('LOCAL_LOG_ENABLED', true);
const axiomEnabled = envFlag('AXIOM_ENABLED', false);
const defaultLogDir = path.resolve(__dirname, '..', '..', 'logs');
const logDir = path.resolve(process.env.LOG_DIR || defaultLogDir);
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Configure transports: always log to console, optionally to local files and Axiom.
const transports = [
  new winston.transports.Console({
    format: winston.format.simple(),
  }),
];

let axiomTransport = null;
let privateLogger = null;
let logger = null;
let axiomDisabledAfterError = false;
let lastAxiomErrorLogAt = 0;

function buildFileTransport(filename, options = {}) {
  const transport = new winston.transports.File({
    filename: path.join(logDir, filename),
    maxsize: 10 * 1024 * 1024,
    maxFiles: 5,
    tailable: true,
    format: jsonFormat,
    ...options,
  });

  transport.on('error', (err) => {
    originalConsole.error(`Local log transport error (${filename}): ${err?.message || err}`);
  });

  return transport;
}

function formatAxiomError(err) {
  return err?.stack || err?.message || util.format(err);
}

function isPermanentAxiomConfigError(err) {
  const message = formatAxiomError(err).toLowerCase();
  return (
    message.includes('dataset not found') ||
    message.includes('status code 401') ||
    message.includes('status code 403') ||
    message.includes('status code 404') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  );
}

function disableAxiomAfterError(err) {
  if (axiomDisabledAfterError) {
    return;
  }

  axiomDisabledAfterError = true;
  const failedTransport = axiomTransport;
  axiomTransport = null;

  if (logger && failedTransport) {
    logger.remove(failedTransport);
  }

  originalConsole.error(
    `Axiom logging disabled after transport error: ${formatAxiomError(err)}`
  );
}

function handleAxiomError(err) {
  if (isPermanentAxiomConfigError(err)) {
    disableAxiomAfterError(err);
    return;
  }

  const now = Date.now();
  if (now - lastAxiomErrorLogAt > 60_000) {
    lastAxiomErrorLogAt = now;
    originalConsole.error(`Axiom transport error: ${formatAxiomError(err)}`);
  }
}

if (localLogEnabled) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    transports.push(buildFileTransport('combined.log'));
    transports.push(buildFileTransport('error.log', { level: 'error' }));
    privateLogger = winston.createLogger({
      level: logLevel,
      format: jsonFormat,
      defaultMeta: { service: serviceName },
      transports: [buildFileTransport('private.log')],
    });
  } catch (err) {
    originalConsole.error(`Local file logging disabled: ${err?.message || err}`);
  }
}

if (axiomEnabled && process.env.AXIOM_TOKEN && process.env.AXIOM_DATASET) {
  const { WinstonTransport: AxiomTransport } = require('@axiomhq/winston');
  axiomTransport = new AxiomTransport({
    dataset: process.env.AXIOM_DATASET,
    token: process.env.AXIOM_TOKEN,
    orgId: process.env.AXIOM_ORG_ID,
  });
  axiomTransport.on('error', handleAxiomError);
  transports.push(axiomTransport);
}

const exceptionHandlers = [
  new winston.transports.Console({
    format: winston.format.simple(),
  }),
];

const rejectionHandlers = [
  new winston.transports.Console({
    format: winston.format.simple(),
  }),
];

if (localLogEnabled && privateLogger) {
  exceptionHandlers.push(buildFileTransport('exceptions.log'));
  rejectionHandlers.push(buildFileTransport('rejections.log'));
}

if (axiomTransport) {
  exceptionHandlers.push(axiomTransport);
  rejectionHandlers.push(axiomTransport);
}

logger = winston.createLogger({
  level: logLevel,
  format: jsonFormat,
  defaultMeta: { service: serviceName },
  transports,
  exceptionHandlers,
  rejectionHandlers,
});

// Bridge existing console usage to the logger so existing logs reach configured transports.
const formatConsoleArgs = (...args) => util.format(...args);
console.log = (...args) => logger.info(formatConsoleArgs(...args));
console.info = (...args) => logger.info(formatConsoleArgs(...args));
console.warn = (...args) => logger.warn(formatConsoleArgs(...args));
console.error = (...args) => logger.error(formatConsoleArgs(...args));
console.debug = (...args) => logger.debug(formatConsoleArgs(...args));

// Keeps legacy call sites, but writes detailed records away from the console.
logger.axiomOnly = (level, message, meta = {}) => {
  if (privateLogger) {
    privateLogger.log({ level, message, ...meta });
  }

  if (axiomTransport) {
    try {
      const maybePromise = axiomTransport.log({ level, message, ...meta }, (err) => {
        if (err) {
          handleAxiomError(err);
        }
      });

      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(handleAxiomError);
      }
    } catch (err) {
      handleAxiomError(err);
    }
  }
};

if (localLogEnabled && privateLogger) {
  logger.info(`Local file logging enabled: dir=${logDir} level=${logger.level}`);
}

if (!axiomEnabled) {
  logger.info('Axiom logging disabled: set AXIOM_ENABLED=true to enable it.');
} else if (!axiomTransport) {
  logger.warn('Axiom logging disabled: set AXIOM_TOKEN and AXIOM_DATASET to enable it.');
} else {
  logger.info(
    `Axiom logging enabled for dataset=${process.env.AXIOM_DATASET}${
      process.env.AXIOM_ORG_ID ? ` org=${process.env.AXIOM_ORG_ID}` : ''
    } level=${logger.level}`
  );
}

module.exports = logger;
