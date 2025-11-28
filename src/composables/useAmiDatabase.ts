/**
 * AMI Database Composable
 *
 * Vue composable for Asterisk AstDB (internal database) via AMI.
 * Provides contact/phonebook management with configurable field definitions.
 *
 * @module composables/useAmiDatabase
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { AmiClient } from '@/core/AmiClient'
import type {
  AmiContact,
  ContactFieldDefinition,
  UseAmiDatabaseOptions,
} from '@/types/ami.types'
import { DEFAULT_CONTACT_FIELDS } from '@/types/ami.types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('useAmiDatabase')

/**
 * Contact group with contacts
 */
export interface ContactGroup {
  /** Group name */
  name: string
  /** Contacts in this group */
  contacts: AmiContact[]
  /** Contact count */
  count: number
}

/**
 * Return type for useAmiDatabase composable
 */
export interface UseAmiDatabaseReturn {
  // State
  /** Map of contacts by ID */
  contacts: Ref<Map<string, AmiContact>>
  /** Available groups */
  groups: Ref<string[]>
  /** Loading state */
  loading: Ref<boolean>
  /** Error message */
  error: Ref<string | null>

  // Computed
  /** List of all contacts */
  contactList: ComputedRef<AmiContact[]>
  /** Contacts grouped by group */
  contactsByGroup: ComputedRef<Map<string, ContactGroup>>
  /** Total contact count */
  contactCount: ComputedRef<number>

  // Methods
  /** Refresh contacts from AstDB */
  refresh: () => Promise<void>
  /** Get a contact by ID */
  getContact: (id: string) => Promise<AmiContact | null>
  /** Save a contact */
  saveContact: (contact: Omit<AmiContact, 'id'> & { id?: string }) => Promise<AmiContact>
  /** Delete a contact */
  deleteContact: (id: string) => Promise<void>
  /** Search contacts */
  search: (query: string) => AmiContact[]
  /** Get contacts by group */
  getByGroup: (group: string) => AmiContact[]
  /** Get available groups */
  getGroups: () => string[]
  /** Add a group */
  addGroup: (group: string) => void
  /** Get field definitions */
  getFieldDefinitions: () => ContactFieldDefinition[]
  /** Raw DB operations */
  dbGet: (family: string, key: string) => Promise<string | null>
  dbPut: (family: string, key: string, value: string) => Promise<void>
  dbDel: (family: string, key: string) => Promise<void>
  dbDelTree: (family: string, key?: string) => Promise<void>
  /** Import contacts from array (bulk operation) */
  importContacts: (contactsToImport: Array<Omit<AmiContact, 'id'> & { id?: string }>) => Promise<AmiContact[]>
  /** Export all contacts as array */
  exportContacts: () => AmiContact[]
  /** Register a known contact ID (for external tracking) */
  registerKnownId: (id: string) => void
  /** Get known IDs (for external persistence) */
  getKnownIds: () => string[]
}

/**
 * AMI Database Composable
 *
 * Provides reactive contact/phonebook management via AstDB.
 * Supports custom field definitions and grouping.
 *
 * @param client - AMI client instance (from useAmi().getClient())
 * @param options - Configuration options with sensible defaults
 *
 * @example
 * ```typescript
 * const ami = useAmi()
 * await ami.connect({ url: 'ws://pbx.example.com:8080' })
 *
 * const {
 *   contacts,
 *   contactList,
 *   contactsByGroup,
 *   saveContact,
 *   deleteContact,
 *   search,
 * } = useAmiDatabase(ami.getClient()!, {
 *   contactFamily: 'phonebook',
 *   groups: ['Sales', 'Support', 'VIP'],
 *   fields: [
 *     { key: 'name', label: 'Name', type: 'text', required: true },
 *     { key: 'number', label: 'Phone Number', type: 'tel', required: true },
 *     { key: 'email', label: 'Email', type: 'email' },
 *     { key: 'company', label: 'Company', type: 'text' },
 *   ],
 *   onContactSaved: (contact) => console.log('Contact saved:', contact.name),
 * })
 *
 * // Save a contact
 * await saveContact({
 *   name: 'John Doe',
 *   number: '+1234567890',
 *   email: 'john@example.com',
 *   group: 'Sales',
 * })
 *
 * // Search contacts
 * const results = search('john')
 * ```
 */
