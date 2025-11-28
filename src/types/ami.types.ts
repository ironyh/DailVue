/**
 * AMI (Asterisk Manager Interface) WebSocket Types
 * For use with amiws proxy: https://github.com/staskobzar/amiws
 * @packageDocumentation
 */

/**
 * AMI WebSocket connection configuration
 */
export interface AmiConfig {
  /** WebSocket URL to amiws proxy (e.g., 'ws://pbx.example.com:8080') */
  url: string
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean
  /** Reconnect delay in ms (default: 3000) */
  reconnectDelay?: number
  /** Max reconnect attempts (default: 5, 0 = infinite) */
  maxReconnectAttempts?: number
  /** Connection timeout in ms (default: 10000) */
  connectionTimeout?: number
}

/**
 * AMI message types from amiws
 */
export enum AmiMessageType {
  /** Unknown message type */
  Unknown = 0,
  /** AMI protocol ID message */
  ProtocolID = 1,
  /** Peer connection status */
  PeerStatus = 2,
  /** AMI Event */
  Event = 3,
  /** AMI Response */
  Response = 4,
  /** Queue update */
  Queue = 5,
  /** Disconnect notification */
  Disconnect = 6,
}

/**
 * Base AMI action (sent to server)
 */
export interface AmiAction {
  /** AMI action name */
  Action: string
  /** Optional action ID for tracking responses */
  ActionID?: string
  /** Target specific AMI server (for multi-server setups) */
  AMIServerID?: number
  /** Additional action parameters */
  [key: string]: string | number | string[] | undefined
}

/**
 * AMI message wrapper from amiws
 */
export interface AmiMessage<T = Record<string, string>> {
  /** Message type (see AmiMessageType) */
  type: AmiMessageType
  /** Server ID in multi-server setup */
  server_id: number
  /** Server hostname */
  server_name: string
  /** Whether SSL is enabled */
  ssl: boolean
  /** AMI event/response data */
  data: T
}

/**
 * AMI Response data
 */
export interface AmiResponseData {
  /** Response status (Success, Error, etc.) */
  Response: string
  /** Action ID if provided */
  ActionID?: string
  /** Error message if failed */
  Message?: string
  /** Additional response fields */
  [key: string]: string | undefined
}

/**
 * AMI Event data
 */
export interface AmiEventData {
  /** Event name */
  Event: string
  /** Additional event fields */
  [key: string]: string | undefined
}

/**
 * Presence state response from AMI PresenceState action
 */
export interface AmiPresenceStateResponse extends AmiResponseData {
  /** Presence state (available, away, dnd, etc.) */
  State?: string
  /** Presence subtype */
  Subtype?: string
  /** Custom message */
  Message?: string
}

/**
 * Presence state change event
 */
export interface AmiPresenceStateChangeEvent extends AmiEventData {
  Event: 'PresenceStateChange'
  /** Presence provider (e.g., CustomPresence:1000) */
  Presentity: string
  /** New state */
  State: string
  /** Subtype */
  Subtype?: string
  /** Custom message */
  Message?: string
}

/**
 * Extension state event
 */
export interface AmiExtensionStatusEvent extends AmiEventData {
  Event: 'ExtensionStatus'
  /** Extension number */
  Exten: string
  /** Context */
  Context: string
  /** Hint string */
  Hint: string
  /** Device state status code */
  Status: string
  /** Human-readable status */
  StatusText: string
}

/**
 * AMI connection state
 */
export enum AmiConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Failed = 'failed',
}

/**
 * AMI client events
 */
