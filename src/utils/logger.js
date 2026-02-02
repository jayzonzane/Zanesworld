// Configurable logging utility for performance optimization
// Reduces console.log overhead in production environments

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Default to DEBUG in development, WARN in production
let currentLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG;

const logger = {
  /**
   * Set the logging level
   * @param {string} level - One of: 'ERROR', 'WARN', 'INFO', 'DEBUG'
   */
  setLevel(level) {
    currentLevel = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  },

  /**
   * Get the current logging level
   * @returns {number} Current log level
   */
  getLevel() {
    return currentLevel;
  },

  /**
   * Log error messages (always shown except in silent mode)
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    if (currentLevel >= LOG_LEVELS.ERROR) console.error(...args);
  },

  /**
   * Log warning messages
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    if (currentLevel >= LOG_LEVELS.WARN) console.warn(...args);
  },

  /**
   * Log informational messages
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    if (currentLevel >= LOG_LEVELS.INFO) console.log(...args);
  },

  /**
   * Log debug messages (most verbose)
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    if (currentLevel >= LOG_LEVELS.DEBUG) console.log(...args);
  }
};

module.exports = logger;
