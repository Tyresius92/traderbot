// TODO: If I were actually going to use a trading bot, I'd
// integrate an actual logging service, either the GCS solution
// or something like Sentry. That said, let's isolate out logging to
// a specific util file, so if I need/want to change logging solutions,
// it's dirt simple to do

// This util func is likely not needed with a real logging solution
const getTimestamp = () => {
  const date = new Date();

  return date.toISOString();
};

export const info = (message, ...args) => {
  console.info(`${getTimestamp()} [INFO] ${message}`, ...args);
};

export const warn = (message, ...args) => {
  console.warn(`${getTimestamp()} [WARNING] ${message}`, ...args);
};

export const error = (message, ...args) => {
  console.error(`${getTimestamp()} [ERROR] ${message}`, ...args);
};

export default {
  info,
  warn,
  error,
};