export interface AmiClientEvents {
  connected: () => void
  disconnected: (reason?: string) => void
  error: (error: Error) => void
  message: (message: AmiMessage) => void
  event: (event: AmiMessage<AmiEventData>) => void
  response: (response: AmiMessage<AmiResponseData>) => void
  presenceChange: (event: AmiMessage<AmiPresenceStateChangeEvent>) => void
  // Queue events
  queueMemberStatus: (event: AmiMessage<AmiQueueMemberStatusEvent>) => void
  queueCallerJoin: (event: AmiMessage<AmiQueueCallerJoinEvent>) => void
  queueCallerLeave: (event: AmiMessage<AmiQueueCallerLeaveEvent>) => void
  queueCallerAbandon: (event: AmiMessage<AmiQueueCallerAbandonEvent>) => void
  // Channel events
  newChannel: (event: AmiMessage<AmiNewChannelEvent>) => void
  hangup: (event: AmiMessage<AmiHangupEvent>) => void
  newState: (event: AmiMessage<AmiNewStateEvent>) => void
  // Peer events
  peerStatus: (event: AmiMessage<AmiPeerStatusEvent>) => void
}

// ============================================================================
// Queue Types
// ============================================================================

/**
 * Queue member status codes from Asterisk
 */
export enum QueueMemberStatus {
  Unknown = 0,
  NotInUse = 1,
  InUse = 2,
  Busy = 3,
  Invalid = 4,
  Unavailable = 5,
  Ringing = 6,
  RingInUse = 7,
  OnHold = 8,
}

/**
 * Queue member status labels (configurable)
 */
export const DEFAULT_QUEUE_MEMBER_STATUS_LABELS: Record<number, string> = {
  [QueueMemberStatus.Unknown]: 'Unknown',
  [QueueMemberStatus.NotInUse]: 'Available',
  [QueueMemberStatus.InUse]: 'In Use',
  [QueueMemberStatus.Busy]: 'Busy',
  [QueueMemberStatus.Invalid]: 'Invalid',
  [QueueMemberStatus.Unavailable]: 'Unavailable',
  [QueueMemberStatus.Ringing]: 'Ringing',
  [QueueMemberStatus.RingInUse]: 'Ring In Use',
  [QueueMemberStatus.OnHold]: 'On Hold',
}

/**
 * Default pause reasons (configurable)
 */
export const DEFAULT_PAUSE_REASONS = [
  'Break',
  'Lunch',
  'Meeting',
  'Training',
  'Other',
]

/**
 * Queue information from QueueParams event
 */
export interface QueueInfo {
  /** Queue name */
  name: string
  /** Queue strategy (ringall, leastrecent, fewestcalls, etc.) */
  strategy: string
  /** Number of calls waiting */
  calls: number
  /** Average hold time in seconds */
  holdtime: number
  /** Average talk time in seconds */
  talktime: number
  /** Completed calls */
  completed: number
  /** Abandoned calls */
  abandoned: number
  /** Service level performance (percentage) */
  serviceLevelPerf: number
  /** Secondary service level performance */
  serviceLevelPerf2: number
  /** Queue weight */
  weight: number
  /** Queue members */
  members: QueueMember[]
  /** Callers waiting in queue */
  entries: QueueEntry[]
  /** Server ID (for multi-server) */
  serverId?: number
  /** Last updated timestamp */
  lastUpdated: Date
}

/**
 * Queue member information
 */
export interface QueueMember {
  /** Queue name */
  queue: string
  /** Member name */
  name: string
  /** Member interface (e.g., SIP/1001) */
  interface: string
  /** State interface for device state */
  stateInterface: string
  /** Membership type */
  membership: 'static' | 'dynamic' | 'realtime'
  /** Penalty (lower = higher priority) */
  penalty: number
  /** Calls taken */
  callsTaken: number
  /** Last call timestamp (Unix epoch seconds, 0 if never) */
  lastCall: number
  /** Last pause timestamp (Unix epoch seconds, 0 if never) */
  lastPause: number
  /** Login time (Unix epoch seconds, 0 if not logged in) */
  loginTime: number
  /** Whether currently in a call */
  inCall: boolean
  /** Current status code */
  status: QueueMemberStatus
  /** Human-readable status */
  statusLabel: string
  /** Whether paused */
  paused: boolean
  /** Pause reason if paused */
  pausedReason?: string
  /** Wrapup time in seconds */
  wrapupTime?: number
  /** Ring in use flag */
  ringinuse: boolean
  /** Server ID (for multi-server) */
  serverId?: number
}

