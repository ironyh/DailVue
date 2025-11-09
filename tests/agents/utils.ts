/**
 * Agent Testing Framework Utilities
 *
 * Utility functions for validation and helper operations
 */

/**
 * Validates a SIP URI format
 *
 * Valid formats:
 * - sip:user@domain
 * - sip:user@domain:port
 * - sips:user@domain
 *
 * @param uri - The URI to validate
 * @returns true if valid, false otherwise
 */
export function isValidSipUri(uri: string): boolean {
  if (!uri || typeof uri !== 'string') {
    return false
  }

  // Basic SIP URI regex pattern
  // Supports: sip:user@domain or sips:user@domain with optional port
  const sipUriPattern = /^sips?:[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+(:\d+)?$/

  return sipUriPattern.test(uri)
}

/**
 * Validates a SIP URI and throws an error if invalid
 *
 * @param uri - The URI to validate
 * @param paramName - Name of the parameter for error messages
 * @throws Error if URI is invalid
 */
export function validateSipUri(uri: string, paramName = 'URI'): void {
  if (!isValidSipUri(uri)) {
    throw new Error(
      `Invalid SIP URI for ${paramName}: "${uri}". Expected format: sip:user@domain or sips:user@domain`
    )
  }
}

/**
 * Extracts the user part from a SIP URI
 *
 * @param uri - The SIP URI (e.g., "sip:alice@example.com")
 * @returns The user part (e.g., "alice") or null if invalid
 */
export function extractSipUser(uri: string): string | null {
  if (!isValidSipUri(uri)) {
    return null
  }

  const match = uri.match(/^sips?:([a-zA-Z0-9._-]+)@/)
  return match ? match[1] : null
}

/**
 * Extracts the domain part from a SIP URI
 *
 * @param uri - The SIP URI (e.g., "sip:alice@example.com")
 * @returns The domain part (e.g., "example.com") or null if invalid
 */
export function extractSipDomain(uri: string): string | null {
  if (!isValidSipUri(uri)) {
    return null
  }

  const match = uri.match(/@([a-zA-Z0-9.-]+)(:\d+)?$/)
  return match ? match[1] : null
}

/**
 * Creates a SIP URI from user and domain
 *
 * @param user - The user part
 * @param domain - The domain part
 * @param secure - Whether to use sips (secure) instead of sip
 * @returns The constructed SIP URI
 */
export function createSipUri(user: string, domain: string, secure = false): string {
  const scheme = secure ? 'sips' : 'sip'
  return `${scheme}:${user}@${domain}`
}

/**
 * Validates an agent ID format
 *
 * Agent IDs should be alphanumeric with optional hyphens/underscores
 *
 * @param id - The agent ID to validate
 * @returns true if valid, false otherwise
 */
export function isValidAgentId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false
  }

  // Allow alphanumeric characters, hyphens, and underscores
  const agentIdPattern = /^[a-zA-Z0-9_-]+$/

  return agentIdPattern.test(id) && id.length > 0 && id.length <= 64
}

/**
 * Validates an agent ID and throws an error if invalid
 *
 * @param id - The agent ID to validate
 * @throws Error if agent ID is invalid
 */
export function validateAgentId(id: string): void {
  if (!isValidAgentId(id)) {
    throw new Error(
      `Invalid agent ID: "${id}". Must be alphanumeric with optional hyphens/underscores, 1-64 characters long.`
    )
  }
}