export function useAmiDatabase(
  client: AmiClient | null,
  options: UseAmiDatabaseOptions = {}
): UseAmiDatabaseReturn {
  // ============================================================================
  // Configuration with defaults
  // ============================================================================

  const config = {
    contactFamily: options.contactFamily ?? 'contacts',
    groups: options.groups ?? ['Default'],
    fields: options.fields ?? DEFAULT_CONTACT_FIELDS,
    contactFilter: options.contactFilter,
    onContactSaved: options.onContactSaved,
    onContactDeleted: options.onContactDeleted,
    transformContact: options.transformContact,
  }

  // ============================================================================
  // State
  // ============================================================================

  const contacts = ref<Map<string, AmiContact>>(new Map())
  const groups = ref<string[]>([...config.groups])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Local key tracking (since AstDB doesn't have list keys action)
  const knownKeys = ref<Set<string>>(new Set())

  // ============================================================================
  // Computed
  // ============================================================================

  const contactList = computed(() => {
    let list = Array.from(contacts.value.values())
    if (config.contactFilter) {
      list = list.filter(config.contactFilter)
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  })

  const contactsByGroup = computed(() => {
    const grouped = new Map<string, ContactGroup>()

    // Initialize all groups
    for (const group of groups.value) {
      grouped.set(group, { name: group, contacts: [], count: 0 })
    }

    // Add contacts to groups
    for (const contact of contactList.value) {
      const group = contact.group || 'Default'
      let groupData = grouped.get(group)
      if (!groupData) {
        groupData = { name: group, contacts: [], count: 0 }
        grouped.set(group, groupData)
      }
      groupData.contacts.push(contact)
      groupData.count++
    }

    return grouped
  })

  const contactCount = computed(() => contacts.value.size)

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Generate a unique contact ID
   */
  const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Serialize contact to JSON for storage
   */
  const serializeContact = (contact: AmiContact): string => {
    return JSON.stringify(contact)
  }

  /**
   * Deserialize contact from JSON
   */
  const deserializeContact = (data: string, id: string): AmiContact | null => {
    try {
      const parsed = JSON.parse(data)
      return { ...parsed, id } as AmiContact
    } catch {
      logger.warn('Failed to parse contact data', { id, data })
      return null
    }
  }

  /**
   * Refresh contacts from AstDB
   * Note: This requires the user to maintain a list of known IDs since AstDB
   * doesn't support listing keys natively
   */
  const refresh = async (): Promise<void> => {
    if (!client) {
      error.value = 'AMI client not connected'
      return
    }

    loading.value = true
    error.value = null

    try {
      // Fetch all known contacts
      const fetchedContacts: AmiContact[] = []

      for (const id of knownKeys.value) {
        try {
          const data = await client.dbGet(config.contactFamily, id)
          if (data) {
            const contact = deserializeContact(data, id)
            if (contact) {
              // Apply filter
              if (config.contactFilter && !config.contactFilter(contact)) {
                continue
              }

              // Apply transformation - note: transformContact returns same type
              const finalContact = config.transformContact
                ? config.transformContact(contact)
                : contact

              fetchedContacts.push(finalContact)
            }
          } else {
            // Contact no longer exists
            knownKeys.value.delete(id)
          }
        } catch (err) {
          logger.warn(`Failed to fetch contact ${id}`, err)
        }
      }

      // Update state
      contacts.value.clear()
      for (const contact of fetchedContacts) {
        contacts.value.set(contact.id, contact)
      }

      logger.debug('Contacts refreshed', { count: contacts.value.size })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to refresh contacts'
      logger.error('Failed to refresh contacts', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Get a contact by ID
   */
  const getContact = async (id: string): Promise<AmiContact | null> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    // Check cache first
    const cached = contacts.value.get(id)
    if (cached) return cached

    // Fetch from DB
    const data = await client.dbGet(config.contactFamily, id)
    if (!data) return null

    const contact = deserializeContact(data, id)
    if (!contact) return null

    // Apply transformation
    const finalContact = config.transformContact
      ? config.transformContact(contact)
      : contact

    // Update cache
    contacts.value.set(id, finalContact)
    knownKeys.value.add(id)

    return finalContact
  }

  /**
   * Save a contact (create or update)
   */
  const saveContact = async (
    contactData: Omit<AmiContact, 'id'> & { id?: string }
  ): Promise<AmiContact> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    const id = contactData.id || generateId()
    const contact: AmiContact = {
      ...contactData,
      id,
    }

    // Validate required fields
    for (const field of config.fields) {
      if (field.required && !contact[field.key as keyof AmiContact]) {
        throw new Error(`Required field missing: ${field.label}`)
      }
    }

    // Serialize and save
    const data = serializeContact(contact)
    await client.dbPut(config.contactFamily, id, data)

    // Update local state
    contacts.value.set(id, contact)
    knownKeys.value.add(id)

    // Add group if new
    if (contact.group && !groups.value.includes(contact.group)) {
      groups.value.push(contact.group)
    }

    // Trigger callback
    config.onContactSaved?.(contact)

    logger.debug('Contact saved', { id, name: contact.name })
    return contact
  }

  /**
   * Delete a contact
   */
  const deleteContact = async (id: string): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    const contact = contacts.value.get(id)

    await client.dbDel(config.contactFamily, id)

    // Update local state
    contacts.value.delete(id)
    knownKeys.value.delete(id)

    // Trigger callback
    if (contact) {
      config.onContactDeleted?.(contact)
    }

    logger.debug('Contact deleted', { id })
  }

  /**
   * Search contacts by name, number, email, or notes
   */
  const search = (query: string): AmiContact[] => {
    if (!query) return contactList.value

    const q = query.toLowerCase()
    return contactList.value.filter((contact) => {
      return (
        contact.name?.toLowerCase().includes(q) ||
        contact.number?.includes(q) ||
        contact.email?.toLowerCase().includes(q) ||
        contact.company?.toLowerCase().includes(q) ||
        contact.notes?.toLowerCase().includes(q)
      )
    })
  }

  /**
   * Get contacts by group
   */
  const getByGroup = (group: string): AmiContact[] => {
    return contactList.value.filter((c) => c.group === group)
  }

  /**
   * Get available groups
   */
  const getGroups = (): string[] => [...groups.value]

  /**
   * Add a group
   */
  const addGroup = (group: string): void => {
    if (!groups.value.includes(group)) {
      groups.value.push(group)
    }
  }

  /**
   * Get field definitions
   */
  const getFieldDefinitions = (): ContactFieldDefinition[] => [...config.fields]

  /**
   * Raw DB get operation
   */
  const dbGet = async (family: string, key: string): Promise<string | null> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }
    return client.dbGet(family, key)
  }

  /**
   * Raw DB put operation
   */
  const dbPut = async (family: string, key: string, value: string): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }
    return client.dbPut(family, key, value)
  }

  /**
   * Raw DB delete operation
   */
  const dbDel = async (family: string, key: string): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }
    return client.dbDel(family, key)
  }

  /**
   * Raw DB delete tree operation
   */
  const dbDelTree = async (family: string, key?: string): Promise<void> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }
    return client.dbDelTree(family, key)
  }

  /**
   * Import contacts from array (bulk operation)
   * Useful for importing from CSV, JSON, or other sources
   */
  const importContacts = async (
    contactsToImport: Array<Omit<AmiContact, 'id'> & { id?: string }>
  ): Promise<AmiContact[]> => {
    if (!client) {
      throw new Error('AMI client not connected')
    }

    const imported: AmiContact[] = []
    const errors: Array<{ contact: typeof contactsToImport[0]; error: string }> = []

    for (const contactData of contactsToImport) {
      try {
        const saved = await saveContact(contactData)
        imported.push(saved)
      } catch (err) {
        errors.push({
          contact: contactData,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
        logger.warn('Failed to import contact', { name: contactData.name, err })
      }
    }

    if (errors.length > 0) {
      logger.warn('Some contacts failed to import', {
        imported: imported.length,
        failed: errors.length,
      })
    }

    logger.info('Contacts imported', {
      total: contactsToImport.length,
      imported: imported.length,
      failed: errors.length,
    })

    return imported
  }

  /**
   * Export all contacts as array
   * Useful for backup or export to CSV, JSON
   */
  const exportContacts = (): AmiContact[] => {
    return contactList.value
  }

  /**
   * Register a known contact ID (for external tracking)
   * Since AstDB doesn't support listing keys, external systems need to track IDs
   */
  const registerKnownId = (id: string): void => {
    knownKeys.value.add(id)
  }

  /**
   * Get known IDs (for external persistence)
   * Returns array of known contact IDs for storage in localStorage/etc
   */
  const getKnownIds = (): string[] => {
    return Array.from(knownKeys.value)
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onUnmounted(() => {
    // Nothing to clean up for database composable
  })

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    contacts,
    groups,
    loading,
    error,

    // Computed
    contactList,
    contactsByGroup,
    contactCount,

    // Methods
    refresh,
    getContact,
    saveContact,
    deleteContact,
    search,
    getByGroup,
    getGroups,
    addGroup,
    getFieldDefinitions,
    dbGet,
    dbPut,
    dbDel,
    dbDelTree,
    importContacts,
    exportContacts,
    registerKnownId,
    getKnownIds,
  }
}