/**
 * Queue entry (caller waiting)
 */
export interface QueueEntry {
  /** Queue name */
  queue: string
  /** Position in queue (1-based) */
  position: number
  /** Channel name */
  channel: string
  /** Unique ID */
  uniqueId: string
  /** Linked ID (optional, may not be present in join events) */
  linkedId?: string
  /** Caller ID number */
  callerIdNum: string
  /** Caller ID name */
  callerIdName: string
  /** Connected line number */
  connectedLineNum: string
  /** Connected line name */
  connectedLineName: string
  /** Wait time in seconds */
  wait: number
  /** Priority */
  priority: number
  /** Server ID (for multi-server) */
  serverId?: number
  /** Join timestamp (optional) */
  joinTime?: Date
}

/**
 * Queue summary (from QueueSummary action)
 */
export interface QueueSummary {
  /** Queue name */
  queue: string
  /** Logged in agents */
  loggedIn: number
  /** Available agents */
  available: number
  /** Callers waiting */
  callers: number
  /** Hold time */
  holdtime: number
  /** Talk time */
  talktime: number
  /** Longest hold time */
  longestHoldTime: number
}

// Queue Events

export interface AmiQueueParamsEvent extends AmiEventData {
  Event: 'QueueParams'
  Queue: string
  Max: string
  Strategy: string
  Calls: string
  Holdtime: string
  TalkTime: string
  Completed: string
  Abandoned: string
  ServiceLevel: string
  ServiceLevelPerf: string
  ServiceLevelPerf2: string
  Weight: string
}

export interface AmiQueueMemberEvent extends AmiEventData {
  Event: 'QueueMember'
  Queue: string
  Name: string
  Location: string
  StateInterface: string
  Membership: string
  Penalty: string
  CallsTaken: string
  LastCall: string
  LastPause: string
  LoginTime: string
  InCall: string
  Status: string
  Paused: string
  PausedReason?: string
  Ringinuse: string
}

export interface AmiQueueEntryEvent extends AmiEventData {
  Event: 'QueueEntry'
  Queue: string
  Position: string
  Channel: string
  Uniqueid: string
  Linkedid: string
  CallerIDNum: string
  CallerIDName: string
  ConnectedLineNum: string
  ConnectedLineName: string
  Wait: string
  Priority: string
}

export interface AmiQueueMemberStatusEvent extends AmiEventData {
  Event: 'QueueMemberStatus'
  Queue: string
  MemberName: string
  Interface: string
  StateInterface: string
  Membership: string
  Penalty: string
  CallsTaken: string
  LastCall: string
  LastPause: string
  LoginTime: string
  InCall: string
  Status: string
  Paused: string
  PausedReason?: string
  Ringinuse: string
}

export interface AmiQueueCallerJoinEvent extends AmiEventData {
  Event: 'QueueCallerJoin'
  Queue: string
  Position: string
  Channel: string
  Uniqueid: string
  CallerIDNum: string
  CallerIDName: string
  ConnectedLineNum: string
  ConnectedLineName: string
}

export interface AmiQueueCallerLeaveEvent extends AmiEventData {
  Event: 'QueueCallerLeave'
  Queue: string
  Position: string
  Channel: string
  Uniqueid: string
  CallerIDNum: string
  CallerIDName: string
  ConnectedLineNum: string
  ConnectedLineName: string
  Count: string
}

export interface AmiQueueCallerAbandonEvent extends AmiEventData {
  Event: 'QueueCallerAbandon'
  Queue: string
  Position: string
  OriginalPosition: string
  HoldTime: string
  Channel: string
  Uniqueid: string
}

