/**
 * SIP-specific type definitions
 * @packageDocumentation
 */

/**
 * SIP URI type with utility methods
 */
export interface SipUri {
  /** The complete SIP URI (e.g., 'sip:user@domain.com') */
  uri: string
  /** Scheme (sip or sips) */
  scheme: 'sip' | 'sips'
  /** Username part */
  user: string
  /** Host/domain part */
  host: string
  /** Port number (optional) */
  port?: number
  /** Display name (optional) */
  displayName?: string
  /** URI parameters */
  parameters?: Record<string, string>
  /** URI headers */
  headers?: Record<string, string>

  /** Convert to string representation */
  toString(): string
  /** Clone the SIP URI */
  clone(): SipUri
}

/**
 * Registration state for the SIP client
 */
export enum RegistrationState {
  /** Not registered */
  Unregistered = 'unregistered',
  /** Registration in progress */
  Registering = 'registering',
  /** Successfully registered */
  Registered = 'registered',
  /** Registration failed */
  RegistrationFailed = 'registration_failed',
  /** Unregistration in progress */
  Unregistering = 'unregistering',
}

/**
 * Connection state for the WebSocket transport
 */
export enum ConnectionState {
  /** Disconnected from server */
  Disconnected = 'disconnected',
  /** Connecting to server */
  Connecting = 'connecting',
  /** Connected to server */
  Connected = 'connected',
  /** Connection failed */
  ConnectionFailed = 'connection_failed',
  /** Connection error */
  Error = 'error',
  /** Reconnecting to server */
  Reconnecting = 'reconnecting',
}

/**
 * SIP methods as defined in RFC 3261
 */
export enum SipMethod {
  INVITE = 'INVITE',
  ACK = 'ACK',
  BYE = 'BYE',
  CANCEL = 'CANCEL',
  REGISTER = 'REGISTER',
  OPTIONS = 'OPTIONS',
  INFO = 'INFO',
  UPDATE = 'UPDATE',
  PRACK = 'PRACK',
  SUBSCRIBE = 'SUBSCRIBE',
  NOTIFY = 'NOTIFY',
  PUBLISH = 'PUBLISH',
  MESSAGE = 'MESSAGE',
  REFER = 'REFER',
}

/**
 * SIP response codes
 */
export enum SipResponseCode {
  // 1xx - Provisional
  Trying = 100,
  Ringing = 180,
  CallIsBeingForwarded = 181,
  Queued = 182,
  SessionProgress = 183,

  // 2xx - Success
  OK = 200,
  Accepted = 202,

  // 3xx - Redirection
  MultipleChoices = 300,
  MovedPermanently = 301,
  MovedTemporarily = 302,
  UseProxy = 305,
  AlternativeService = 380,

  // 4xx - Client Error
  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  NotAcceptable = 406,
  ProxyAuthenticationRequired = 407,
  RequestTimeout = 408,
  Gone = 410,
  RequestEntityTooLarge = 413,
  RequestURITooLong = 414,
  UnsupportedMediaType = 415,
  UnsupportedURIScheme = 416,
  BadExtension = 420,
  ExtensionRequired = 421,
  IntervalTooBrief = 423,
  TemporarilyUnavailable = 480,
  CallTransactionDoesNotExist = 481,
  LoopDetected = 482,
  TooManyHops = 483,
  AddressIncomplete = 484,
  Ambiguous = 485,
  BusyHere = 486,
  RequestTerminated = 487,
  NotAcceptableHere = 488,
  RequestPending = 491,
  Undecipherable = 493,

  // 5xx - Server Error
  ServerInternalError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  ServerTimeout = 504,
  VersionNotSupported = 505,
  MessageTooLarge = 513,

  // 6xx - Global Failure
  BusyEverywhere = 600,
  Decline = 603,
  DoesNotExistAnywhere = 604,
  NotAcceptableAnywhere = 606,
}

/**
 * Authentication challenge information
 */
export interface AuthenticationChallenge {
  /** Authentication realm */
  realm: string
  /** Nonce value */
  nonce: string
  /** Quality of protection */
  qop?: string
  /** Opaque value */
  opaque?: string
  /** Algorithm (default: MD5) */
  algorithm?: 'MD5' | 'SHA-256'
  /** Stale flag */
  stale?: boolean
}

/**
 * Authentication credentials
 */
export interface AuthenticationCredentials {
  /** Username */
  username: string
  /** Password */
  password?: string
  /** HA1 hash (alternative to password) */
  ha1?: string
  /** Realm */
  realm?: string
}

/**
 * SIP event base interface
 */
export interface SipEvent {
  /** Event type */
  type: string
  /** Timestamp when the event occurred */
  timestamp: Date
  /** Additional event data */
  data?: any
}

/**
 * SIP registration event
 */
export interface RegistrationEvent extends SipEvent {
  type: 'registration' | 'unregistration' | 'registrationFailed'
  /** Registration state */
  state: RegistrationState
  /** Response code */
  responseCode?: SipResponseCode
  /** Reason phrase */
  reasonPhrase?: string
  /** Expiry time in seconds */
  expires?: number
}

/**
 * SIP connection event
 */
export interface ConnectionEvent extends SipEvent {
  type: 'connected' | 'disconnected' | 'connectionFailed'
  /** Connection state */
  state: ConnectionState
  /** Error message if applicable */
  error?: string
  /** Retry attempt number */
  retryAttempt?: number
}

/**
 * SIP message options
 */
export interface SipMessageOptions {
  /** Content type (default: 'text/plain') */
  contentType?: string
  /** Custom headers */
  extraHeaders?: string[]
  /** Event handlers */
  eventHandlers?: {
    succeeded?: (response: any) => void
    failed?: (response: any) => void
  }
}
