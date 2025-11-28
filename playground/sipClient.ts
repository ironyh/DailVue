/**
 * Shared SIP client instance for playground
 * This ensures all components use the same SIP client state
 */
import { EventBus } from '../src/core/EventBus'
import { useSipClient } from '../src'

// Create a shared EventBus instance
const sharedEventBus = new EventBus()

// Create and export a singleton SIP client instance
export const playgroundSipClient = useSipClient(undefined, {
  eventBus: sharedEventBus,
  autoCleanup: false, // Don't auto-cleanup since this is a shared instance
})
