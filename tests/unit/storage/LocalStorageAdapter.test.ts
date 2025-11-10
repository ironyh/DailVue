/**
 * LocalStorageAdapter Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LocalStorageAdapter } from '../../../src/storage/LocalStorageAdapter'

describe('LocalStorageAdapter', () => {
  let adapter: LocalStorageAdapter

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    adapter = new LocalStorageAdapter({
      prefix: 'test',
      version: '1',
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('initialization', () => {
    it('should create adapter with default config', () => {
      const defaultAdapter = new LocalStorageAdapter()
      expect(defaultAdapter.name).toBe('LocalStorageAdapter')
    })

    it('should create adapter with custom config', () => {
      const customAdapter = new LocalStorageAdapter({
        prefix: 'myapp',
        version: '2',
      })
      expect(customAdapter.name).toBe('LocalStorageAdapter')
    })
  })

  describe('set and get', () => {
    it('should store and retrieve string', async () => {
      const key = 'test:string'
      const value = 'Hello, World!'

      await adapter.set(key, value)
      const result = await adapter.get<string>(key)

      expect(result.success).toBe(true)
      expect(result.data).toBe(value)
    })

    it('should store and retrieve number', async () => {
      const key = 'test:number'
      const value = 42

      await adapter.set(key, value)
      const result = await adapter.get<number>(key)

      expect(result.success).toBe(true)
      expect(result.data).toBe(value)
    })

    it('should store and retrieve object', async () => {
      const key = 'test:object'
      const value = { name: 'John', age: 30, active: true }

      await adapter.set(key, value)
      const result = await adapter.get<typeof value>(key)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(value)
    })

    it('should store and retrieve array', async () => {
      const key = 'test:array'
      const value = [1, 2, 3, 'four', { five: 5 }]

      await adapter.set(key, value)
      const result = await adapter.get<typeof value>(key)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(value)
    })

    it('should return undefined for non-existent key', async () => {
      const result = await adapter.get('non:existent')

      expect(result.success).toBe(true)
      expect(result.data).toBeUndefined()
    })

    it('should overwrite existing value', async () => {
      const key = 'test:overwrite'

      await adapter.set(key, 'first')
      await adapter.set(key, 'second')

      const result = await adapter.get<string>(key)
      expect(result.data).toBe('second')
    })

    it('should handle null value', async () => {
      const key = 'test:null'
      await adapter.set(key, null)

      const result = await adapter.get(key)
      expect(result.success).toBe(true)
      expect(result.data).toBe(null)
    })

    it('should use namespaced keys', async () => {
      const key = 'mykey'
      await adapter.set(key, 'value')

      // Check that the actual localStorage key is namespaced
      const fullKey = 'test:1:mykey'
      const rawValue = localStorage.getItem(fullKey)
      expect(rawValue).not.toBeNull()
    })
  })

  describe('remove', () => {
    it('should remove existing key', async () => {
      const key = 'test:remove'
      await adapter.set(key, 'value')

      const removeResult = await adapter.remove(key)
      expect(removeResult.success).toBe(true)

      const getResult = await adapter.get(key)
      expect(getResult.data).toBeUndefined()
    })

    it('should not throw when removing non-existent key', async () => {
      const result = await adapter.remove('non:existent')
      expect(result.success).toBe(true)
    })
  })

  describe('has', () => {
    it('should return true for existing key', async () => {
      const key = 'test:exists'
      await adapter.set(key, 'value')

      const exists = await adapter.has(key)
      expect(exists).toBe(true)
    })

    it('should return false for non-existent key', async () => {
      const exists = await adapter.has('non:existent')
      expect(exists).toBe(false)
    })

    it('should return false after removal', async () => {
      const key = 'test:removed'
      await adapter.set(key, 'value')
      await adapter.remove(key)

      const exists = await adapter.has(key)
      expect(exists).toBe(false)
    })
  })

  describe('keys', () => {
    it('should return empty array when no keys exist', async () => {
      const keys = await adapter.keys()
      expect(keys).toEqual([])
    })

    it('should return all keys', async () => {
      await adapter.set('key1', 'value1')
      await adapter.set('key2', 'value2')
      await adapter.set('key3', 'value3')

      const keys = await adapter.keys()
      expect(keys).toHaveLength(3)
      expect(keys).toContain('key1')
      expect(keys).toContain('key2')
      expect(keys).toContain('key3')
    })

    it('should filter keys by prefix', async () => {
      await adapter.set('user:name', 'John')
      await adapter.set('user:email', 'john@example.com')
      await adapter.set('config:theme', 'dark')

      const userKeys = await adapter.keys('user:')
      expect(userKeys).toHaveLength(2)
      expect(userKeys).toContain('user:name')
      expect(userKeys).toContain('user:email')
    })

    it('should not include keys from other adapters', async () => {
      const adapter2 = new LocalStorageAdapter({ prefix: 'other', version: '1' })

      await adapter.set('key1', 'value1')
      await adapter2.set('key2', 'value2')

      const keys1 = await adapter.keys()
      const keys2 = await adapter2.keys()

      expect(keys1).toHaveLength(1)
      expect(keys2).toHaveLength(1)
      expect(keys1).toContain('key1')
      expect(keys2).toContain('key2')
    })
  })

  describe('clear', () => {
    it('should clear all keys', async () => {
      await adapter.set('key1', 'value1')
      await adapter.set('key2', 'value2')
      await adapter.set('key3', 'value3')

      const result = await adapter.clear()
      expect(result.success).toBe(true)

      const keys = await adapter.keys()
      expect(keys).toHaveLength(0)
    })

    it('should clear only keys with prefix', async () => {
      await adapter.set('user:name', 'John')
      await adapter.set('user:email', 'john@example.com')
      await adapter.set('config:theme', 'dark')

      await adapter.clear('user:')

      const keys = await adapter.keys()
      expect(keys).toHaveLength(1)
      expect(keys).toContain('config:theme')
    })

    it('should not affect keys from other adapters', async () => {
      const adapter2 = new LocalStorageAdapter({ prefix: 'other', version: '1' })

      await adapter.set('key1', 'value1')
      await adapter2.set('key2', 'value2')

      await adapter.clear()

      const keys1 = await adapter.keys()
      const keys2 = await adapter2.keys()

      expect(keys1).toHaveLength(0)
      expect(keys2).toHaveLength(1)
    })
  })

  describe('encryption', () => {
    it(
      'should encrypt sensitive data',
      async () => {
        const encryptedAdapter = new LocalStorageAdapter(
          {
            prefix: 'test',
            version: '1',
            encryption: { enabled: true },
          },
          'test-password'
        )

        const key = 'sip:credentials'
        const value = { username: 'user', password: 'secret' }

        await encryptedAdapter.set(key, value)

        // Check that raw storage is encrypted
        const rawValue = localStorage.getItem('test:1:sip:credentials')
        expect(rawValue).not.toContain('secret')
        expect(rawValue).not.toContain('user')

        // Should decrypt correctly
        const result = await encryptedAdapter.get<typeof value>(key)
        expect(result.success).toBe(true)
        expect(result.data).toEqual(value)
      },
      30000 // 30 second timeout for encryption test
    )

    it(
      'should auto-detect sensitive keys',
      async () => {
        const encryptedAdapter = new LocalStorageAdapter(
          {
            prefix: 'test',
            version: '1',
            encryption: { enabled: true },
          },
          'test-password'
        )

        // These keys should be encrypted automatically
        const sensitiveKeys = ['credentials', 'password', 'secret', 'auth']

        for (const keyPart of sensitiveKeys) {
          const key = `test:${keyPart}`
          await encryptedAdapter.set(key, 'sensitive-data')

          const rawValue = localStorage.getItem(`test:1:test:${keyPart}`)
          // Should be encrypted (contain encryption metadata)
          expect(rawValue).toContain('data')
          expect(rawValue).toContain('iv')
          expect(rawValue).toContain('salt')
        }
      },
      30000 // 30 second timeout for encryption test
    )

    it('should not encrypt non-sensitive keys', async () => {
      const encryptedAdapter = new LocalStorageAdapter(
        {
          prefix: 'test',
          version: '1',
          encryption: { enabled: true },
        },
        'test-password'
      )

      const key = 'user:preferences'
      const value = { theme: 'dark' }

      await encryptedAdapter.set(key, value)

      // Should not be encrypted
      const rawValue = localStorage.getItem('test:1:user:preferences')
      expect(rawValue).toContain('dark')
    })
  })

  describe('error handling', () => {
    it('should handle JSON parse errors gracefully', async () => {
      // Manually insert invalid JSON
      localStorage.setItem('test:1:invalid', 'not-json{')

      const result = await adapter.get('invalid')
      // Should return as string when JSON parsing fails
      expect(result.success).toBe(true)
      expect(result.data).toBe('not-json{')
    })
  })

  describe('complex data types', () => {
    it('should handle nested objects', async () => {
      const key = 'test:nested'
      const value = {
        user: {
          profile: {
            name: 'John',
            contact: {
              email: 'john@example.com',
              phone: '+1234567890',
            },
          },
        },
      }

      await adapter.set(key, value)
      const result = await adapter.get<typeof value>(key)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(value)
    })

    it('should handle arrays of objects', async () => {
      const key = 'test:array-objects'
      const value = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ]

      await adapter.set(key, value)
      const result = await adapter.get<typeof value>(key)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(value)
    })

    it('should handle dates correctly', async () => {
      const key = 'test:date'
      const date = new Date('2024-01-01T00:00:00.000Z')
      const value = { timestamp: date.toISOString() }

      await adapter.set(key, value)
      const result = await adapter.get<typeof value>(key)

      expect(result.success).toBe(true)
      expect(result.data?.timestamp).toBe(date.toISOString())
    })
  })
})
