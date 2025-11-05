/**
 * Messaging type definitions
 * @packageDocumentation
 */

/**
 * Message status enumeration
 */
export enum MessageStatus {
  /** Message is pending */
  Pending = 'pending',
  /** Message is being sent */
  Sending = 'sending',
  /** Message was sent successfully */
  Sent = 'sent',
  /** Message was delivered */
  Delivered = 'delivered',
  /** Message was read */
  Read = 'read',
  /** Message failed to send */
  Failed = 'failed',
}

/**
 * Message direction
 */
export enum MessageDirection {
  /** Incoming message */
  Incoming = 'incoming',
  /** Outgoing message */
  Outgoing = 'outgoing',
}

/**
 * Message content type
 */
export enum MessageContentType {
  /** Plain text */
  Text = 'text/plain',
  /** HTML content */
  HTML = 'text/html',
  /** JSON data */
  JSON = 'application/json',
  /** Custom content type */
  Custom = 'custom',
}

/**
 * Message interface
 */
export interface Message {
  /** Message ID */
  id: string
  /** Message direction */
  direction: MessageDirection
  /** Sender URI */
  from: string
  /** Recipient URI */
  to: string
  /** Message content */
  content: string
  /** Content type */
  contentType: MessageContentType
  /** Message status */
  status: MessageStatus
  /** Timestamp when message was created */
  timestamp: Date
  /** Timestamp when message was sent */
  sentAt?: Date
  /** Timestamp when message was delivered */
  deliveredAt?: Date
  /** Timestamp when message was read */
  readAt?: Date
  /** Is message read */
  isRead: boolean
  /** Custom metadata */
  metadata?: Record<string, any>
}

/**
 * Message send options
 */
export interface MessageSendOptions {
  /** Content type */
  contentType?: MessageContentType
  /** Custom SIP headers */
  extraHeaders?: string[]
  /** Request delivery notification */
  requestDeliveryNotification?: boolean
  /** Request read notification */
  requestReadNotification?: boolean
}

/**
 * Messaging event
 */
export interface MessagingEvent {
  /** Event type */
  type: 'received' | 'sent' | 'failed' | 'delivered' | 'read'
  /** Message */
  message: Message
  /** Timestamp */
  timestamp: Date
  /** Error message (if failed) */
  error?: string
}

/**
 * Composing indicator
 */
export interface ComposingIndicator {
  /** User URI */
  uri: string
  /** Is composing */
  isComposing: boolean
  /** Last updated */
  lastUpdated: Date
  /** Idle timeout */
  idleTimeout?: number
}

/**
 * Message filter options
 */
export interface MessageFilter {
  /** Filter by URI */
  uri?: string
  /** Filter by direction */
  direction?: MessageDirection
  /** Filter by status */
  status?: MessageStatus
  /** Filter by date range */
  dateFrom?: Date
  /** Filter by date range */
  dateTo?: Date
  /** Filter by content type */
  contentType?: MessageContentType
  /** Search query */
  searchQuery?: string
}
