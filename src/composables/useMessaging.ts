/**
 * Messaging Composable
 *
 * Provides SIP MESSAGE functionality for sending and receiving instant messages
 * via SIP protocol, with support for delivery notifications and composing indicators.
 *
 * @module composables/useMessaging
 */

import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { SipClient } from '../core/SipClient'
import {
  MessageStatus,
  MessageDirection,
  MessageContentType,
  type Message,
  type MessageSendOptions,
  type MessagingEvent,
  type ComposingIndicator,
  type MessageFilter,
} from '../types/messaging.types'
import { createLogger } from '../utils/logger'
import { validateSipUri } from '../utils/validators'
import { MESSAGING_CONSTANTS } from './constants'

const log = createLogger('useMessaging')

/**
 * Conversation thread
 */
export interface Conversation {
  /** Peer URI */
  uri: string
  /** Peer display name */
  displayName?: string
  /** Messages in conversation */
  messages: Message[]
  /** Unread count */
  unreadCount: number
  /** Last message timestamp */
  lastMessageAt: Date | null
  /** Is peer composing */
  isComposing: boolean
}

/**
 * Return type for useMessaging composable
 */
export interface UseMessagingReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  /** All messages */
  messages: Ref<Message[]>
  /** Conversations grouped by URI */
  conversations: ComputedRef<Map<string, Conversation>>
  /** Total unread message count */
  unreadCount: ComputedRef<number>
  /** Composing indicators */
  composingIndicators: Ref<Map<string, ComposingIndicator>>

  // ============================================================================
  // Methods
  // ============================================================================

  /** Send a message */
  sendMessage: (to: string, content: string, options?: MessageSendOptions) => Promise<string>
  /** Mark message as read */
  markAsRead: (messageId: string) => void
  /** Mark all messages from a URI as read */
  markAllAsRead: (uri?: string) => void
  /** Delete a message */
  deleteMessage: (messageId: string) => void
  /** Clear all messages */
  clearMessages: (uri?: string) => void
  /** Get messages for a specific URI */
  getMessagesForUri: (uri: string) => Message[]
  /** Get filtered messages */
  getFilteredMessages: (filter: MessageFilter) => Message[]
  /** Send composing indicator */
  sendComposingIndicator: (to: string, isComposing: boolean) => Promise<void>
  /** Listen for messaging events */
  onMessagingEvent: (callback: (event: MessagingEvent) => void) => () => void
}

/**
 * Messaging Composable
 *
 * Manages SIP MESSAGE functionality for instant messaging with delivery
 * notifications, read receipts, and composing indicators.
 *
 * @param sipClient - SIP client instance
 * @returns Messaging state and methods
 *
 * @example
 * ```typescript
 * const { sendMessage, messages, unreadCount } = useMessaging(sipClient)
 *
 * // Send a message
 * const messageId = await sendMessage('sip:alice@domain.com', 'Hello!')
 *
 * // Check unread count
 * console.log(`Unread messages: ${unreadCount.value}`)
 *
 * // Mark as read
 * markAllAsRead('sip:alice@domain.com')
 * ```
 */
