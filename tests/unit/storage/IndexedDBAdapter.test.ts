import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IndexedDBAdapter } from '@/storage/IndexedDBAdapter'

// Mock IndexedDB
class IDBDatabaseMock {
  objectStoreNames = { contains: vi.fn(() => false) }
  createObjectStore = vi.fn()
  transaction = vi.fn()
  close = vi.fn()
}

class IDBRequestMock {
  onsuccess: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onupgradeneeded: ((event: any) => void) | null = null
  result: any = null
  error: Error | null = null

  simulateSuccess(result: any) {
    this.result = result
    if (this.onsuccess) {
      this.onsuccess({ target: this } as any)
    }
  }

  simulateError(error: Error) {
    this.error = error
    if (this.onerror) {
      this.onerror({ target: this } as any)
    }
  }

  simulateUpgrade(db: any) {
    if (this.onupgradeneeded) {
      this.onupgradeneeded({ target: { result: db } } as any)
    }
  }
}

class IDBTransactionMock {
  objectStore = vi.fn()
}

class IDBObjectStoreMock {
  get = vi.fn()
  put = vi.fn()
  delete = vi.fn()
  clear = vi.fn()
  getKey = vi.fn()
  getAllKeys = vi.fn()
  openCursor = vi.fn()
}

describe('IndexedDBAdapter', () => {
  let adapter: IndexedDBAdapter
  let mockDB: IDBDatabaseMock
  let mockOpenRequest: IDBRequestMock

  beforeEach(() => {
    mockDB = new IDBDatabaseMock()
    mockOpenRequest = new IDBRequestMock()

    // Mock global indexedDB
    globalThis.indexedDB = {
      open: vi.fn(() => mockOpenRequest),
      deleteDatabase: vi.fn(() => new IDBRequestMock()),
    } as any

    adapter = new IndexedDBAdapter({ prefix: 'test', version: '1' })
  })

  afterEach(async () => {
    await adapter.close()
    vi.clearAllMocks()
  })

  describe('Constructor', () => {
    it('should create adapter with default config', () => {
      const defaultAdapter = new IndexedDBAdapter()
      expect(defaultAdapter.name).toBe('IndexedDBAdapter')
    })

    it('should create adapter with custom config', () => {
      const customAdapter = new IndexedDBAdapter({
        prefix: 'custom',
        version: '2',
        encryption: { enabled: true },
      })
      expect(customAdapter.name).toBe('IndexedDBAdapter')
    })
  })

  describe('initialize()', () => {
    it('should open IndexedDB database', async () => {
      const initPromise = adapter.initialize()

      // Simulate successful database open
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)

      await initPromise

      expect(globalThis.indexedDB.open).toHaveBeenCalledWith('test_1', 1)
    })

    it('should create object store on upgrade', async () => {
      const initPromise = adapter.initialize()

      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)

      await initPromise

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('keyvalue')
    })

    it('should not recreate object store if it exists', async () => {
      mockDB.objectStoreNames.contains = vi.fn(() => true)

      const initPromise = adapter.initialize()

      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)

      await initPromise

      expect(mockDB.createObjectStore).not.toHaveBeenCalled()
    })

    it('should handle initialization errors', async () => {
      const initPromise = adapter.initialize()

      setTimeout(() => {
        mockOpenRequest.simulateError(new Error('Failed to open'))
      }, 0)

      await expect(initPromise).rejects.toThrow('Failed to open')
    })

    it('should return immediately if already initialized', async () => {
      const initPromise1 = adapter.initialize()

      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)

      await initPromise1

      // Should not call open again
      const openCallCount = (globalThis.indexedDB.open as any).mock.calls.length

      await adapter.initialize()

      expect((globalThis.indexedDB.open as any).mock.calls.length).toBe(openCallCount)
    })

    it('should handle concurrent initialization calls', async () => {
      const initPromise1 = adapter.initialize()
      const initPromise2 = adapter.initialize()

      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)

      await Promise.all([initPromise1, initPromise2])

      expect(globalThis.indexedDB.open).toHaveBeenCalledTimes(1)
    })

    it('should throw error when IndexedDB not available', async () => {
      ;(globalThis as any).indexedDB = undefined

      const noIDBAdapter = new IndexedDBAdapter()

      await expect(noIDBAdapter.initialize()).rejects.toThrow('IndexedDB is not available')
    })
  })

  describe('get()', () => {
    let mockTransaction: IDBTransactionMock
    let mockStore: IDBObjectStoreMock
    let mockGetRequest: IDBRequestMock

    beforeEach(async () => {
      mockTransaction = new IDBTransactionMock()
      mockStore = new IDBObjectStoreMock()
      mockGetRequest = new IDBRequestMock()

      mockDB.transaction = vi.fn(() => mockTransaction)
      mockTransaction.objectStore = vi.fn(() => mockStore)
      mockStore.get = vi.fn(() => mockGetRequest)

      // Initialize adapter
      const initPromise = adapter.initialize()
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)
      await initPromise
    })

    it('should retrieve value from storage', async () => {
      const getPromise = adapter.get('test-key')

      setTimeout(() => {
        mockGetRequest.result = 'test-value'
        mockGetRequest.simulateSuccess('test-value')
      }, 0)

      const result = await getPromise

      expect(result.success).toBe(true)
      expect(result.data).toBe('test-value')
      expect(mockStore.get).toHaveBeenCalledWith('test-key')
    })

    it('should return undefined for non-existent key', async () => {
      const getPromise = adapter.get('non-existent')

      setTimeout(() => {
        mockGetRequest.result = undefined
        mockGetRequest.simulateSuccess(undefined)
      }, 0)

      const result = await getPromise

      expect(result.success).toBe(true)
      expect(result.data).toBeUndefined()
    })

    it('should handle get errors', async () => {
      const getPromise = adapter.get('test-key')

      setTimeout(() => {
        mockGetRequest.simulateError(new Error('Get failed'))
      }, 0)

      const result = await getPromise

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('set()', () => {
    let mockTransaction: IDBTransactionMock
    let mockStore: IDBObjectStoreMock
    let mockPutRequest: IDBRequestMock

    beforeEach(async () => {
      mockTransaction = new IDBTransactionMock()
      mockStore = new IDBObjectStoreMock()
      mockPutRequest = new IDBRequestMock()

      mockDB.transaction = vi.fn(() => mockTransaction)
      mockTransaction.objectStore = vi.fn(() => mockStore)
      mockStore.put = vi.fn(() => mockPutRequest)

      // Initialize adapter
      const initPromise = adapter.initialize()
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)
      await initPromise
    })

    it('should store value in storage', async () => {
      const setPromise = adapter.set('test-key', 'test-value')

      setTimeout(() => {
        mockPutRequest.simulateSuccess(undefined)
      }, 0)

      const result = await setPromise

      expect(result.success).toBe(true)
      expect(mockStore.put).toHaveBeenCalledWith('test-value', 'test-key')
    })

    it('should handle complex objects', async () => {
      const complexValue = {
        id: '123',
        data: { nested: true },
        array: [1, 2, 3],
      }

      const setPromise = adapter.set('test-key', complexValue)

      setTimeout(() => {
        mockPutRequest.simulateSuccess(undefined)
      }, 0)

      const result = await setPromise

      expect(result.success).toBe(true)
      expect(mockStore.put).toHaveBeenCalledWith(complexValue, 'test-key')
    })

    it('should handle set errors', async () => {
      const setPromise = adapter.set('test-key', 'value')

      setTimeout(() => {
        mockPutRequest.simulateError(new Error('Put failed'))
      }, 0)

      const result = await setPromise

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('remove()', () => {
    let mockTransaction: IDBTransactionMock
    let mockStore: IDBObjectStoreMock
    let mockDeleteRequest: IDBRequestMock

    beforeEach(async () => {
      mockTransaction = new IDBTransactionMock()
      mockStore = new IDBObjectStoreMock()
      mockDeleteRequest = new IDBRequestMock()

      mockDB.transaction = vi.fn(() => mockTransaction)
      mockTransaction.objectStore = vi.fn(() => mockStore)
      mockStore.delete = vi.fn(() => mockDeleteRequest)

      // Initialize adapter
      const initPromise = adapter.initialize()
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)
      await initPromise
    })

    it('should remove value from storage', async () => {
      const removePromise = adapter.remove('test-key')

      setTimeout(() => {
        mockDeleteRequest.simulateSuccess(undefined)
      }, 0)

      const result = await removePromise

      expect(result.success).toBe(true)
      expect(mockStore.delete).toHaveBeenCalledWith('test-key')
    })

    it('should handle remove errors', async () => {
      const removePromise = adapter.remove('test-key')

      setTimeout(() => {
        mockDeleteRequest.simulateError(new Error('Delete failed'))
      }, 0)

      const result = await removePromise

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('clear()', () => {
    let mockTransaction: IDBTransactionMock
    let mockStore: IDBObjectStoreMock
    let mockClearRequest: IDBRequestMock

    beforeEach(async () => {
      mockTransaction = new IDBTransactionMock()
      mockStore = new IDBObjectStoreMock()
      mockClearRequest = new IDBRequestMock()

      mockDB.transaction = vi.fn(() => mockTransaction)
      mockTransaction.objectStore = vi.fn(() => mockStore)
      mockStore.clear = vi.fn(() => mockClearRequest)

      // Initialize adapter
      const initPromise = adapter.initialize()
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)
      await initPromise
    })

    it('should clear all values without prefix', async () => {
      const clearPromise = adapter.clear()

      setTimeout(() => {
        mockClearRequest.simulateSuccess(undefined)
      }, 0)

      const result = await clearPromise

      expect(result.success).toBe(true)
      expect(mockStore.clear).toHaveBeenCalled()
    })

    it('should handle clear errors', async () => {
      const clearPromise = adapter.clear()

      setTimeout(() => {
        mockClearRequest.simulateError(new Error('Clear failed'))
      }, 0)

      const result = await clearPromise

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('has()', () => {
    let mockTransaction: IDBTransactionMock
    let mockStore: IDBObjectStoreMock
    let mockGetKeyRequest: IDBRequestMock

    beforeEach(async () => {
      mockTransaction = new IDBTransactionMock()
      mockStore = new IDBObjectStoreMock()
      mockGetKeyRequest = new IDBRequestMock()

      mockDB.transaction = vi.fn(() => mockTransaction)
      mockTransaction.objectStore = vi.fn(() => mockStore)
      mockStore.getKey = vi.fn(() => mockGetKeyRequest)

      // Initialize adapter
      const initPromise = adapter.initialize()
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)
      await initPromise
    })

    it('should return true for existing key', async () => {
      const hasPromise = adapter.has('test-key')

      setTimeout(() => {
        mockGetKeyRequest.result = 'test-key'
        mockGetKeyRequest.simulateSuccess('test-key')
      }, 0)

      const result = await hasPromise

      expect(result).toBe(true)
    })

    it('should return false for non-existent key', async () => {
      const hasPromise = adapter.has('non-existent')

      setTimeout(() => {
        mockGetKeyRequest.result = undefined
        mockGetKeyRequest.simulateSuccess(undefined)
      }, 0)

      const result = await hasPromise

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      const hasPromise = adapter.has('test-key')

      setTimeout(() => {
        mockGetKeyRequest.simulateError(new Error('Has failed'))
      }, 0)

      const result = await hasPromise

      expect(result).toBe(false)
    })
  })

  describe('keys()', () => {
    let mockTransaction: IDBTransactionMock
    let mockStore: IDBObjectStoreMock
    let mockGetAllKeysRequest: IDBRequestMock

    beforeEach(async () => {
      mockTransaction = new IDBTransactionMock()
      mockStore = new IDBObjectStoreMock()
      mockGetAllKeysRequest = new IDBRequestMock()

      mockDB.transaction = vi.fn(() => mockTransaction)
      mockTransaction.objectStore = vi.fn(() => mockStore)
      mockStore.getAllKeys = vi.fn(() => mockGetAllKeysRequest)

      // Initialize adapter
      const initPromise = adapter.initialize()
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)
      await initPromise
    })

    it('should return all keys', async () => {
      const keysPromise = adapter.keys()

      setTimeout(() => {
        mockGetAllKeysRequest.result = ['key1', 'key2', 'key3']
        mockGetAllKeysRequest.simulateSuccess(['key1', 'key2', 'key3'])
      }, 0)

      const keys = await keysPromise

      expect(keys).toEqual(['key1', 'key2', 'key3'])
    })

    it('should filter keys by prefix', async () => {
      const keysPromise = adapter.keys('test')

      setTimeout(() => {
        mockGetAllKeysRequest.result = ['test1', 'test2', 'other']
        mockGetAllKeysRequest.simulateSuccess(['test1', 'test2', 'other'])
      }, 0)

      const keys = await keysPromise

      expect(keys).toEqual(['test1', 'test2'])
    })

    it('should return empty array on error', async () => {
      const keysPromise = adapter.keys()

      setTimeout(() => {
        mockGetAllKeysRequest.simulateError(new Error('Keys failed'))
      }, 0)

      const keys = await keysPromise

      expect(keys).toEqual([])
    })
  })

  describe('close()', () => {
    it('should close database connection', async () => {
      // Initialize first
      const initPromise = adapter.initialize()
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)
      await initPromise

      await adapter.close()

      expect(mockDB.close).toHaveBeenCalled()
    })

    it('should handle multiple close calls', async () => {
      // Initialize first
      const initPromise = adapter.initialize()
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)
      await initPromise

      await adapter.close()
      await adapter.close()

      expect(mockDB.close).toHaveBeenCalledTimes(1)
    })
  })

  describe('deleteDatabase()', () => {
    it('should delete the entire database', async () => {
      const mockDeleteRequest = new IDBRequestMock()
      ;(globalThis.indexedDB.deleteDatabase as any).mockReturnValue(mockDeleteRequest)

      const deletePromise = adapter.deleteDatabase()

      setTimeout(() => {
        mockDeleteRequest.simulateSuccess(undefined)
      }, 0)

      await deletePromise

      expect(globalThis.indexedDB.deleteDatabase).toHaveBeenCalledWith('test_1')
    })

    it('should close connection before deleting', async () => {
      // Initialize first
      const initPromise = adapter.initialize()
      setTimeout(() => {
        mockOpenRequest.simulateUpgrade(mockDB)
        mockOpenRequest.simulateSuccess(mockDB)
      }, 0)
      await initPromise

      const mockDeleteRequest = new IDBRequestMock()
      ;(globalThis.indexedDB.deleteDatabase as any).mockReturnValue(mockDeleteRequest)

      const deletePromise = adapter.deleteDatabase()

      setTimeout(() => {
        mockDeleteRequest.simulateSuccess(undefined)
      }, 0)

      await deletePromise

      expect(mockDB.close).toHaveBeenCalled()
    })

    it('should throw error when IndexedDB not available', async () => {
      ;(globalThis as any).indexedDB = undefined

      const noIDBAdapter = new IndexedDBAdapter()

      await expect(noIDBAdapter.deleteDatabase()).rejects.toThrow('IndexedDB is not available')
    })
  })
})
