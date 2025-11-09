/**
 * Logging abstraction for Agent Testing Framework
 *
 * Provides configurable logging with levels and the ability to
 * disable logging for performance in production/tests.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none'

export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel
  /** Prefix to add to all log messages */
  prefix?: string
  /** Whether to include timestamps */
  timestamps?: boolean
  /** Custom log function (defaults to console.log) */
  logFunction?: (message: string) => void
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 99,
}

/**
 * Simple logger class with level-based filtering
 */
export class Logger {
  private config: Required<LoggerConfig>

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? 'info',
      prefix: config.prefix ?? '',
      timestamps: config.timestamps ?? false,
      logFunction: config.logFunction ?? console.log,
    }
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level]
  }

  /**
   * Format a log message with prefix and timestamp
   */
  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = []

    if (this.config.timestamps) {
      parts.push(`[${new Date().toISOString()}]`)
    }

    parts.push(`[${level.toUpperCase()}]`)

    if (this.config.prefix) {
      parts.push(`[${this.config.prefix}]`)
    }

    parts.push(message)

    return parts.join(' ')
  }

  /**
   * Log a debug message
   */
  debug(message: string): void {
    if (this.shouldLog('debug')) {
      this.config.logFunction(this.formatMessage('debug', message))
    }
  }

  /**
   * Log an info message
   */
  info(message: string): void {
    if (this.shouldLog('info')) {
      this.config.logFunction(this.formatMessage('info', message))
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string): void {
    if (this.shouldLog('warn')) {
      this.config.logFunction(this.formatMessage('warn', message))
    }
  }

  /**
   * Log an error message
   */
  error(message: string): void {
    if (this.shouldLog('error')) {
      this.config.logFunction(this.formatMessage('error', message))
    }
  }

  /**
   * Update logger configuration
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    }
  }

  /**
   * Set the log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level
  }

  /**
   * Create a child logger with a specific prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    })
  }
}

/**
 * Global logger instance
 */
export const globalLogger = new Logger({
  level: 'none', // Default to no logging for tests
})

/**
 * Create a logger with a specific prefix
 */
export function createLogger(prefix: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger({
    ...config,
    prefix,
  })
}
