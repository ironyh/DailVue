/**
 * VueSip Logger
 *
 * Configurable logging system with namespace support, log levels, and browser console formatting.
 * Provides consistent logging throughout the VueSip library with the ability to filter by level and namespace.
 *
 * @module utils/logger
 */

import { LOG_LEVELS } from './constants'

/**
 * Log level type
 */
export type LogLevel = (typeof LOG_LEVELS)[number]

/**
 * Log level priority (higher = more severe)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * Console method mapping
 */
const CONSOLE_METHOD: Record<LogLevel, keyof Console> = {
  debug: 'debug',
  info: 'log',
  warn: 'warn',
  error: 'error',
}

/**
 * Log level colors for browser console
 */
const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '#888',
  info: '#0066cc',
  warn: '#ff9800',
  error: '#f44336',
}

/**
 * Namespace colors (cycle through these)
 */
const NAMESPACE_COLORS = [
  '#e91e63',
  '#9c27b0',
  '#673ab7',
  '#3f51b5',
  '#2196f3',
  '#00bcd4',
  '#009688',
  '#4caf50',
  '#ff9800',
  '#ff5722',
]

/**
 * Global logger configuration
 */
interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel
  /** Whether logging is enabled */
  enabled: boolean
  /** Whether to show timestamps */
  showTimestamp: boolean
  /** Custom log handler (for testing or custom output) */
  handler?: LogHandler
}

/**
 * Custom log handler function
 */
export type LogHandler = (
  level: LogLevel,
  namespace: string,
  message: string,
  ...args: unknown[]
) => void

/**
 * Global logger configuration
 */
let globalConfig: LoggerConfig = {
  level: 'info',
  enabled: true,
  showTimestamp: true,
  handler: undefined,
}

/**
 * Namespace to color mapping (for consistent colors)
 */
const namespaceColors = new Map<string, string>()

/**
 * Gets a consistent color for a namespace
 */
function getNamespaceColor(namespace: string): string {
  if (!namespaceColors.has(namespace)) {
    const colorIndex = namespaceColors.size % NAMESPACE_COLORS.length
    namespaceColors.set(namespace, NAMESPACE_COLORS[colorIndex])
  }
  const color = namespaceColors.get(namespace)
  return color || NAMESPACE_COLORS[0]
}

/**
 * Formats timestamp for logging
 */