// ============================================================================
// Channel Types
// ============================================================================

/**
 * Channel state codes
 */
export enum ChannelState {
  Down = 0,
  Reserved = 1,
  OffHook = 2,
  Dialing = 3,
  Ring = 4,
  Ringing = 5,
  Up = 6,
  Busy = 7,
  DialingOffHook = 8,
  PreRing = 9,
  Unknown = 10,
}

/**
 * Channel state labels
 */
export const CHANNEL_STATE_LABELS: Record<number, string> = {
  [ChannelState.Down]: 'Down',
  [ChannelState.Reserved]: 'Reserved',
  [ChannelState.OffHook]: 'Off Hook',
  [ChannelState.Dialing]: 'Dialing',
  [ChannelState.Ring]: 'Ring',
  [ChannelState.Ringing]: 'Ringing',
  [ChannelState.Up]: 'Up',
  [ChannelState.Busy]: 'Busy',
  [ChannelState.DialingOffHook]: 'Dialing Off Hook',
  [ChannelState.PreRing]: 'Pre Ring',
  [ChannelState.Unknown]: 'Unknown',
}

/**
 * Channel information
 */
export interface ChannelInfo {
  /** Channel name (e.g., PJSIP/1001-00000001) */
  channel: string
  /** Unique ID */
  uniqueId: string
  /** Linked ID */
  linkedId: string
  /** Dialplan context */
  context: string
  /** Extension */
  exten: string
  /** Priority */
  priority: number
  /** Channel state (numeric) */
  state: ChannelState
  /** Channel state (numeric) - alias for compatibility */
  channelState: ChannelState
  /** State description */
  stateDesc: string
  /** Channel state description - alias for compatibility */
  channelStateDesc: string
  /** Caller ID number */
  callerIdNum: string
  /** Caller ID name */
  callerIdName: string
  /** Connected line number */
  connectedLineNum: string
  /** Connected line name */
  connectedLineName: string
  /** Account code */
  accountCode: string
  /** Current application */
  application?: string
  /** Application data */
  applicationData?: string
  /** Duration (can be number or string "HH:MM:SS" depending on source) */
  duration: number | string
  /** Bridged to channel */
  bridgedChannel?: string
  /** Bridge ID */
  bridgeId?: string
  /** Server ID (for multi-server) */
  serverId?: number
  /** Created timestamp */
  createdAt: Date
}

/**
 * Originate options
 */
export interface OriginateOptions {
  /** Channel to call first (e.g., PJSIP/1001) */
  channel: string
  /** Extension to dial after answer (for agent-first flow) */
  exten?: string
  /** Dialplan context */
  context?: string
  /** Dialplan priority */
  priority?: number
  /** Application to run instead of extension */
  application?: string
  /** Application data */
  data?: string
  /** Caller ID */
  callerId?: string
  /** Timeout in milliseconds */
  timeout?: number
  /** Channel variables */
  variables?: Record<string, string>
  /** Account code */
  account?: string
  /** Async originate */
  async?: boolean
  /** Early media */
  earlyMedia?: boolean
  /** Codecs */
  codecs?: string
}

/**
 * Originate result
 */
export interface OriginateResult {
  /** Whether originate was successful */
  success: boolean
  /** Channel name if successful */
  channel?: string
  /** Unique ID */
  uniqueId?: string
  /** Error message if failed */
  message?: string
  /** Response code */
  response: string
}

// Channel Events

export interface AmiNewChannelEvent extends AmiEventData {
  Event: 'Newchannel'
  Channel: string
  ChannelState: string
  ChannelStateDesc: string
  CallerIDNum: string
  CallerIDName: string
  ConnectedLineNum: string
  ConnectedLineName: string
  AccountCode: string
  Context: string
  Exten: string
  Priority: string
  Uniqueid: string
  Linkedid: string
}

