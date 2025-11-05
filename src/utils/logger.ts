/**
 * Configurable logger for DailVue
 * @packageDocumentation
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
  None = 4,
}

/**
 * Log entry interface
 */
export interface LogEntry {
  level: LogLevel
  namespace: string
  message: string
  timestamp: Date
  data?: any[]
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel
  /** Enable timestamp in log output */
  timestamp: boolean
  /** Enable namespace in log output */
  namespace: boolean
  /** Custom log handler (for testing or custom output) */
  handler?: (entry: LogEntry) => void
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  level: LogLevel.Info,
  timestamp: true,
  namespace: true,
}

/**
 * Global logger configuration
 */
let globalConfig: LoggerConfig = { ...defaultConfig }

/**
 * Format timestamp for console output
 */
function formatTimestamp(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${milliseconds}`
}

/**
 * Get console method and style for log level
 */
function getConsoleMethod(level: LogLevel): {
  method: 'log' | 'info' | 'warn' | 'error'
  color: string
  icon: string
} {
  switch (level) {
    case LogLevel.Debug:
      return { method: 'log', color: '#888', icon: '🔍' }
    case LogLevel.Info:
      return { method: 'info', color: '#0ea5e9', icon: 'ℹ️' }
    case LogLevel.Warn:
      return { method: 'warn', color: '#f59e0b', icon: '⚠️' }
    case LogLevel.Error:
      return { method: 'error', color: '#ef4444', icon: '❌' }
    default:
      return { method: 'log', color: '#888', icon: '' }
  }
}

/**
 * Output log entry to console with formatting
 */
function outputToConsole(entry: LogEntry, config: LoggerConfig): void {
  const { method, color, icon } = getConsoleMethod(entry.level)
  const parts: string[] = []

  // Timestamp
  if (config.timestamp) {
    parts.push(`%c${formatTimestamp(entry.timestamp)}`)
  }

  // Namespace
  if (config.namespace && entry.namespace) {
    parts.push(`%c[${entry.namespace}]`)
  }

  // Level icon
  parts.push(`${icon}`)

  // Message
  parts.push(`%c${entry.message}`)

  // Build console styles
  const styles: string[] = []
  if (config.timestamp) {
    styles.push('color: #888; font-weight: normal;')
  }
  if (config.namespace && entry.namespace) {
    styles.push(`color: ${color}; font-weight: bold;`)
  }
  styles.push('color: inherit; font-weight: normal;')

  // Output to console
  if (entry.data && entry.data.length > 0) {
    console[method](parts.join(' '), ...styles, ...entry.data)
  } else {
    console[method](parts.join(' '), ...styles)
  }
}

/**
 * Logger class with namespace support
 */
export class Logger {
  private namespace: string

  /**
   * Create a logger instance
   * @param namespace - Logger namespace
   */
  constructor(namespace: string) {
    this.namespace = namespace
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LogLevel, message: string, ...data: any[]): void {
    // Skip if below configured level
    if (level < globalConfig.level) {
      return
    }

    const entry: LogEntry = {
      level,
      namespace: this.namespace,
      message,
      timestamp: new Date(),
      data: data.length > 0 ? data : undefined,
    }

    // Use custom handler if provided
    if (globalConfig.handler) {
      globalConfig.handler(entry)
      return
    }

    // Output to console
    outputToConsole(entry, globalConfig)
  }

  /**
   * Log debug message
   */
  debug(message: string, ...data: any[]): void {
    this.log(LogLevel.Debug, message, ...data)
  }

  /**
   * Log info message
   */
  info(message: string, ...data: any[]): void {
    this.log(LogLevel.Info, message, ...data)
  }

  /**
   * Log warning message
   */
  warn(message: string, ...data: any[]): void {
    this.log(LogLevel.Warn, message, ...data)
  }

  /**
   * Log error message
   */
  error(message: string, ...data: any[]): void {
    this.log(LogLevel.Error, message, ...data)
  }
}

/**
 * Configure global logger settings
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config }
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): Readonly<LoggerConfig> {
  return { ...globalConfig }
}

/**
 * Reset logger configuration to defaults
 */
export function resetLoggerConfig(): void {
  globalConfig = { ...defaultConfig }
}

/**
 * Create a logger instance with the given namespace
 */
export function createLogger(namespace: string): Logger {
  return new Logger(namespace)
}

/**
 * Default logger instance
 */
export const logger = createLogger('DailVue')