function formatTimestamp(): string {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  const seconds = now.getSeconds().toString().padStart(2, '0')
  const ms = now.getMilliseconds().toString().padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${ms}`
}

/**
 * Logger class with namespace support
 */
export class Logger {
  /**
   * Logger namespace
   */
  private namespace: string

  /**
   * Creates a new logger instance
   *
   * @param namespace - Logger namespace (e.g., 'SipClient', 'CallSession')
   */
  constructor(namespace: string) {
    this.namespace = namespace
  }

  /**
   * Logs a debug message
   *
   * @param message - Log message
   * @param args - Additional arguments to log
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyComponent')
   * logger.debug('Debug message', { foo: 'bar' })
   * ```
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args)
  }

  /**
   * Logs an info message
   *
   * @param message - Log message
   * @param args - Additional arguments to log
   *
   * @example
   * ```typescript
   * logger.info('User connected', { userId: '123' })
   * ```
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args)
  }

  /**
   * Logs a warning message
   *
   * @param message - Log message
   * @param args - Additional arguments to log
   *
   * @example
   * ```typescript
   * logger.warn('Connection slow', { latency: 500 })
   * ```
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args)
  }

  /**
   * Logs an error message
   *
   * @param message - Log message
   * @param args - Additional arguments to log (can include Error objects)
   *
   * @example
   * ```typescript
   * logger.error('Connection failed', new Error('Network error'))
   * ```
   */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args)
  }

  /**
   * Core logging method
   *
   * @param level - Log level
   * @param message - Log message
   * @param args - Additional arguments
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    // Check if logging is enabled
    if (!globalConfig.enabled) {
      return
    }

    // Check log level
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[globalConfig.level]) {
      return
    }

    // Use custom handler if provided
    if (globalConfig.handler) {
      globalConfig.handler(level, this.namespace, message, ...args)
      return
    }

    // Build log output
    const parts: string[] = []
    const styles: string[] = []

    // Timestamp
    if (globalConfig.showTimestamp) {
      parts.push('%c%s')
      styles.push('color: #999; font-weight: normal')
      styles.push(formatTimestamp())
    }

    // Log level
    parts.push('%c%s')
    styles.push(`color: ${LOG_LEVEL_COLORS[level]}; font-weight: bold`)
    styles.push(level.toUpperCase())

    // Namespace
    parts.push('%c[%s]')
    styles.push(`color: ${getNamespaceColor(this.namespace)}; font-weight: bold`)
    styles.push(this.namespace)

    // Message
    parts.push('%c%s')
    styles.push('color: inherit; font-weight: normal')
    styles.push(message)

    // Output to console
    const consoleMethod = CONSOLE_METHOD[level]
    const logArgs = [parts.join(' '), ...styles, ...args]

    // @ts-expect-error - Console methods are callable
    console[consoleMethod](...logArgs)
  }

  /**
   * Creates a child logger with an extended namespace
   *
   * @param childNamespace - Child namespace to append
   * @returns New logger instance
   *
   * @example
   * ```typescript
   * const logger = new Logger('SipClient')
   * const callLogger = logger.child('Call')
   * // Namespace will be 'SipClient:Call'
   * ```
   */
  child(childNamespace: string): Logger {
    return new Logger(`${this.namespace}:${childNamespace}`)
  }
}

/**
 * Creates a new logger instance
 *
 * @param namespace - Logger namespace
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * import { createLogger } from './utils/logger'
 *
 * const logger = createLogger('MyComponent')
 * logger.info('Component initialized')
 * ```
 */
export function createLogger(namespace: string): Logger {
  return new Logger(namespace)
}

/**
 * Configures the global logger
 *
 * @param config - Logger configuration
 *
 * @example
 * ```typescript
 * import { configureLogger } from './utils/logger'
 *
 * configureLogger({
 *   level: 'debug',
 *   enabled: true,
 *   showTimestamp: true
 * })
 * ```
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  globalConfig = {
    ...globalConfig,
    ...config,
  }
}

/**
 * Gets the current logger configuration
 *
 * @returns Current logger configuration
 */
export function getLoggerConfig(): Readonly<LoggerConfig> {
  return { ...globalConfig }
}

/**
 * Enables logging
 */
export function enableLogging(): void {
  globalConfig.enabled = true
}

/**
 * Disables logging
 */
export function disableLogging(): void {
  globalConfig.enabled = false
}

/**
 * Sets the minimum log level
 *
 * @param level - Minimum log level
 *
 * @example
 * ```typescript
 * setLogLevel('debug') // Show all logs
 * setLogLevel('error') // Show only errors
 * ```
 */
export function setLogLevel(level: LogLevel): void {
  globalConfig.level = level
}

/**
 * Gets the current log level
 *
 * @returns Current log level
 */
export function getLogLevel(): LogLevel {
  return globalConfig.level
}

/**
 * Sets a custom log handler
 *
 * Useful for testing or custom log output (e.g., sending to a server)
 *
 * @param handler - Custom log handler function
 *
 * @example
 * ```typescript
 * setLogHandler((level, namespace, message, ...args) => {
 *   // Send to server
 *   fetch('/api/logs', {
 *     method: 'POST',
 *     body: JSON.stringify({ level, namespace, message, args })
 *   })
 * })
 * ```
 */
export function setLogHandler(handler: LogHandler | undefined): void {
  globalConfig.handler = handler
}

/**
 * Default logger instance (for global use)
 */
export const defaultLogger = createLogger('VueSip')