export interface AmiHangupEvent extends AmiEventData {
  Event: 'Hangup'
  Channel: string
  ChannelState: string
  ChannelStateDesc: string
  CallerIDNum: string
  CallerIDName: string
  ConnectedLineNum: string
  ConnectedLineName: string
  AccountCode: string
  Context: string
  Exten: string
  Priority: string
  Uniqueid: string
  Linkedid: string
  Cause: string
  'Cause-txt': string
}

export interface AmiNewStateEvent extends AmiEventData {
  Event: 'Newstate'
  Channel: string
  ChannelState: string
  ChannelStateDesc: string
  CallerIDNum: string
  CallerIDName: string
  ConnectedLineNum: string
  ConnectedLineName: string
  Uniqueid: string
  Linkedid: string
}

export interface AmiCoreShowChannelEvent extends AmiEventData {
  Event: 'CoreShowChannel'
  Channel: string
  ChannelState: string
  ChannelStateDesc: string
  CallerIDNum: string
  CallerIDName: string
  ConnectedLineNum: string
  ConnectedLineName: string
  AccountCode: string
  Context: string
  Exten: string
  Priority: string
  Uniqueid: string
  Linkedid: string
  Application: string
  ApplicationData: string
  Duration: string
  BridgeId?: string
}

// ============================================================================
// Peer Types
// ============================================================================

/**
 * Peer status values
 */
export type PeerStatus = 'OK' | 'LAGGED' | 'UNKNOWN' | 'UNREACHABLE' | 'Unmonitored'

/**
 * Peer information
 */
export interface PeerInfo {
  /** Object name / peer name */
  objectName: string
  /** Channel type (SIP or PJSIP) */
  channelType: 'SIP' | 'PJSIP'
  /** IP address */
  ipAddress: string
  /** IP port */
  port: number
  /** Status */
  status: PeerStatus
  /** Latency in ms (if available) */
  latency?: number
  /** Whether dynamically registered */
  dynamic: boolean
  /** Force RPort */
  forceRPort: boolean
  /** Comedia */
  comedia: boolean
  /** ACL enabled */
  acl: boolean
  /** Auto-force RPort */
  autoForcerPort: boolean
  /** Auto-comedia */
  autoComedia: boolean
  /** Video support */
  videoSupport: boolean
  /** Text support */
  textSupport: boolean
  /** Realtime device */
  realtimeDevice: boolean
  /** Description */
  description?: string
  /** Server ID (for multi-server) */
  serverId?: number
  /** Last seen */
  lastSeen?: Date
}

/**
 * PJSIP endpoint info
 */
export interface PjsipEndpointInfo {
  /** Endpoint name */
  objectName: string
  /** Device state */
  deviceState: string
  /** Active channels */
  activeChannels: string
  /** Transport */
  transport?: string
  /** AOR (address of record) */
  aor?: string
  /** Contacts */
  contacts: string[]
  /** Server ID */
  serverId?: number
}

// Peer Events

export interface AmiPeerStatusEvent extends AmiEventData {
  Event: 'PeerStatus'
  ChannelType: string
  Peer: string
  PeerStatus: string
  Cause?: string
  Address?: string
  Port?: string
  Time?: string
}

export interface AmiPeerEntryEvent extends AmiEventData {
  Event: 'PeerEntry'
  ChannelType: string
  ObjectName: string
  ChanObjectType: string
  IPaddress: string
  IPport: string
  Dynamic: string
  AutoForcerport: string
  Forcerport: string
  AutoComedia: string
  Comedia: string
  VideoSupport: string
  TextSupport: string
  ACL: string
  Status: string
  RealtimeDevice: string
  Description?: string
}

// ============================================================================
// Database Types (AstDB)
// ============================================================================

/**
 * Contact stored in AstDB
 */
