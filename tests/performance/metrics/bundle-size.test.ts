/**
 * Bundle Size Performance Tests
 *
 * Validates that the library bundle sizes stay within performance budgets:
 * - Maximum bundle size (minified)
 * - Maximum bundle size (gzipped)
 *
 * These tests check the built artifacts in the dist/ directory.
 * If the build doesn't exist, tests will be skipped with appropriate warnings.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, statSync, existsSync } from 'fs'
import { resolve } from 'path'
import { gzipSync } from 'zlib'
import { PERFORMANCE } from '../../../src/utils/constants'

/**
 * Bundle size measurement result
 */
interface BundleSizeMeasurement {
  file: string
  sizeBytes: number
  sizeKB: number
  budgetBytes: number
  budgetKB: number
  passed: boolean
  overhead: number
  percentOfBudget: number
  format?: 'raw' | 'gzipped'
}

/**
 * Bundle size report
 */
interface BundleSizeReport {
  testName: string
  measurements: BundleSizeMeasurement[]
  allPassed: boolean
  totalFiles: number
  passedFiles: number
  failedFiles: number
  buildExists: boolean
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath: string): number {
  try {
    const stats = statSync(filePath)
    return stats.size
  } catch (error) {
    return -1
  }
}

/**
 * Get gzipped size of a file
 */
function getGzippedSize(filePath: string): number {
  try {
    const content = readFileSync(filePath)
    const gzipped = gzipSync(content, { level: 9 })
    return gzipped.length
  } catch (error) {
    return -1
  }
}

/**
 * Create a bundle size measurement
 */
function createBundleSizeMeasurement(
  file: string,
  sizeBytes: number,
  budgetBytes: number,
  format: 'raw' | 'gzipped' = 'raw'
): BundleSizeMeasurement {
  const sizeKB = sizeBytes / 1024
  const budgetKB = budgetBytes / 1024
  const passed = sizeBytes <= budgetBytes
  const overhead = sizeBytes - budgetBytes
  const percentOfBudget = (sizeBytes / budgetBytes) * 100

  return {
    file,
    sizeBytes,
    sizeKB,
    budgetBytes,
    budgetKB,
    passed,
    overhead,
    percentOfBudget,
    format,
  }
}

/**
 * Create bundle size report
 */
function createReport(
  testName: string,
  measurements: BundleSizeMeasurement[],
  buildExists: boolean
): BundleSizeReport {
  const passedFiles = measurements.filter((m) => m.passed).length
  const failedFiles = measurements.filter((m) => !m.passed).length

  return {
    testName,
    measurements,
    allPassed: failedFiles === 0,
    totalFiles: measurements.length,
    passedFiles,
    failedFiles,
    buildExists,
  }
}

/**
 * Format bundle size report for console output
 */
function formatReport(report: BundleSizeReport): string {
  const lines: string[] = []

  lines.push(`\n${'='.repeat(80)}`)
  lines.push(`Bundle Size Report: ${report.testName}`)
  lines.push(`${'='.repeat(80)}`)

  if (!report.buildExists) {
    lines.push('⚠️  Build artifacts not found. Run `npm run build` first.')
    lines.push('   Tests will be skipped.')
  } else {
    lines.push(
      `Status: ${report.allPassed ? '✓ PASSED' : '✗ FAILED'} (${report.passedFiles}/${report.totalFiles})`
    )
  }

  lines.push(`${'='.repeat(80)}`)

  for (const measurement of report.measurements) {
    const status = measurement.passed ? '✓' : '✗'
    const format = measurement.format === 'gzipped' ? ' (gzipped)' : ''

    lines.push(`\n${status} ${measurement.file}${format}`)
    lines.push(`  Size:    ${measurement.sizeKB.toFixed(2)} KB`)
    lines.push(`  Budget:  ${measurement.budgetKB.toFixed(2)} KB`)
    lines.push(`  Usage:   ${measurement.percentOfBudget.toFixed(1)}% of budget`)

    if (!measurement.passed) {
      const overheadKB = measurement.overhead / 1024
      lines.push(`  ⚠️  Over budget by ${overheadKB.toFixed(2)} KB`)
    }
  }

  lines.push(`\n${'='.repeat(80)}\n`)

  return lines.join('\n')
}

