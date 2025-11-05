/**
 * Logging utility for DailVue
 * @packageDocumentation
 */

/**
 * Log level enumeration
 */
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
  None = 4,
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to display */
  level: LogLevel
  /** Enable timestamps */
  timestamps?: boolean
  /** Enable namespace prefixes */
  namespaces?: boolean
  /** Custom logger function */
  customLogger?: (level: LogLevel, namespace: string, message: string, ...args: any[]) => void
}

/**
 * Logger class for module-specific logging
 */
export class Logger {
  private namespace: string
  private static config: LoggerConfig = {
    level: LogLevel.Info,
    timestamps: true,
    namespaces: true,
  }

  constructor(namespace: string) {
    this.namespace = namespace
  }

  /**
   * Configure global logger settings
   */
  static configure(config: Partial<LoggerConfig>): void {
    Logger.config = { ...Logger.config, ...config }
  }

  /**
   * Get current logger configuration
   */
  static getConfig(): LoggerConfig {
    return { ...Logger.config }
  }

  /**
   * Set log level
   */
  static setLevel(level: LogLevel): void {
    Logger.config.level = level
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(): string {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0')
    return `${hours}:${minutes}:${seconds}.${milliseconds}`
  }

  /**
   * Get color for log level (browser console)
   */
  private getColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.Debug:
        return '#888888'
      case LogLevel.Info:
        return '#0066cc'
      case LogLevel.Warn:
        return '#ff9900'
      case LogLevel.Error:
        return '#cc0000'
      default:
        return '#000000'
    }
  }

  /**
   * Get emoji for log level
   */
  private getEmoji(level: LogLevel): string {
    switch (level) {
      case LogLevel.Debug:
        return '🔍'
      case LogLevel.Info:
        return 'ℹ️'
      case LogLevel.Warn:
        return '⚠️'
      case LogLevel.Error:
        return '❌'
      default:
        return ''
    }
  }

  /**
   * Format log message
   */
  private formatMessage(level: LogLevel, message: string): string {
    const parts: string[] = []

    if (Logger.config.timestamps) {
      parts.push(`[${this.formatTimestamp()}]`)
    }

    if (Logger.config.namespaces) {
      parts.push(`[${this.namespace}]`)
    }

    parts.push(message)

    return parts.join(' ')
  }

  /**
   * Log a message
   */
  private log(level: LogLevel, message: string, ...args: any[]): void {
    // Check if level should be logged
    if (level < Logger.config.level) {
      return
    }

    // Use custom logger if provided
    if (Logger.config.customLogger) {
      Logger.config.customLogger(level, this.namespace, message, ...args)
      return
    }

    const formattedMessage = this.formatMessage(level, message)
    const color = this.getColor(level)
    const emoji = this.getEmoji(level)

    // Browser console with styling
    if (typeof window !== 'undefined' && window.console) {
      const style = `color: ${color}; font-weight: bold;`

      switch (level) {
        case LogLevel.Debug:
          console.debug(`%c${emoji} ${formattedMessage}`, style, ...args)
          break
        case LogLevel.Info:
          console.info(`%c${emoji} ${formattedMessage}`, style, ...args)
          break
        case LogLevel.Warn:
          console.warn(`%c${emoji} ${formattedMessage}`, style, ...args)
          break
        case LogLevel.Error:
          console.error(`%c${emoji} ${formattedMessage}`, style, ...args)
          break
      }
    } else {
      // Node.js console without styling
      const prefix = this.getLevelName(level)
      switch (level) {
        case LogLevel.Debug:
          console.debug(`[${prefix}] ${formattedMessage}`, ...args)
          break
        case LogLevel.Info:
          console.info(`[${prefix}] ${formattedMessage}`, ...args)
          break
        case LogLevel.Warn:
          console.warn(`[${prefix}] ${formattedMessage}`, ...args)
          break
        case LogLevel.Error:
          console.error(`[${prefix}] ${formattedMessage}`, ...args)
          break
      }
    }
  }

  /**
   * Get level name
   */
  private getLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.Debug:
        return 'DEBUG'
      case LogLevel.Info:
        return 'INFO'
      case LogLevel.Warn:
        return 'WARN'
      case LogLevel.Error:
        return 'ERROR'
      default:
        return 'LOG'
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    this.log(LogLevel.Debug, message, ...args)
  }

  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    this.log(LogLevel.Info, message, ...args)
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    this.log(LogLevel.Warn, message, ...args)
  }

  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void {
    this.log(LogLevel.Error, message, ...args)
  }

  /**
   * Create a child logger with a sub-namespace
   */
  child(subNamespace: string): Logger {
    return new Logger(`${this.namespace}:${subNamespace}`)
  }
}

/**
 * Create a logger instance
 */
export function createLogger(namespace: string): Logger {
  return new Logger(namespace)
}

/**
 * Default logger instance
 */
export const logger = createLogger('DailVue')