export interface AmiContact {
  /** Unique ID */
  id: string
  /** Contact name */
  name: string
  /** Phone number */
  number: string
  /** Email address */
  email?: string
  /** Company name */
  company?: string
  /** Group/category */
  group: string
  /** Notes */
  notes?: string
  /** Custom fields */
  customFields?: Record<string, string>
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt: Date
  /** Server ID */
  serverId?: number
}

/**
 * Contact field definition for custom fields
 */
export interface ContactFieldDefinition {
  /** Field key */
  key: string
  /** Display label */
  label: string
  /** Input type */
  type: 'text' | 'tel' | 'email' | 'textarea' | 'select'
  /** Required field */
  required?: boolean
  /** Default value */
  defaultValue?: string
  /** Options for select type */
  options?: string[]
}

/**
 * Default contact fields
 */
export const DEFAULT_CONTACT_FIELDS: ContactFieldDefinition[] = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'number', label: 'Phone', type: 'tel', required: true },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

// ============================================================================
// CDR Types
// ============================================================================

/**
 * Call disposition
 */
export type CallDisposition = 'ANSWERED' | 'NO ANSWER' | 'BUSY' | 'FAILED' | 'CONGESTION'

/**
 * Call Detail Record
 */
export interface CallDetailRecord {
  /** Unique ID */
  uniqueId: string
  /** Linked ID (for related channels) */
  linkedId: string
  /** Account code */
  accountCode: string
  /** Source (caller) */
  source: string
  /** Destination */
  destination: string
  /** Destination context */
  destinationContext: string
  /** Caller ID number */
  callerIdNum: string
  /** Caller ID name */
  callerIdName: string
  /** Source channel */
  channel: string
  /** Destination channel */
  destinationChannel: string
  /** Last application */
  lastApplication: string
  /** Last application data */
  lastData: string
  /** Start time */
  startTime: Date
  /** Answer time (if answered) */
  answerTime?: Date
  /** End time */
  endTime: Date
  /** Total duration in seconds */
  duration: number
  /** Billable seconds */
  billableSeconds: number
  /** Disposition */
  disposition: CallDisposition
  /** AMA flags */
  amaFlags: string
  /** User field */
  userField?: string
  /** Server ID */
  serverId?: number
}

// CDR Event

export interface AmiCdrEvent extends AmiEventData {
  Event: 'Cdr'
  AccountCode: string
  Source: string
  Destination: string
  DestinationContext: string
  CallerID: string
  Channel: string
  DestinationChannel: string
  LastApplication: string
  LastData: string
  StartTime: string
  AnswerTime: string
  EndTime: string
  Duration: string
  BillableSeconds: string
  Disposition: string
  AMAFlags: string
  UniqueID: string
  UserField?: string
}

// ============================================================================
// Composable Options Types
// ============================================================================

/**
 * Options for useAmiQueues composable
 */
export interface UseAmiQueuesOptions {
  /** Polling interval in ms (0 = events only) */
  pollInterval?: number
  /** Use real-time events */
  useEvents?: boolean
  /** Auto-refresh on reconnect */
  autoRefresh?: boolean
  /** Queue filter function */
  queueFilter?: (queue: QueueInfo) => boolean
  /** Member filter function */
  memberFilter?: (member: QueueMember) => boolean
  /** Custom pause reasons */
  pauseReasons?: string[]
  /** Custom member status labels */
  statusLabels?: Record<number, string>
  /** Queue update callback */
  onQueueUpdate?: (queue: QueueInfo) => void
  /** Member update callback */
  onMemberUpdate?: (member: QueueMember, queue: string) => void
  /** Caller join callback */
  onCallerJoin?: (entry: QueueEntry, queue: string) => void
  /** Caller leave callback */
  onCallerLeave?: (entry: QueueEntry, queue: string) => void
  /** Caller abandon callback */
  onCallerAbandon?: (entry: QueueEntry, queue: string) => void
  /** Custom queue transformer */
  transformQueue?: (queue: QueueInfo) => QueueInfo
  /** Custom member transformer */
  transformMember?: (member: QueueMember) => QueueMember
}