export function useMessaging(sipClient: Ref<SipClient | null>): UseMessagingReturn {
  // ============================================================================
  // Reactive State
  // ============================================================================

  const messages = ref<Message[]>([])
  const composingIndicators = ref<Map<string, ComposingIndicator>>(new Map())
  const messagingEventListeners = ref<Array<(event: MessagingEvent) => void>>([])

  // Composing indicator timeouts
  const composingTimeouts = new Map<string, number>()

  // ============================================================================
  // Computed Values
  // ============================================================================

  const conversations = computed(() => {
    const convMap = new Map<string, Conversation>()

    messages.value.forEach((message) => {
      // Determine peer URI (the other party in the conversation)
      const peerUri = message.direction === MessageDirection.Incoming ? message.from : message.to

      let conv = convMap.get(peerUri)
      if (!conv) {
        conv = {
          uri: peerUri,
          messages: [],
          unreadCount: 0,
          lastMessageAt: null,
          isComposing: composingIndicators.value.get(peerUri)?.isComposing || false,
        }
        convMap.set(peerUri, conv)
      }

      conv.messages.push(message)

      if (!message.isRead && message.direction === MessageDirection.Incoming) {
        conv.unreadCount++
      }

      if (!conv.lastMessageAt || message.timestamp > conv.lastMessageAt) {
        conv.lastMessageAt = message.timestamp
      }
    })

    // Sort messages in each conversation by timestamp
    convMap.forEach((conv) => {
      conv.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    })

    return convMap
  })

  const unreadCount = computed(() => {
    return messages.value.filter(
      (msg) => msg.direction === MessageDirection.Incoming && !msg.isRead
    ).length
  })

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Emit messaging event
   */
  const emitMessagingEvent = (event: MessagingEvent): void => {
    log.debug('Messaging event:', event)
    messagingEventListeners.value.forEach((listener) => {
      try {
        listener(event)
      } catch (error) {
        log.error('Error in messaging event listener:', error)
      }
    })
  }

  /**
   * Handle incoming message
   */
  const handleIncomingMessage = (
    from: string,
    content: string,
    contentType: MessageContentType = MessageContentType.Text
  ): void => {
    // Validate sender URI
    const uriValidation = validateSipUri(from)
    if (!uriValidation.valid) {
      log.warn(`Invalid sender URI for incoming message: ${uriValidation.error}`, { from })
      return // Skip invalid messages
    }

    log.info(`Received message from ${from}`)

    const message: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      direction: MessageDirection.Incoming,
      from,
      to: sipClient.value?.getConfig().uri || '',
      content,
      contentType,
      status: MessageStatus.Delivered,
      timestamp: new Date(),
      deliveredAt: new Date(),
      isRead: false,
    }

    messages.value.push(message)

    // Emit event
    emitMessagingEvent({
      type: 'received',
      message,
      timestamp: new Date(),
    })

    log.debug('Message stored:', message.id)
  }

  /**
   * Handle composing indicator
   */
  const handleComposingIndicator = (from: string, isComposing: boolean): void => {
    // Validate sender URI
    const uriValidation = validateSipUri(from)
    if (!uriValidation.valid) {
      log.warn(`Invalid sender URI for composing indicator: ${uriValidation.error}`, { from })
      return // Skip invalid indicators
    }

    log.debug(`Composing indicator from ${from}: ${isComposing}`)

    const indicator: ComposingIndicator = {
      uri: from,
      isComposing,
      lastUpdated: new Date(),
      idleTimeout: MESSAGING_CONSTANTS.COMPOSING_TIMEOUT_SECONDS, // 10 seconds
    }

    composingIndicators.value.set(from, indicator)

    // Clear existing timeout
    const existingTimeout = composingTimeouts.get(from)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set timeout to auto-clear composing indicator
    if (isComposing) {
      const timeoutId = window.setTimeout(() => {
        const currentIndicator = composingIndicators.value.get(from)
        if (currentIndicator) {
          currentIndicator.isComposing = false
        }
      }, MESSAGING_CONSTANTS.COMPOSING_IDLE_TIMEOUT) // 10 seconds

      composingTimeouts.set(from, timeoutId)
    }
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  /**
   * Send a message
   *
   * Sends an instant message via SIP MESSAGE method.
   *
   * @param to - Recipient SIP URI
   * @param content - Message content
   * @param options - Send options
   * @returns Message ID
   * @throws Error if SIP client not initialized or send fails
   */
  const sendMessage = async (
    to: string,
    content: string,
    options: MessageSendOptions = {}
  ): Promise<string> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    // Validate recipient URI
    const uriValidation = validateSipUri(to)
    if (!uriValidation.valid) {
      const error = `Invalid recipient URI: ${uriValidation.error}`
      log.error(error, { to, validation: uriValidation })
      throw new Error(error)
    }

    const {
      contentType = MessageContentType.Text,
      extraHeaders,
      requestDeliveryNotification,
      requestReadNotification,
    } = options

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      log.info(`Sending message to ${to}`)

      // Create message record
      const message: Message = {
        id: messageId,
        direction: MessageDirection.Outgoing,
        from: sipClient.value.getConfig().uri,
        to,
        content,
        contentType,
        status: MessageStatus.Sending,
        timestamp: new Date(),
        isRead: true, // Outgoing messages are considered "read"
      }

      messages.value.push(message)

      // Build extra headers for notifications
      const headers = [...(extraHeaders || [])]
      if (requestDeliveryNotification) {
        headers.push('Disposition-Notification: delivery')
      }
      if (requestReadNotification) {
        headers.push('Disposition-Notification: display')
      }

      // Send message via SIP client
      await sipClient.value.sendMessage(to, content, {
        contentType,
        extraHeaders: headers,
      })

      // Update message status
      message.status = MessageStatus.Sent
      message.sentAt = new Date()

      // Emit event
      emitMessagingEvent({
        type: 'sent',
        message,
        timestamp: new Date(),
      })

      log.info(`Message sent successfully: ${messageId}`)
      return messageId
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      log.error('Failed to send message:', errorMessage)

      // Update message status
      const message = messages.value.find((m) => m.id === messageId)
      if (message) {
        message.status = MessageStatus.Failed
      }

      // Emit error event
      emitMessagingEvent({
        type: 'failed',
        message: message!,
        timestamp: new Date(),
        error: errorMessage,
      })

      throw error
    }
  }

  /**
   * Send composing indicator
   *
   * Notifies the peer that you are composing a message.
   *
   * @param to - Recipient SIP URI
   * @param isComposing - Whether currently composing
   */
  const sendComposingIndicator = async (to: string, isComposing: boolean): Promise<void> => {
    if (!sipClient.value) {
      throw new Error('SIP client not initialized')
    }

    // Validate recipient URI
    const uriValidation = validateSipUri(to)
    if (!uriValidation.valid) {
      log.warn(`Invalid recipient URI for composing indicator: ${uriValidation.error}`, { to })
      return // Don't throw, composing indicators are not critical
    }

    try {
      log.debug(`Sending composing indicator to ${to}: ${isComposing}`)

      await sipClient.value.sendMessage(to, isComposing ? 'composing' : 'idle', {
        contentType: MessageContentType.Text,
        extraHeaders: ['Content-Disposition: notification'],
      })
    } catch (error) {
      log.error('Failed to send composing indicator:', error)
      // Don't throw, composing indicators are not critical
    }
  }

  // ============================================================================
  // Message Management
  // ============================================================================

  /**
   * Mark message as read
   */
  const markAsRead = (messageId: string): void => {
    const message = messages.value.find((m) => m.id === messageId)
    if (!message) {
      log.warn(`Message ${messageId} not found`)
      return
    }

    if (message.isRead) {
      return // Already read
    }

    message.isRead = true
    message.readAt = new Date()
    message.status = MessageStatus.Read

    log.debug(`Marked message ${messageId} as read`)

    // Emit event
    emitMessagingEvent({
      type: 'read',
      message,
      timestamp: new Date(),
    })
  }

  /**
   * Mark all messages from a URI as read
   */
  const markAllAsRead = (uri?: string): void => {
    const toMark = uri
      ? messages.value.filter((m) => m.from === uri && !m.isRead)
      : messages.value.filter((m) => !m.isRead)

    toMark.forEach((message) => {
      message.isRead = true
      message.readAt = new Date()
      message.status = MessageStatus.Read
    })

    if (toMark.length > 0) {
      log.info(`Marked ${toMark.length} messages as read${uri ? ` from ${uri}` : ''}`)
    }
  }

  /**
   * Delete a message
   */
  const deleteMessage = (messageId: string): void => {
    const index = messages.value.findIndex((m) => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1)
      log.debug(`Deleted message ${messageId}`)
    }
  }

  /**
   * Clear all messages
   */
  const clearMessages = (uri?: string): void => {
    if (uri) {
      const before = messages.value.length
      messages.value = messages.value.filter((m) => m.from !== uri && m.to !== uri)
      log.info(`Cleared ${before - messages.value.length} messages from ${uri}`)
    } else {
      const count = messages.value.length
      messages.value = []
      log.info(`Cleared all ${count} messages`)
    }
  }

  /**
   * Get messages for a specific URI
   */
  const getMessagesForUri = (uri: string): Message[] => {
    return messages.value
      .filter((m) => m.from === uri || m.to === uri)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  /**
   * Get filtered messages
   */
  const getFilteredMessages = (filter: MessageFilter): Message[] => {
    let filtered = [...messages.value]

    if (filter.uri) {
      filtered = filtered.filter((m) => m.from === filter.uri || m.to === filter.uri)
    }

    if (filter.direction) {
      filtered = filtered.filter((m) => m.direction === filter.direction)
    }

    if (filter.status) {
      filtered = filtered.filter((m) => m.status === filter.status)
    }

    if (filter.contentType) {
      filtered = filtered.filter((m) => m.contentType === filter.contentType)
    }

    if (filter.dateFrom) {
      filtered = filtered.filter((m) => m.timestamp >= filter.dateFrom!)
    }

    if (filter.dateTo) {
      filtered = filtered.filter((m) => m.timestamp <= filter.dateTo!)
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase()
      filtered = filtered.filter((m) => m.content.toLowerCase().includes(query))
    }

    return filtered.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  /**
   * Listen for messaging events
   */
  const onMessagingEvent = (callback: (event: MessagingEvent) => void): (() => void) => {
    messagingEventListeners.value.push(callback)

    // Return unsubscribe function
    return () => {
      const index = messagingEventListeners.value.indexOf(callback)
      if (index !== -1) {
        messagingEventListeners.value.splice(index, 1)
      }
    }
  }

  // ============================================================================
  // SIP Client Integration
  // ============================================================================

  // Setup message reception handler
  if (sipClient.value) {
    sipClient.value.onIncomingMessage((from: string, content: string, contentType?: string) => {
      handleIncomingMessage(
        from,
        content,
        (contentType as MessageContentType) || MessageContentType.Text
      )
    })

    sipClient.value.onComposingIndicator?.((from: string, isComposing: boolean) => {
      handleComposingIndicator(from, isComposing)
    })
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onUnmounted(() => {
    log.debug('Composable unmounting, clearing composing timeouts')

    // Clear all composing timeouts
    composingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId))
    composingTimeouts.clear()

    // Clear event listeners
    messagingEventListeners.value = []
  })

  // ============================================================================
  // Return Public API
  // ============================================================================

  return {
    // State
    messages,
    conversations,
    unreadCount,
    composingIndicators,

    // Methods
    sendMessage,
    markAsRead,
    markAllAsRead,
    deleteMessage,
    clearMessages,
    getMessagesForUri,
    getFilteredMessages,
    sendComposingIndicator,
    onMessagingEvent,
  }
}