/**
 * Get the project root directory
 */
function getProjectRoot(): string {
  return resolve(__dirname, '../../..')
}

/**
 * Get dist directory path
 */
function getDistDir(): string {
  return resolve(getProjectRoot(), 'dist')
}

/**
 * Check if build exists
 */
function buildExists(): boolean {
  const distDir = getDistDir()
  return existsSync(distDir)
}

/**
 * Get all bundle files
 */
function getBundleFiles(): string[] {
  const distDir = getDistDir()

  // Expected bundle files based on vite.config.ts
  const expectedFiles = ['vuesip.js', 'vuesip.cjs', 'vuesip.umd.js']

  return expectedFiles
    .map((file) => resolve(distDir, file))
    .filter((filePath) => existsSync(filePath))
}

describe('Bundle Size Performance Tests', () => {
  const hasBuild = buildExists()

  describe('Bundle Size Limits', () => {
    it('should check if build artifacts exist', () => {
      if (!hasBuild) {
        console.warn('\n⚠️  Build artifacts not found in dist/ directory.')
        console.warn('   Run `npm run build` to generate bundles before running these tests.\n')
      }

      // This test passes either way, but provides information
      expect(true).toBe(true)
    })

    it('should validate ES module bundle size (minified)', () => {
      if (!hasBuild) {
        console.log('Skipping: Build artifacts not found')
        return
      }

      const measurements: BundleSizeMeasurement[] = []
      const esModulePath = resolve(getDistDir(), 'vuesip.js')

      if (existsSync(esModulePath)) {
        const size = getFileSize(esModulePath)

        measurements.push(
          createBundleSizeMeasurement('vuesip.js', size, PERFORMANCE.MAX_BUNDLE_SIZE, 'raw')
        )

        const report = createReport('ES Module Bundle (Minified)', measurements, true)

        if (!report.allPassed) {
          console.log(formatReport(report))
        }

        expect(size).toBeGreaterThan(0)
        expect(size).toBeLessThanOrEqual(PERFORMANCE.MAX_BUNDLE_SIZE)
      } else {
        console.warn('ES module bundle not found: vuesip.js')
      }
    })

    it('should validate CommonJS bundle size (minified)', () => {
      if (!hasBuild) {
        console.log('Skipping: Build artifacts not found')
        return
      }

      const measurements: BundleSizeMeasurement[] = []
      const cjsModulePath = resolve(getDistDir(), 'vuesip.cjs')

      if (existsSync(cjsModulePath)) {
        const size = getFileSize(cjsModulePath)

        measurements.push(
          createBundleSizeMeasurement('vuesip.cjs', size, PERFORMANCE.MAX_BUNDLE_SIZE, 'raw')
        )

        const report = createReport('CommonJS Bundle (Minified)', measurements, true)

        if (!report.allPassed) {
          console.log(formatReport(report))
        }

        expect(size).toBeGreaterThan(0)
        expect(size).toBeLessThanOrEqual(PERFORMANCE.MAX_BUNDLE_SIZE)
      } else {
        console.warn('CommonJS bundle not found: vuesip.cjs')
      }
    })

    it('should validate UMD bundle size (minified)', () => {
      if (!hasBuild) {
        console.log('Skipping: Build artifacts not found')
        return
      }

      const measurements: BundleSizeMeasurement[] = []
      const umdModulePath = resolve(getDistDir(), 'vuesip.umd.js')

      if (existsSync(umdModulePath)) {
        const size = getFileSize(umdModulePath)

        measurements.push(
          createBundleSizeMeasurement('vuesip.umd.js', size, PERFORMANCE.MAX_BUNDLE_SIZE, 'raw')
        )

        const report = createReport('UMD Bundle (Minified)', measurements, true)

        if (!report.allPassed) {
          console.log(formatReport(report))
        }

        expect(size).toBeGreaterThan(0)
        expect(size).toBeLessThanOrEqual(PERFORMANCE.MAX_BUNDLE_SIZE)
      } else {
        console.warn('UMD bundle not found: vuesip.umd.js')
      }
    })
  })

  describe('Gzipped Bundle Size Limits', () => {
    it('should validate ES module gzipped size', () => {
      if (!hasBuild) {
        console.log('Skipping: Build artifacts not found')
        return
      }

      const measurements: BundleSizeMeasurement[] = []
      const esModulePath = resolve(getDistDir(), 'vuesip.js')

      if (existsSync(esModulePath)) {
        const gzippedSize = getGzippedSize(esModulePath)

        measurements.push(
          createBundleSizeMeasurement(
            'vuesip.js',
            gzippedSize,
            PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED,
            'gzipped'
          )
        )

        const report = createReport('ES Module Bundle (Gzipped)', measurements, true)

        if (!report.allPassed) {
          console.log(formatReport(report))
        }

        expect(gzippedSize).toBeGreaterThan(0)
        expect(gzippedSize).toBeLessThanOrEqual(PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED)
      } else {
        console.warn('ES module bundle not found: vuesip.js')
      }
    })

    it('should validate CommonJS gzipped size', () => {
      if (!hasBuild) {
        console.log('Skipping: Build artifacts not found')
        return
      }

      const measurements: BundleSizeMeasurement[] = []
      const cjsModulePath = resolve(getDistDir(), 'vuesip.cjs')

      if (existsSync(cjsModulePath)) {
        const gzippedSize = getGzippedSize(cjsModulePath)

        measurements.push(
          createBundleSizeMeasurement(
            'vuesip.cjs',
            gzippedSize,
            PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED,
            'gzipped'
          )
        )

        const report = createReport('CommonJS Bundle (Gzipped)', measurements, true)

        if (!report.allPassed) {
          console.log(formatReport(report))
        }

        expect(gzippedSize).toBeGreaterThan(0)
        expect(gzippedSize).toBeLessThanOrEqual(PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED)
      } else {
        console.warn('CommonJS bundle not found: vuesip.cjs')
      }
    })

    it('should validate UMD gzipped size', () => {
      if (!hasBuild) {
        console.log('Skipping: Build artifacts not found')
        return
      }

      const measurements: BundleSizeMeasurement[] = []
      const umdModulePath = resolve(getDistDir(), 'vuesip.umd.js')

      if (existsSync(umdModulePath)) {
        const gzippedSize = getGzippedSize(umdModulePath)

        measurements.push(
          createBundleSizeMeasurement(
            'vuesip.umd.js',
            gzippedSize,
            PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED,
            'gzipped'
          )
        )

        const report = createReport('UMD Bundle (Gzipped)', measurements, true)

        if (!report.allPassed) {
          console.log(formatReport(report))
        }

        expect(gzippedSize).toBeGreaterThan(0)
        expect(gzippedSize).toBeLessThanOrEqual(PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED)
      } else {
        console.warn('UMD bundle not found: vuesip.umd.js')
      }
    })
  })

  describe('Bundle Size Comparison', () => {
    it('should compare raw vs gzipped sizes for all bundles', () => {
      if (!hasBuild) {
        console.log('Skipping: Build artifacts not found')
        return
      }

      const bundleFiles = getBundleFiles()
      const measurements: BundleSizeMeasurement[] = []

      for (const bundleFile of bundleFiles) {
        const rawSize = getFileSize(bundleFile)
        const gzippedSize = getGzippedSize(bundleFile)

        if (rawSize > 0 && gzippedSize > 0) {
          const compressionRatio = ((rawSize - gzippedSize) / rawSize) * 100
          const fileName = bundleFile.split('/').pop() || bundleFile

          // Add raw size measurement
          measurements.push(
            createBundleSizeMeasurement(
              `${fileName} (raw)`,
              rawSize,
              PERFORMANCE.MAX_BUNDLE_SIZE,
              'raw'
            )
          )

          // Add gzipped size measurement
          measurements.push(
            createBundleSizeMeasurement(
              `${fileName} (gzipped)`,
              gzippedSize,
              PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED,
              'gzipped'
            )
          )

          // Verify that gzipped is significantly smaller
          expect(gzippedSize).toBeLessThan(rawSize)
          expect(compressionRatio).toBeGreaterThan(50) // At least 50% compression
        }
      }

      if (measurements.length > 0) {
        const report = createReport('Bundle Size Comparison', measurements, true)
        console.log(formatReport(report))

        expect(report.allPassed).toBe(true)
      } else {
        console.warn('No bundle files found for comparison')
      }
    })
  })

  describe('Bundle Size Regression Detection', () => {
    it('should detect unexpected bundle size increases', () => {
      if (!hasBuild) {
        console.log('Skipping: Build artifacts not found')
        return
      }

      const measurements: BundleSizeMeasurement[] = []
      const bundleFiles = getBundleFiles()

      // This is a baseline test - in a real scenario, you would compare
      // against stored baseline sizes from previous builds
      for (const bundleFile of bundleFiles) {
        const size = getFileSize(bundleFile)
        const fileName = bundleFile.split('/').pop() || bundleFile

        if (size > 0) {
          measurements.push(
            createBundleSizeMeasurement(fileName, size, PERFORMANCE.MAX_BUNDLE_SIZE, 'raw')
          )
        }
      }

      if (measurements.length > 0) {
        const report = createReport('Bundle Size Regression Check', measurements, true)

        // Log the current sizes for baseline tracking
        console.log('\n📊 Current Bundle Sizes (for baseline tracking):')
        for (const measurement of measurements) {
          console.log(`  ${measurement.file}: ${measurement.sizeKB.toFixed(2)} KB`)
        }

        expect(report.allPassed).toBe(true)
      }
    })

    it('should ensure all bundles exist', () => {
      if (!hasBuild) {
        console.log('Skipping: Build artifacts not found')
        return
      }

      const distDir = getDistDir()
      const expectedBundles = ['vuesip.js', 'vuesip.cjs', 'vuesip.umd.js']
      const missingBundles: string[] = []

      for (const bundle of expectedBundles) {
        const bundlePath = resolve(distDir, bundle)
        if (!existsSync(bundlePath)) {
          missingBundles.push(bundle)
        }
      }

      if (missingBundles.length > 0) {
        console.warn(`\n⚠️  Missing bundles: ${missingBundles.join(', ')}`)
      }

      expect(missingBundles).toHaveLength(0)
    })
  })

  describe('Bundle Size Summary', () => {
    it('should generate comprehensive bundle size report', () => {
      if (!hasBuild) {
        const report = createReport('Comprehensive Bundle Size Report', [], false)
        console.log(formatReport(report))
        return
      }

      const measurements: BundleSizeMeasurement[] = []
      const bundleFiles = getBundleFiles()

      // Collect all measurements
      for (const bundleFile of bundleFiles) {
        const fileName = bundleFile.split('/').pop() || bundleFile
        const rawSize = getFileSize(bundleFile)
        const gzippedSize = getGzippedSize(bundleFile)

        if (rawSize > 0) {
          measurements.push(
            createBundleSizeMeasurement(
              `${fileName} (minified)`,
              rawSize,
              PERFORMANCE.MAX_BUNDLE_SIZE,
              'raw'
            )
          )
        }

        if (gzippedSize > 0) {
          measurements.push(
            createBundleSizeMeasurement(
              `${fileName} (gzipped)`,
              gzippedSize,
              PERFORMANCE.MAX_BUNDLE_SIZE_GZIPPED,
              'gzipped'
            )
          )
        }
      }

      const report = createReport('Comprehensive Bundle Size Report', measurements, true)

      // Always show the comprehensive report
      console.log(formatReport(report))

      // All measurements should pass
      expect(report.allPassed).toBe(true)
    })
  })
})
