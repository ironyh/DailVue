/**
 * E2E Test Selectors
 *
 * Centralized test selectors to avoid hardcoded strings and typos
 */

export const SELECTORS = {
  // Main app
  SIP_CLIENT: '[data-testid="sip-client"]',

  // Status indicators
  CONNECTION_STATUS: '[data-testid="connection-status"]',
  REGISTRATION_STATUS: '[data-testid="registration-status"]',
  CALL_STATUS: '[data-testid="call-status"]',

  // Settings
  SETTINGS_BUTTON: '[data-testid="settings-button"]',
  SIP_URI_INPUT: '[data-testid="sip-uri-input"]',
  PASSWORD_INPUT: '[data-testid="password-input"]',
  SERVER_URI_INPUT: '[data-testid="server-uri-input"]',
  SAVE_SETTINGS_BUTTON: '[data-testid="save-settings-button"]',
  SETTINGS_SAVED_MESSAGE: '[data-testid="settings-saved-message"]',
  VALIDATION_ERROR: '[data-testid="validation-error"]',

  // Connection
  CONNECT_BUTTON: '[data-testid="connect-button"]',
  DISCONNECT_BUTTON: '[data-testid="disconnect-button"]',

  // Dialpad
  DIALPAD_INPUT: '[data-testid="dialpad-input"]',
  CALL_BUTTON: '[data-testid="call-button"]',
  DIALPAD_TOGGLE: '[data-testid="dialpad-toggle"]',

  // DTMF
  DTMF_1: '[data-testid="dtmf-1"]',
  DTMF_2: '[data-testid="dtmf-2"]',
  DTMF_3: '[data-testid="dtmf-3"]',
  DTMF_4: '[data-testid="dtmf-4"]',
  DTMF_5: '[data-testid="dtmf-5"]',
  DTMF_6: '[data-testid="dtmf-6"]',
  DTMF_7: '[data-testid="dtmf-7"]',
  DTMF_8: '[data-testid="dtmf-8"]',
  DTMF_9: '[data-testid="dtmf-9"]',
  DTMF_0: '[data-testid="dtmf-0"]',
  DTMF_STAR: '[data-testid="dtmf-*"]',
  DTMF_HASH: '[data-testid="dtmf-#"]',
  DTMF_FEEDBACK: '[data-testid="dtmf-feedback"]',

  // Call controls
  ACTIVE_CALL: '[data-testid="active-call"]',
  ANSWER_BUTTON: '[data-testid="answer-button"]',
  REJECT_BUTTON: '[data-testid="reject-button"]',
  HANGUP_BUTTON: '[data-testid="hangup-button"]',
  HOLD_BUTTON: '[data-testid="hold-button"]',
  UNHOLD_BUTTON: '[data-testid="unhold-button"]',
  MUTE_AUDIO_BUTTON: '[data-testid="mute-audio-button"]',
  TOGGLE_VIDEO_BUTTON: '[data-testid="toggle-video-button"]',

  // Call transfer
  TRANSFER_BUTTON: '[data-testid="transfer-button"]',
  TRANSFER_INPUT: '[data-testid="transfer-input"]',
  CONFIRM_TRANSFER_BUTTON: '[data-testid="confirm-transfer-button"]',
  TRANSFER_STATUS: '[data-testid="transfer-status"]',

  // Media status
  AUDIO_STATUS: '[data-testid="audio-status"]',
  VIDEO_STATUS: '[data-testid="video-status"]',

  // Call history
  CALL_HISTORY_BUTTON: '[data-testid="call-history-button"]',
  CALL_HISTORY_PANEL: '[data-testid="call-history-panel"]',
  HISTORY_ENTRY: '[data-testid="history-entry"]',

  // Device settings
  DEVICE_SETTINGS_BUTTON: '[data-testid="device-settings-button"]',
  AUDIO_INPUT_SELECT: '[data-testid="audio-input-select"]',
  AUDIO_OUTPUT_SELECT: '[data-testid="audio-output-select"]',
  DEVICE_CHANGED_MESSAGE: '[data-testid="device-changed-message"]',

  // Incoming call
  INCOMING_CALL_NOTIFICATION: '[data-testid="incoming-call-notification"]',

  // Errors
  ERROR_MESSAGE: '[data-testid="error-message"]',
  REGISTRATION_ERROR: '[data-testid="registration-error"]',
  INITIALIZATION_ERROR: '[data-testid="initialization-error"]',
} as const

/**
 * Helper function to get a DTMF selector by digit
 */
export function getDTMFSelector(digit: string): string {
  const key = `DTMF_${digit === '*' ? 'STAR' : digit === '#' ? 'HASH' : digit}` as keyof typeof SELECTORS
  return SELECTORS[key] || `[data-testid="dtmf-${digit}"]`
}

/**
 * Common selector patterns
 */
export const SELECTOR_PATTERNS = {
  /**
   * Match text content (case-insensitive)
   */
  hasText: (text: string) => `:has-text("${text}")`,

  /**
   * Match text with regex
   */
  hasTextRegex: (pattern: RegExp) => `:has-text(/${pattern.source}/${pattern.flags})`,

  /**
   * Visible elements only
   */
  visible: ':visible',

  /**
   * Hidden elements only
   */
  hidden: ':hidden',

  /**
   * Disabled elements
   */
  disabled: ':disabled',

  /**
   * Enabled elements
   */
  enabled: ':enabled',
} as const

/**
 * Test data constants
 */
export const TEST_DATA = {
  // Valid SIP URIs
  VALID_SIP_URI: 'sip:testuser@example.com',
  VALID_SIP_URI_2: 'sip:user2@test.com',
  VALID_DESTINATION: 'sip:destination@example.com',

  // Invalid SIP URIs
  INVALID_SIP_URI_NO_SCHEME: 'testuser@example.com',
  INVALID_SIP_URI_NO_HOST: 'sip:testuser',
  INVALID_SIP_URI_EMPTY: '',

  // Valid WebSocket URIs
  VALID_WS_URI: 'wss://sip.example.com:7443',
  VALID_WS_URI_2: 'ws://localhost:5060',

  // Invalid WebSocket URIs
  INVALID_WS_URI_HTTP: 'http://example.com',
  INVALID_WS_URI_NO_SCHEME: 'example.com:7443',
  INVALID_WS_URI_EMPTY: '',

  // Passwords
  VALID_PASSWORD: 'testpassword',
  SHORT_PASSWORD: 'abc',
  EMPTY_PASSWORD: '',

  // Phone numbers
  PHONE_NUMBER_1: '1234567890',
  PHONE_NUMBER_2: '+15551234567',
  INVALID_PHONE_NUMBER: 'abc',
} as const
