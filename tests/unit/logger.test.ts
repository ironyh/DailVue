/**
 * Unit tests for logger
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  Logger,
  createLogger,
  configureLogger,
  getLoggerConfig,
  enableLogging,
  disableLogging,
  setLogLevel,
  getLogLevel,
  setLogHandler,
  defaultLogger,
  type LogHandler,
} from '../../src/utils/logger'

describe('logger', () => {
  // Mock console methods
  const originalConsole = {
    debug: console.debug,
    log: console.log,
    warn: console.warn,
    error: console.error,
  }

  beforeEach(() => {
    // Reset logger config before each test
    configureLogger({
      level: 'info',
      enabled: true,
      showTimestamp: true,
      handler: undefined,
    })

    // Mock console methods
    console.debug = vi.fn()
    console.log = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  afterEach(() => {
    // Restore console
    console.debug = originalConsole.debug
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  })

  describe('Logger', () => {
    it('should create logger with namespace', () => {
      const logger = new Logger('TestNamespace')
      expect(logger).toBeInstanceOf(Logger)
    })

    it('should log info message', () => {
      const logger = new Logger('Test')
      logger.info('Test message')
      expect(console.log).toHaveBeenCalled()
    })

    it('should log warning message', () => {
      const logger = new Logger('Test')
      logger.warn('Warning message')
      expect(console.warn).toHaveBeenCalled()
    })

    it('should log error message', () => {
      const logger = new Logger('Test')
      logger.error('Error message')
      expect(console.error).toHaveBeenCalled()
    })

    it('should log debug message when level is debug', () => {
      configureLogger({ level: 'debug' })
      const logger = new Logger('Test')
      logger.debug('Debug message')
      expect(console.debug).toHaveBeenCalled()
    })

    it('should not log debug message when level is info', () => {
      configureLogger({ level: 'info' })
      const logger = new Logger('Test')
      logger.debug('Debug message')
      expect(console.debug).not.toHaveBeenCalled()
    })

    it('should not log when disabled', () => {
      disableLogging()
      const logger = new Logger('Test')
      logger.info('Test message')
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should log additional arguments', () => {
      const logger = new Logger('Test')
      const obj = { foo: 'bar' }
      logger.info('Test message', obj)
      expect(console.log).toHaveBeenCalled()
      // Check that console.log was called with the object
      const calls = vi.mocked(console.log).mock.calls
      expect(calls[0]).toContain(obj)
    })

    it('should create child logger', () => {
      const parent = new Logger('Parent')
      const child = parent.child('Child')
      expect(child).toBeInstanceOf(Logger)
      child.info('Test')
      expect(console.log).toHaveBeenCalled()
      // Namespace should be Parent:Child
      const calls = vi.mocked(console.log).mock.calls
      const callArgs = calls[0].join(' ')
      expect(callArgs).toContain('Parent:Child')
    })
  })

  describe('createLogger', () => {
    it('should create logger instance', () => {
      const logger = createLogger('MyNamespace')
      expect(logger).toBeInstanceOf(Logger)
    })
  })

  describe('configureLogger', () => {
    it('should configure log level', () => {
      configureLogger({ level: 'debug' })
      expect(getLogLevel()).toBe('debug')
    })

    it('should configure enabled state', () => {
      configureLogger({ enabled: false })
      const logger = createLogger('Test')
      logger.info('Test')
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should configure timestamp display', () => {
      configureLogger({ showTimestamp: false })
      const config = getLoggerConfig()
      expect(config.showTimestamp).toBe(false)
    })

    it('should configure custom handler', () => {
      const handler: LogHandler = vi.fn()
      configureLogger({ handler })

      const logger = createLogger('Test')
      logger.info('Test message')

      expect(handler).toHaveBeenCalledWith('info', 'Test', 'Test message')
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should merge with existing config', () => {
      configureLogger({ level: 'debug' })
      configureLogger({ enabled: false })

      const config = getLoggerConfig()
      expect(config.level).toBe('debug')
      expect(config.enabled).toBe(false)
    })
  })

  describe('getLoggerConfig', () => {
    it('should return current config', () => {
      configureLogger({
        level: 'warn',
        enabled: true,
        showTimestamp: false,
      })

      const config = getLoggerConfig()
      expect(config.level).toBe('warn')
      expect(config.enabled).toBe(true)
      expect(config.showTimestamp).toBe(false)
    })

    it('should return readonly config', () => {
      const config = getLoggerConfig()
      // Config should be a new object (shallow copy)
      configureLogger({ level: 'debug' })
      expect(config.level).not.toBe('debug')
    })
  })

  describe('enableLogging / disableLogging', () => {
    it('should enable logging', () => {
      disableLogging()
      enableLogging()

      const logger = createLogger('Test')
      logger.info('Test')
      expect(console.log).toHaveBeenCalled()
    })

    it('should disable logging', () => {
      enableLogging()
      disableLogging()

      const logger = createLogger('Test')
      logger.info('Test')
      expect(console.log).not.toHaveBeenCalled()
    })
  })

  describe('setLogLevel / getLogLevel', () => {
    it('should set and get log level', () => {
      setLogLevel('error')
      expect(getLogLevel()).toBe('error')
    })

    it('should filter logs by level', () => {
      setLogLevel('error')
      const logger = createLogger('Test')

      logger.debug('Debug')
      logger.info('Info')
      logger.warn('Warn')
      logger.error('Error')

      expect(console.debug).not.toHaveBeenCalled()
      expect(console.log).not.toHaveBeenCalled()
      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).toHaveBeenCalled()
    })

    it('should allow all logs at debug level', () => {
      setLogLevel('debug')
      const logger = createLogger('Test')

      logger.debug('Debug')
      logger.info('Info')
      logger.warn('Warn')
      logger.error('Error')

      expect(console.debug).toHaveBeenCalled()
      expect(console.log).toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalled()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('setLogHandler', () => {
    it('should set custom log handler', () => {
      const handler: LogHandler = vi.fn()
      setLogHandler(handler)

      const logger = createLogger('Test')
      logger.info('Test message', { foo: 'bar' })

      expect(handler).toHaveBeenCalledWith('info', 'Test', 'Test message', { foo: 'bar' })
      expect(console.log).not.toHaveBeenCalled()
    })

    it('should clear custom handler', () => {
      const handler: LogHandler = vi.fn()
      setLogHandler(handler)
      setLogHandler(undefined)

      const logger = createLogger('Test')
      logger.info('Test')

      expect(handler).not.toHaveBeenCalled()
      expect(console.log).toHaveBeenCalled()
    })

    it('should use custom handler for all levels', () => {
      const handler: LogHandler = vi.fn()
      setLogHandler(handler)
      setLogLevel('debug')

      const logger = createLogger('Test')
      logger.debug('Debug')
      logger.info('Info')
      logger.warn('Warn')
      logger.error('Error')

      expect(handler).toHaveBeenCalledTimes(4)
      expect(handler).toHaveBeenCalledWith('debug', 'Test', 'Debug')
      expect(handler).toHaveBeenCalledWith('info', 'Test', 'Info')
      expect(handler).toHaveBeenCalledWith('warn', 'Test', 'Warn')
      expect(handler).toHaveBeenCalledWith('error', 'Test', 'Error')
    })
  })

  describe('defaultLogger', () => {
    it('should have VueSip namespace', () => {
      expect(defaultLogger).toBeInstanceOf(Logger)
      defaultLogger.info('Test')
      expect(console.log).toHaveBeenCalled()
      const calls = vi.mocked(console.log).mock.calls
      const callArgs = calls[0].join(' ')
      expect(callArgs).toContain('VueSip')
    })
  })

  describe('log level priority', () => {
    it('should respect priority: debug < info < warn < error', () => {
      const logger = createLogger('Test')

      // Set to warn level
      setLogLevel('warn')

      logger.debug('Debug')
      logger.info('Info')
      logger.warn('Warn')
      logger.error('Error')

      // Only warn and error should be logged
      expect(console.debug).not.toHaveBeenCalled()
      expect(console.log).not.toHaveBeenCalled()
      expect(console.warn).toHaveBeenCalled()
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('timestamp display', () => {
    it('should show timestamp when enabled', () => {
      configureLogger({ showTimestamp: true })
      const logger = createLogger('Test')
      logger.info('Test')
      expect(console.log).toHaveBeenCalled()
      // Timestamp should be in the format HH:MM:SS.mmm
      const calls = vi.mocked(console.log).mock.calls
      const callString = calls[0].join(' ')
      // Check for time pattern (contains colons)
      expect(callString).toMatch(/\d{2}:\d{2}:\d{2}/)
    })

    it('should not show timestamp when disabled', () => {
      configureLogger({ showTimestamp: false })
      const logger = createLogger('Test')
      logger.info('Test')
      expect(console.log).toHaveBeenCalled()
    })
  })
})