/**
 * Active call representation
 */
export interface ActiveCall {
  /** Unique call identifier */
  uniqueId: string
  /** Channel name */
  channel: string
  /** Linked channel ID (bridged call) */
  linkedId: string
  /** Caller ID number */
  callerIdNum: string
  /** Caller ID name */
  callerIdName: string
  /** Connected line number */
  connectedLineNum: string
  /** Connected line name */
  connectedLineName: string
  /** Channel state */
  state: ChannelState
  /** State description */
  stateDesc: string
  /** Call start time */
  startTime: Date
  /** Duration in seconds */
  duration: number
  /** Application handling the call */
  application?: string
  /** Server ID for multi-server setups */
  serverId?: number
}

/**
 * Options for useAmiCalls composable
 */
export interface UseAmiCallsOptions {
  /** Default dialplan context */
  defaultContext?: string
  /** Polling interval */
  pollInterval?: number
  /** Use events */
  useEvents?: boolean
  /** Agent-first call flow */
  agentFirst?: boolean
  /** Dial timeout in ms */
  dialTimeout?: number
  /** Channel filter */
  channelFilter?: (channel: ChannelInfo) => boolean
  /** Custom state labels */
  stateLabels?: Record<number, string>
  /** Call start callback */
  onCallStart?: (call: ActiveCall) => void
  /** Call end callback */
  onCallEnd?: (call: ActiveCall) => void
  /** Call state change callback */
  onCallStateChange?: (call: ActiveCall, oldState: ChannelState) => void
  /** Transform channel function */
  transformChannel?: (channel: ChannelInfo) => ChannelInfo
}

/**
 * Options for useAmiSupervisor composable
 */
export interface UseAmiSupervisorOptions {
  /** Dialplan context for supervisor */
  supervisorContext?: string
  /** Dial timeout in ms */
  dialTimeout?: number
  /** ChanSpy mode options */
  chanspyOptions?: {
    silentMode?: string
    whisperMode?: string
    bargeMode?: string
  }
  /** Session start callback - receives the full session object */
  onSessionStart?: (session: {
    id: string
    supervisorChannel: string
    targetChannel: string
    mode: string
    startTime: Date
    serverId?: number
  }) => void
  /** Session end callback - receives the full session object */
  onSessionEnd?: (session: {
    id: string
    supervisorChannel: string
    targetChannel: string
    mode: string
    startTime: Date
    serverId?: number
  }) => void
}

/**
 * Options for useAmiPeers composable
 */
export interface UseAmiPeersOptions {
  /** Polling interval in ms (0 = no polling) */
  pollInterval?: number
  /** Use real-time events */
  useEvents?: boolean
  /** Include SIP peers */
  includeSip?: boolean
  /** Include PJSIP peers */
  includePjsip?: boolean
  /** Peer filter function */
  peerFilter?: (peer: PeerInfo) => boolean
  /** Patterns that indicate online status */
  onlineStatusPatterns?: string[]
  /** Peer update callback */
  onPeerUpdate?: (peer: PeerInfo) => void
  /** Transform peer function */
  transformPeer?: (peer: PeerInfo) => PeerInfo
}

/**
 * Options for useAmiDatabase composable
 */
export interface UseAmiDatabaseOptions {
  /** AstDB family for contacts */
  contactFamily?: string
  /** Default groups */
  groups?: string[]
  /** Contact field definitions */
  fields?: ContactFieldDefinition[]
  /** Contact filter function */
  contactFilter?: (contact: AmiContact) => boolean
  /** Contact saved callback */
  onContactSaved?: (contact: AmiContact) => void
  /** Contact deleted callback */
  onContactDeleted?: (contact: AmiContact) => void
  /** Transform contact function */
  transformContact?: (contact: AmiContact) => AmiContact
}
