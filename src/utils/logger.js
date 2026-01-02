const util = require('util');
const winston = require('winston');
const { WinstonTransport: AxiomTransport } = require('@axiomhq/winston');

// Configure transports: always log to console, optionally to Axiom.
const transports = [
  new winston.transports.Console({
    format: winston.format.simple(),
  }),
];

let axiomTransport = null;

if (process.env.AXIOM_TOKEN && process.env.AXIOM_DATASET) {
  axiomTransport = new AxiomTransport({
    dataset: process.env.AXIOM_DATASET,
    token: process.env.AXIOM_TOKEN,
    orgId: process.env.AXIOM_ORG_ID,
  });
  axiomTransport.on('error', (err) => {
    // Surface transport errors so we know if ingestion is failing.
    console.error('Axiom transport error', err);
  });
  transports.push(axiomTransport);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || 'xecbot' },
  transports,
  exceptionHandlers: axiomTransport
    ? [axiomTransport]
    : [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
  rejectionHandlers: axiomTransport
    ? [axiomTransport]
    : [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
});

// Bridge existing console usage to the logger so all logs reach Axiom when enabled.
const formatConsoleArgs = (...args) => util.format(...args);
console.log = (...args) => logger.info(formatConsoleArgs(...args));
console.info = (...args) => logger.info(formatConsoleArgs(...args));
console.warn = (...args) => logger.warn(formatConsoleArgs(...args));
console.error = (...args) => logger.error(formatConsoleArgs(...args));
console.debug = (...args) => logger.debug(formatConsoleArgs(...args));

if (!axiomTransport) {
  logger.warn('Axiom logging disabled: set AXIOM_TOKEN and AXIOM_DATASET to enable it.');
} else {
  logger.info(
    `Axiom logging enabled for dataset=${process.env.AXIOM_DATASET}${
      process.env.AXIOM_ORG_ID ? ` org=${process.env.AXIOM_ORG_ID}` : ''
    } level=${logger.level}`
  );
}

module.exports = logger;

