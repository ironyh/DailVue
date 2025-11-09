/**
 * Performance Testing Type Definitions
 *
 * Extends standard types with performance-specific APIs
 */

/**
 * Memory measurement interface (Chrome/V8 specific)
 * Available when running with --expose-gc flag
 */
interface MemoryInfo {
  /** The size limit of the JavaScript heap in bytes */
  jsHeapSizeLimit: number
  /** The total allocated heap size in bytes */
  totalJSHeapSize: number
  /** The currently active segment of the JavaScript heap in bytes */
  usedJSHeapSize: number
}

/**
 * Extended Performance interface with memory tracking
 */
interface Performance {
  /**
   * Memory usage information (Chrome/V8 specific)
   * Available in Chrome and Node.js with appropriate flags
   */
  memory?: MemoryInfo
}

/**
 * Node.js global extensions for garbage collection
 */
declare global {
  /**
   * Manual garbage collection trigger
   * Available when running Node.js with --expose-gc flag
   */
  var gc: (() => void) | undefined

  namespace NodeJS {
    interface Global {
      gc?: () => void
    }
  }
}

export {}
