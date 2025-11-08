# Security Best Practices

This comprehensive guide covers security best practices for VueSip applications, helping you protect your VoIP communications at every layer—from encrypted transport connections to secure credential storage.

## Overview

**Why Security Matters in VoIP**

VoIP applications handle sensitive communications and user credentials. Without proper security measures, attackers could intercept calls, steal credentials, or impersonate users. VueSip implements defense-in-depth with multiple security layers working together to protect your application.

**VueSip's Multi-Layer Security Architecture:**

- **🔐 Transport Security (WSS/TLS)** - Encrypts SIP signaling messages during transmission to prevent eavesdropping
- **🎤 Media Encryption (DTLS-SRTP)** - End-to-end encryption for actual voice/video data streams
- **🔑 Credential Storage** - AES-GCM encryption protects sensitive data when stored on the device
- **✔️ Input Validation** - Prevents injection attacks and ensures data integrity
- **🛡️ Authentication** - SIP Digest authentication verifies user identity securely

Each layer protects a different aspect of your application, and together they create a robust security posture.

---

## Transport Security (WSS/TLS)

**What This Section Covers**

This section explains how to secure the SIP signaling channel—the connection that carries messages like REGISTER, INVITE, and BYE between your application and the SIP server. Without encryption, these messages are visible to anyone monitoring the network.

### Understanding WebSocket Secure (WSS)

**What is WSS?** WebSocket Secure (WSS) is the encrypted version of the WebSocket protocol. It uses TLS (Transport Layer Security) to encrypt all data transmitted between your browser and the SIP server, similar to how HTTPS protects web traffic.

**Why use WSS?** SIP messages contain sensitive information including:
- Authentication credentials (during registration)
- Call details (who's calling whom)
- Session descriptions (IP addresses, media capabilities)
- Account information

Always use WebSocket Secure (WSS) in production environments to prevent this information from being intercepted.

**✅ Recommended - Secure Connection:**

```typescript
import { useSipClient } from 'vuesip'

const { connect } = useSipClient({
  uri: 'wss://sip.example.com:7443',  // 🔒 WSS protocol = encrypted connection
  sipUri: 'sip:1000@example.com',     // Your SIP identity
  password: 'your-password'            // Sent securely over encrypted channel
})
```

**❌ Not Recommended - Insecure Connection:**

```typescript
// Only use ws:// for local development/testing on localhost
const { connect } = useSipClient({
  uri: 'ws://localhost:8088',          // ⚠️ Unencrypted - anyone on network can see traffic!
  sipUri: 'sip:1000@example.com',
  password: 'your-password'            // ⚠️ Password exposed in cleartext!
})
```

📝 **Note:** While `ws://` (unencrypted) is acceptable for local development on `localhost`, never use it when connecting to remote servers or in production environments.

### Automatic Production Environment Check

VueSip includes a built-in safety mechanism that automatically detects and warns about insecure connections in production:

```typescript
// VueSip internal check - happens automatically
if (config.uri.startsWith('ws://') && process.env.NODE_ENV === 'production') {
  // You'll see this warning in the console if you accidentally use ws:// in production
  console.warn('Using insecure WebSocket (ws://) in production. Use wss:// for secure connections.')
}
```

💡 **Tip:** Set `NODE_ENV=production` in your production builds to enable this check.

### TLS Certificate Validation

**What are TLS Certificates?** TLS certificates prove your SIP server's identity and enable encrypted connections. They're like a digital passport that verifies "this server is really sip.example.com."

**Certificate Requirements:**

✅ **Use certificates from trusted Certificate Authorities (CAs)**
   - Let's Encrypt (free, automated)
   - DigiCert, Sectigo, etc. (commercial options)

❌ **Avoid self-signed certificates in production**
   - Browsers will show security warnings
   - Man-in-the-middle attacks become easier
   - Only use for internal development/testing

📝 **Certificate Maintenance:**
   - Monitor certificate expiration dates (most expire after 90 days for Let's Encrypt)
   - Set up automated renewal
   - Test certificate renewal process in staging first

### Transport Security Best Practices

Follow these guidelines to ensure your SIP signaling remains secure:

1. **✅ Always use WSS in production** - Never use `ws://` for production deployments where real users connect
2. **✅ Use standard TLS ports** - Port 443 (HTTPS/WSS) or 7443 (dedicated WSS) for easier firewall traversal
3. **✅ Validate server certificates** - Ensure proper TLS certificate validation is enabled in browsers
4. **✅ Monitor connection security** - Log connection attempts and alert on repeated failures

---

## Media Encryption (DTLS-SRTP)

**What This Section Covers**

While WSS protects SIP signaling messages, actual audio and video streams (the "media") take a different path through the network using WebRTC. This section explains how VueSip secures these media streams so your conversations remain private.

### Understanding DTLS-SRTP Encryption

**Why Media Needs Separate Encryption**

SIP signaling and media take different paths for performance reasons. SIP messages go through the SIP server, but media streams directly between participants (peer-to-peer) for lower latency. This means we need separate encryption for media.

**How DTLS-SRTP Works:**

VueSip uses WebRTC's built-in DTLS-SRTP for media encryption. This is a two-part system:

1. **DTLS (Datagram Transport Layer Security)** - First, devices securely exchange encryption keys
   - Think of this as the "handshake" where both sides agree on how to encrypt
   - Works over UDP for real-time performance

2. **SRTP (Secure Real-time Transport Protocol)** - Then, media streams are encrypted with those keys
   - Encrypts the actual audio/video packets
   - Adds integrity checks to detect tampering

**Key Security Features:**

- **🔐 Forward Secrecy** - New encryption keys generated for each call (old calls can't be decrypted if keys are later compromised)
- **🔒 Mandatory Encryption** - WebRTC enforces encryption by default (you can't accidentally disable it)
- **🎯 End-to-End Protection** - Media encrypted from your app to the other participant

💡 **Good News:** WebRTC handles all the complex cryptography automatically. You just need to configure the connection properly!

### RTCPeerConnection Security Configuration

WebRTC automatically handles media encryption through `RTCPeerConnection`. VueSip configures this securely by default, but you can customize it:

```typescript
// MediaManager automatically creates this configuration
// This example shows what VueSip does internally
const rtcConfiguration = {
  iceServers: [
    {
      // STUN server helps find your public IP address for peer-to-peer connections
      urls: ['stun:stun.l.google.com:19302'],
    },
    {
      // TURN server relays traffic when direct connections aren't possible
      urls: ['turn:turn.example.com:3478'],
      username: 'your-username',              // Credentials for TURN server
      credential: 'your-credential',          // Usually time-limited tokens
      credentialType: 'password'              // Type of credential being used
    }
  ],
  iceTransportPolicy: 'all',    // 'all' = try direct first, use relay if needed
                                 // 'relay' = force all traffic through TURN (more secure, higher latency)
  bundlePolicy: 'balanced',      // Bundle audio/video on same connection for efficiency
  rtcpMuxPolicy: 'require'       // Multiplex RTP and RTCP on same port (required by WebRTC)
}
```

### Understanding STUN and TURN Servers

**What Problem Do They Solve?**

Most devices sit behind NAT (Network Address Translation) routers that hide their real IP addresses. STUN and TURN servers help WebRTC connections work despite NAT:

- **STUN (Session Traversal Utilities for NAT)** - Helps you discover your public IP address
  - Think of it as asking "what's my address?" to make direct connections possible
  - Used at the start of each call
  - Free public STUN servers available (like Google's)

- **TURN (Traversal Using Relays around NAT)** - Relays media when direct connections fail
  - Acts as a relay server when NAT is too restrictive
  - Required in ~8-10% of connections (strict corporate firewalls, symmetric NAT)
  - Costs bandwidth (you're paying for relayed traffic)

**Configuring STUN/TURN Servers:**

```typescript
import { useSipClient } from 'vuesip'

const { connect } = useSipClient({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'your-password',
  rtcConfiguration: {
    // STUN servers help discover public IP addresses (needed for NAT traversal)
    stunServers: [
      'stun:stun.l.google.com:19302',      // Google's public STUN server
      'stun:stun1.l.google.com:19302'      // Backup STUN server for redundancy
    ],

    // TURN servers relay media when direct connections fail (needed in restrictive networks)
    turnServers: [
      {
        urls: ['turn:turn.example.com:3478'],      // Standard TURN (UDP/TCP)
        username: 'turn-user',                      // Usually time-limited credentials
        credential: 'turn-password',                // Generated by your TURN server
        credentialType: 'password'
      },
      {
        urls: ['turns:turn.example.com:5349'],     // 🔒 TURN over TLS (more secure)
        username: 'turn-user',
        credential: 'turn-password',
        credentialType: 'password'
      }
    ],

    // Control how connections are established
    iceTransportPolicy: 'all'  // 'all' = try direct, fallback to relay
                                // 'relay' = always use TURN (maximum privacy, higher latency)
  }
})
```

⚠️ **Security Note:** TURN servers can see your media traffic (since they relay it). Use TURNS (TURN over TLS) to encrypt the relay connection itself.

### ICE Transport Policy: Balancing Security and Performance

**Understanding the Tradeoff**

The ICE transport policy controls how WebRTC establishes connections:

| Policy | Security Level | Performance | How It Works | Best For |
|--------|---------------|-------------|--------------|----------|
| `all` (default) | Good | Best | Tries direct peer-to-peer first, uses TURN relay only if needed | Normal operations, most users |
| `relay` | Maximum | Lower latency | Forces all traffic through your TURN server, no direct connections | High-security environments, enterprise |

**When to Use `relay` (Maximum Security):**

```typescript
// High-security configuration: All media goes through your TURN server
rtcConfiguration: {
  iceTransportPolicy: 'relay',  // ⚠️ Forces TURN relay for ALL connections
  turnServers: [
    {
      urls: ['turns:turn.example.com:5349'],  // Use TLS-encrypted TURN
      username: 'turn-user',
      credential: 'turn-password',
      credentialType: 'password'
    }
  ]
}
```

✅ **Use `relay` when:**
- Handling sensitive calls (legal, medical, financial)
- Corporate policy requires traffic monitoring
- Must prevent IP address disclosure
- Need to route all traffic through your infrastructure

❌ **Avoid `relay` when:**
- Latency is critical (gaming, live translation)
- TURN bandwidth costs are prohibitive
- Most users have good direct connectivity

💡 **Tip:** In `relay` mode, you must have working TURN servers or calls will fail!

### Media Encryption Best Practices

Follow these guidelines to ensure maximum media security:

1. **🔒 Use TURN over TLS (TURNS)** - Encrypts the relay connection itself with `turns://` URLs
2. **⏰ Secure TURN credentials** - Use time-limited credentials (expire after 24 hours) to limit exposure
3. **📊 Monitor ICE connection states** - Log failures to detect network issues or attacks
4. **🛡️ Prefer relay in sensitive environments** - Use `iceTransportPolicy: 'relay'` for maximum privacy

---

## Credential Storage

**What This Section Covers**

When users choose "Remember me," credentials must be stored on their device. This section explains how to store sensitive data securely using encryption, so credentials remain protected even if the device is compromised.

### Understanding Encryption at Rest

**The Problem:** Browser storage (localStorage, IndexedDB) stores data in plain text. Anyone with access to the device can read these files and steal credentials.

**The Solution:** VueSip provides built-in encryption using the Web Crypto API, a browser standard for cryptographic operations. All sensitive data is encrypted before storage and decrypted only when needed.

**Encryption Specifications:**

VueSip uses industry-standard encryption with secure defaults:

- **Algorithm**: AES-GCM (Advanced Encryption Standard - Galois/Counter Mode)
  - AES-GCM provides both encryption and integrity checking
  - 256-bit key length (strongest AES variant)
  - Widely used, hardware-accelerated in most CPUs

- **Key Derivation**: PBKDF2 (Password-Based Key Derivation Function 2) with SHA-256
  - Converts user passwords into encryption keys
  - Slow by design to prevent brute-force attacks

- **Iterations**: 100,000 (configurable, minimum recommended)
  - More iterations = slower but more secure
  - Slows down attackers trying to guess passwords

- **Salt**: Random 16-byte salt per encryption operation
  - Ensures identical passwords produce different keys
  - Prevents rainbow table attacks

- **IV**: Random 12-byte initialization vector per encryption
  - Ensures identical data produces different ciphertext
  - Prevents pattern analysis

📝 **Security Guarantee:** Even if an attacker copies your localStorage, they cannot decrypt credentials without the encryption key.

### Using Encrypted Storage

**Basic Encrypted Storage Setup:**

```typescript
import { createEncryptedAdapter } from 'vuesip'
import { LocalStorageAdapter } from 'vuesip/storage'

// Step 1: Create an encrypted storage adapter
// This wraps localStorage with AES-GCM encryption
const encryptedStorage = createEncryptedAdapter(
  new LocalStorageAdapter(),           // Base storage (where encrypted data goes)
  {
    enabled: true,                     // Enable encryption
    algorithm: 'AES-GCM',              // Encryption algorithm (only option currently)
    iterations: 100000                 // PBKDF2 iterations (minimum recommended: 100,000)
  }
)

// Step 2: Use the encrypted storage with useSipClient
const { connect } = useSipClient({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'your-password',

  storageAdapter: encryptedStorage,    // Use encrypted storage instead of default

  // 🔑 CRITICAL: The encryption key protects your data
  // Derive from user password or generate randomly
  encryptionKey: 'user-specific-key'   // See next section for proper key generation
})
```

⚠️ **Security Warning:** The `encryptionKey` is critical! If lost, encrypted data cannot be recovered. If compromised, all encrypted data can be decrypted.

### Generating Secure Encryption Keys

**Never hardcode encryption keys in your source code!** Here are secure ways to generate keys:

**Option 1: Generate Random Key (For Current Session Only)**

```typescript
import { generateEncryptionKey } from 'vuesip'

// Generate a cryptographically secure random key
const encryptionKey = generateEncryptionKey(32)  // 32 bytes = 256 bits

// ✅ GOOD: Store in memory (clears when app closes)
sessionStorage.setItem('encKey', encryptionKey)  // Available only in current tab

// ❌ BAD: Never store encryption keys in plain text!
// localStorage.setItem('encKey', encryptionKey)  // ⚠️ Defeats the purpose of encryption!
```

💡 **When to use:** Session-based logins where users re-authenticate each time

**Option 2: Derive from User Password (For Persistent Sessions)**

```typescript
import { hashPassword } from 'vuesip'

// User enters their master password
const userPassword = 'user-master-password'

// Derive encryption key using PBKDF2
// This takes the password through 100,000+ iterations of hashing
const encryptionKey = await hashPassword(userPassword)

// Use this key to encrypt/decrypt stored credentials
// The key never leaves the device and isn't stored
```

💡 **When to use:** "Remember me" functionality where users want persistent login

⚠️ **Important:** The user must enter their password each time the app loads to regenerate the encryption key. This is a security feature, not a bug!

### Choosing the Right Storage Adapter

Different storage adapters offer different tradeoffs between security, persistence, and convenience:

| Adapter | Persistence | Scope | Security Level | Use Case |
|---------|-------------|-------|----------------|----------|
| **SessionStorage** | Until tab closes | Current tab only | High | Temporary sessions, kiosks |
| **LocalStorage** | Permanent | All tabs in origin | Medium (with encryption) | Remember credentials |
| **IndexedDB** | Permanent | All tabs in origin | Medium (with encryption) | Large datasets, offline mode |
| **Memory (default)** | None | Current component | Highest | Maximum security, no persistence |

**Example 1: Session Storage (Security-First Approach)**

```typescript
import { SessionStorageAdapter } from 'vuesip/storage'

// Data automatically deleted when browser tab closes
// Best for: Public computers, shared devices, maximum security
const storage = new SessionStorageAdapter()

const { connect } = useSipClient({
  // ... config
  storageAdapter: storage  // Credentials cleared when tab closes
})
```

✅ **Best for:** Medical offices, public kiosks, shared workstations

**Example 2: Encrypted IndexedDB (Convenience with Security)**

```typescript
import { IndexedDBAdapter } from 'vuesip/storage'
import { createEncryptedAdapter, generateEncryptionKey } from 'vuesip'

// Generate or derive encryption key
const encryptionKey = generateEncryptionKey()

// Create encrypted IndexedDB storage
// Best for: Long-term storage, offline capabilities, larger datasets
const storage = createEncryptedAdapter(
  new IndexedDBAdapter('vuesip-db'),   // Database name
  {
    enabled: true,                     // Enable AES-GCM encryption
    iterations: 100000                 // PBKDF2 iterations for key derivation
  }
)

const { connect } = useSipClient({
  // ... config
  storageAdapter: storage,
  encryptionKey                        // Key needed to decrypt data later
})
```

✅ **Best for:** Personal devices, users who want "remember me" functionality

### Credential Storage Best Practices

Follow these guidelines to protect stored credentials:

1. **🔒 Never store plaintext passwords** - Always use encryption for any persistent storage
2. **🔑 Use HA1 hash when possible** - Store HA1 digests instead of passwords (see Authentication section)
3. **⏰ Minimize credential lifetime** - Clear credentials on explicit logout
4. **🗑️ Use SessionStorage for sensitive apps** - No persistence after tab close = maximum security
5. **🔐 Secure encryption keys** - Never hardcode keys in source code, never commit to git
6. **🔄 Implement key rotation** - Periodically prompt users to update their master password
7. **🚫 Never log encryption keys** - Exclude keys from error reports and analytics

💡 **Pro Tip:** For maximum security, combine encrypted storage with short-lived sessions. Require re-authentication every 24 hours even with "remember me."

---

## Authentication

**What This Section Covers**

Before making calls, your application must authenticate with the SIP server to prove the user's identity. This section explains SIP Digest Authentication and how to use it securely, including advanced techniques like HA1 hashing to avoid storing plaintext passwords.

### Understanding SIP Digest Authentication

**What is Digest Authentication?**

SIP Digest Authentication (based on HTTP Digest) is a challenge-response mechanism that proves you know the password without actually sending it over the network.

**How It Works (Simplified):**

1. **Client:** "I want to register as user 1000"
2. **Server:** "Prove it. Here's a challenge (nonce): abc123"
3. **Client:** Calculates `response = MD5(password + nonce + other data)` and sends response
4. **Server:** Calculates the same thing and compares. If they match, authentication succeeds!

**Why It's Secure:**
- Password never transmitted (only a hash)
- Nonce prevents replay attacks (old responses won't work)
- Different hash for each authentication attempt

**Standard Password Authentication:**

```typescript
const { connect } = useSipClient({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',

  // VueSip automatically handles digest authentication
  password: 'your-password',              // Password used to calculate digest response

  // Optional parameters (usually auto-configured)
  authorizationUsername: '1000',         // Username for auth (defaults to sipUri user part)
  realm: 'asterisk'                      // Authentication realm (usually provided by server)
})
```

📝 **Note:** Even though you provide a "password" parameter, VueSip never sends it directly. It's only used to calculate MD5 digests for authentication challenges.

### HA1 Hash Authentication (Advanced)

**What is HA1?**

HA1 (Hash A1) is a pre-computed hash used in SIP Digest authentication. Instead of storing the actual password, you can store this hash and use it directly for authentication.

**HA1 Formula:**
```
HA1 = MD5(username:realm:password)
```

**Why Use HA1?**

✅ **Advantages:**
- **Password never stored** - Your application only has the HA1 hash, not the actual password
- **Reduced exposure** - If your database is compromised, attackers get hashes, not passwords
- **Same security** - Works identically with SIP Digest authentication
- **Compatible** - All SIP servers support digest authentication with HA1

❌ **Limitations:**
- Realm-specific (different realm = different HA1)
- Not as strong as modern password hashing (bcrypt, argon2)
- Still vulnerable if attacker has realm name

**Using HA1 Authentication:**

```typescript
// Step 1: Pre-compute HA1 hash (typically done server-side during registration)
// ⚠️ This is just an example - in production, generate HA1 on your backend
const username = '1000'
const realm = 'asterisk'
const password = 'secret123'
const ha1 = MD5(`${username}:${realm}:${password}`)  // Example: 'b5f2a7c3d9e...'

// Step 2: Use HA1 in client configuration (instead of password)
const { connect } = useSipClient({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',

  ha1: ha1,              // 🔑 Use pre-computed HA1 hash
  realm: 'asterisk'      // ⚠️ Must match the realm used to compute HA1

  // Note: Don't provide 'password' when using 'ha1'
})
```

**Real-World Workflow:**

```typescript
// 1️⃣ User Registration (Backend)
// When user creates account, compute and store HA1
async function registerUser(username: string, password: string, realm: string) {
  const ha1 = MD5(`${username}:${realm}:${password}`)

  // Store HA1 in database (not the password!)
  await database.users.create({
    username,
    realm,
    ha1  // ✅ Only store the hash
  })

  return ha1
}

// 2️⃣ User Login (Frontend)
// Fetch HA1 from your backend API
async function loginUser(username: string) {
  // Your backend retrieves the stored HA1
  const response = await fetch(`/api/auth/ha1?username=${username}`)
  const { ha1, realm } = await response.json()

  // Use HA1 to configure SIP client
  const { connect } = useSipClient({
    uri: 'wss://sip.example.com:7443',
    sipUri: `sip:${username}@example.com`,
    ha1,        // Use pre-computed hash
    realm       // Must match
  })

  await connect()
}
```

💡 **Best Practice:** Compute HA1 on your backend during user registration. Never compute it on the frontend where password could be intercepted.

### Authentication Best Practices

Follow these guidelines for secure authentication:

1. **🔑 Use HA1 when possible** - Avoid storing plaintext passwords in your system
2. **✅ Validate server challenges** - Ensure 401/407 responses have valid nonce and realm
3. **📊 Monitor auth failures** - Log failed authentication attempts and alert on repeated failures (potential brute force)
4. **⏱️ Implement rate limiting** - Limit authentication attempts to prevent brute force attacks (e.g., 5 attempts per 15 minutes)
5. **🔐 Use strong passwords** - Require minimum 12 characters with mixed case, numbers, and symbols
6. **🔄 Rotate credentials** - Encourage periodic password changes
7. **🚫 Never log passwords or HA1** - Exclude from logs, error reports, and analytics

⚠️ **Security Warning:** Even with HA1, use encrypted storage (see Credential Storage section) to protect the hash itself!

---

## Input Validation

**What This Section Covers**

User input is the primary attack vector for web applications. This section explains how to validate all inputs using VueSip's built-in validators to prevent injection attacks, crashes, and data corruption.

**Why Input Validation Matters:**

Without validation, malicious users could:
- Inject malicious SIP headers
- Cause application crashes with malformed data
- Bypass security checks
- Trigger unexpected behavior

VueSip provides comprehensive validators for all input types. **Always validate before use!**

### SIP URI Validation

**What is a SIP URI?** A SIP URI (like `sip:user@example.com`) identifies users and servers in SIP networks, similar to email addresses.

**Why Validate?** Malformed SIP URIs can cause registration failures, call setup errors, or even security vulnerabilities.

```typescript
import { validateSipUri } from 'vuesip'

// Validate user input before using it
const userInput = 'sip:1000@example.com'
const result = validateSipUri(userInput)

if (result.valid) {
  // ✅ Safe to use - URI has been validated and normalized
  console.log('Valid SIP URI:', result.normalized)
  // Output: sip:1000@example.com

  await makeCall(result.normalized)  // Use normalized version
} else {
  // ❌ Invalid - show error to user
  console.error('Invalid SIP URI:', result.error)
  showErrorMessage(`Invalid SIP address: ${result.error}`)
}
```

**Validation Rules:**
- ✅ Must start with `sip:` or `sips:` (secure SIP)
- ✅ Must include user part (before @) and domain part (after @)
- ✅ Port must be between 1-65535 if specified
- ✅ Domain automatically normalized to lowercase
- ✅ Special characters properly encoded

**Valid Examples:**
```typescript
validateSipUri('sip:1000@example.com')           // ✅ Basic format
validateSipUri('sip:user@example.com:5060')      // ✅ With port
validateSipUri('sips:secure@example.com')        // ✅ Secure SIP
validateSipUri('sip:john.doe@sip.example.com')   // ✅ With subdomain
```

**Invalid Examples:**
```typescript
validateSipUri('1000@example.com')               // ❌ Missing sip: scheme
validateSipUri('sip:1000')                       // ❌ Missing domain
validateSipUri('http://example.com')             // ❌ Wrong protocol
```

### Phone Number Validation

**What is E.164?** E.164 is the international standard for phone numbers (like `+14155551234`). The format ensures phone numbers work globally.

```typescript
import { validatePhoneNumber } from 'vuesip'

// Validate phone number input
const userInput = '+14155551234'
const result = validatePhoneNumber(userInput)

if (result.valid) {
  // ✅ Valid E.164 phone number
  console.log('Valid phone number:', result.normalized)
  // Can be used to construct SIP URI: sip:+14155551234@provider.com

  const sipUri = `sip:${result.normalized}@pstn.example.com`
  await makeCall(sipUri)
} else {
  // ❌ Invalid phone number
  console.error('Invalid phone number:', result.error)
  showErrorMessage('Please enter a valid phone number with country code')
}
```

**E.164 Format Rules:**
- ✅ Must start with `+` (plus sign indicates international format)
- ✅ Followed by country code (1-3 digits, e.g., +1 for US/Canada)
- ✅ Followed by national number
- ✅ Maximum 15 digits total (including country code)
- ✅ Only digits after the +, no spaces or separators

**Valid Examples:**
```typescript
validatePhoneNumber('+14155551234')     // ✅ US number
validatePhoneNumber('+442071234567')    // ✅ UK number
validatePhoneNumber('+81312345678')     // ✅ Japan number
```

**Invalid Examples:**
```typescript
validatePhoneNumber('4155551234')       // ❌ Missing + and country code
validatePhoneNumber('+1-415-555-1234')  // ❌ Contains separators
validatePhoneNumber('(415) 555-1234')   // ❌ Not E.164 format
```

### WebSocket URL Validation

**Why Validate?** Malicious URLs could connect to untrusted servers or cause crashes.

```typescript
import { validateWebSocketUrl } from 'vuesip'

// Validate SIP server URL
const userInput = 'wss://sip.example.com:7443'
const result = validateWebSocketUrl(userInput)

if (result.valid) {
  // ✅ Valid WebSocket URL
  console.log('Valid WebSocket URL:', result.normalized)

  // Safe to use for connection
  const { connect } = useSipClient({
    uri: result.normalized,  // Use validated URL
    // ... rest of config
  })
} else {
  // ❌ Invalid URL
  console.error('Invalid WebSocket URL:', result.error)
}
```

**Validation Rules:**
- ✅ Must use `ws://` or `wss://` protocol
- ✅ Must include valid hostname (domain or IP)
- ✅ Port is optional (defaults: 80 for ws, 443 for wss)
- ✅ Path and query parameters allowed

**Valid Examples:**
```typescript
validateWebSocketUrl('wss://sip.example.com')              // ✅ Basic WSS
validateWebSocketUrl('wss://sip.example.com:7443')         // ✅ With port
validateWebSocketUrl('ws://localhost:8088')                // ✅ Local development
validateWebSocketUrl('wss://sip.example.com/path')         // ✅ With path
```

### DTMF Tone Validation

**What are DTMF Tones?** Dual-Tone Multi-Frequency tones are the beeps you hear when pressing phone buttons. They're used for IVR systems (press 1 for sales, press 2 for support) and entering PIN codes.

```typescript
import { validateDtmfTone, validateDtmfSequence } from 'vuesip'

// Validate single tone
const tone = validateDtmfTone('1')
if (tone.valid) {
  await sendDTMF(tone.normalized)  // Send: '1'
}

// Validate entire sequence (e.g., PIN code or menu navigation)
const sequence = validateDtmfSequence('1234*#')
if (sequence.valid) {
  // ✅ Valid sequence - send all tones
  await sendDTMF(sequence.normalized)  // Send: '1234*#'
} else {
  // ❌ Invalid - contains unsupported characters
  showErrorMessage('Invalid DTMF sequence')
}
```

**Valid DTMF Tones:**
- `0-9` - Standard digit keys
- `*` - Star key (often "back" or "cancel")
- `#` - Pound/hash key (often "confirm" or "send")
- `A-D` - Extended keys (rarely used, mainly in military/specialized systems)

**Common Use Cases:**
```typescript
// IVR menu navigation
await sendDTMF('1')           // "Press 1 for sales"

// PIN code entry
await sendDTMF('9876')        // Enter 4-digit PIN

// Conference controls
await sendDTMF('*6')          // Mute/unmute in conference

// Voicemail access
await sendDTMF('*97')         // Access voicemail system
```

### Configuration Validation

VueSip automatically validates your entire configuration before attempting to connect. This catches errors early and provides clear error messages.

```typescript
import { validateSipConfig } from 'vuesip'

// Your configuration object
const config = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'secret123'
}

// Validate before connecting
const validation = validateSipConfig(config)

if (!validation.valid) {
  // ❌ Configuration has errors - fix before connecting
  console.error('Configuration errors:', validation.errors)
  // Example errors:
  // - "uri is required"
  // - "sipUri must be a valid SIP URI"
  // - "password or ha1 is required"

  // Show errors to user or developer
  validation.errors.forEach(error => {
    showErrorMessage(error)
  })

  // Don't attempt to connect!
  return
}

// ⚠️ Warnings don't prevent connection but should be addressed
if (validation.warnings) {
  console.warn('Configuration warnings:', validation.warnings)
  // Example warnings:
  // - "Using ws:// in production (use wss://)"
  // - "No TURN servers configured (calls may fail on restrictive networks)"

  // Optionally log warnings for monitoring
}

// ✅ Configuration is valid - safe to connect
await connect()
```

**What Gets Validated:**
- URI format and protocol
- SIP URI format
- Authentication credentials (password or HA1)
- Port numbers (if specified)
- Storage adapter configuration
- RTC configuration parameters

💡 **Pro Tip:** Call `validateSipConfig()` in development mode to catch configuration errors early!

### Input Validation Best Practices

Follow these guidelines to secure your application:

1. **✅ Validate all user inputs** - Never trust client-side data, even in your own application
2. **✅ Use built-in validators** - VueSip's validators are tested and secure - don't write your own
3. **✅ Validate before use** - Always validate before passing data to VueSip functions
4. **✅ Use normalized output** - Validators return normalized values (lowercase domains, etc.)
5. **🧹 Sanitize before display** - When showing user input in UI, escape HTML to prevent XSS
6. **🔄 Validate on both client and server** - Defense in depth - validate twice
7. **📝 Handle errors gracefully** - Show clear, user-friendly error messages
8. **🚫 Never pass raw input** - Always use `result.normalized` from validators

**Complete Validation Example:**

```typescript
// Example: Making a call with full validation
async function makeValidatedCall(userInput: string) {
  // Step 1: Validate input
  const validation = validateSipUri(userInput)

  if (!validation.valid) {
    // Step 2: Handle invalid input
    showErrorMessage(`Invalid phone number: ${validation.error}`)
    return false
  }

  // Step 3: Use normalized value
  try {
    await makeCall(validation.normalized)
    return true
  } catch (error) {
    // Step 4: Handle call errors
    showErrorMessage('Call failed. Please try again.')
    return false
  }
}
```

---

## Security Checklist

Use this comprehensive checklist to audit your VueSip application's security posture. Review this list before deploying to production and periodically thereafter.

### 🔐 Transport Security

- [ ] **Use WSS in production** - Never use `ws://` for production deployments
- [ ] **Verify TLS certificates** - Ensure SIP server has valid, non-expired certificate from trusted CA
- [ ] **Monitor security warnings** - Set up alerts for WSS connection failures
- [ ] **Use standard secure ports** - Prefer 443 or 7443 for easier firewall traversal
- [ ] **Test certificate renewal** - Verify automated certificate renewal process

### 🎤 Media Security

- [ ] **Configure STUN servers** - At least 2 STUN servers for redundancy
- [ ] **Configure TURN servers** - Required for ~10% of connections (restrictive NATs)
- [ ] **Use TURNS (TLS)** - Prefer `turns://` over `turn://` for encrypted relay
- [ ] **Set ICE transport policy** - Choose `relay` for high-security environments
- [ ] **Monitor ICE failures** - Log and alert on connection establishment failures
- [ ] **Test TURN authentication** - Verify TURN credentials work and auto-refresh

### 🔑 Credential Security

- [ ] **No plaintext passwords** - Never store passwords in source code or unencrypted storage
- [ ] **Use encrypted storage** - Enable `createEncryptedAdapter()` for persistent storage
- [ ] **Prefer HA1 hashes** - Use pre-computed HA1 instead of passwords when possible
- [ ] **Secure encryption keys** - Generate strong keys, never hardcode or commit to git
- [ ] **Implement key management** - Document how encryption keys are generated and stored
- [ ] **Clear on logout** - Explicitly clear credentials when user logs out
- [ ] **Time-limited sessions** - Re-authenticate periodically even with "remember me"

### 💾 Storage Security

- [ ] **Choose appropriate storage** - SessionStorage for sensitive, LocalStorage for convenience
- [ ] **Encrypt persistent data** - Always encrypt LocalStorage and IndexedDB
- [ ] **Use minimum 100K iterations** - PBKDF2 iterations should be at least 100,000
- [ ] **Secure key derivation** - Use proper PBKDF2 with salt and high iteration count
- [ ] **Never log keys** - Exclude encryption keys from all logs and error reports
- [ ] **Test data clearing** - Verify credentials are actually removed on logout

### 🛡️ Authentication Security

- [ ] **Use SIP Digest authentication** - Enabled by default in VueSip
- [ ] **Monitor auth failures** - Log and alert on repeated authentication failures
- [ ] **Strong password policy** - Require minimum 12 characters, mixed case, numbers, symbols
- [ ] **Implement rate limiting** - Limit authentication attempts (e.g., 5 per 15 minutes)
- [ ] **Use HA1 when possible** - Avoid storing plaintext passwords in your backend
- [ ] **Validate auth realms** - Ensure realm matches expected value
- [ ] **Test auth failure handling** - Verify app handles 401/407 responses correctly

### ✔️ Input Validation

- [ ] **Validate SIP URIs** - Use `validateSipUri()` before calling
- [ ] **Validate phone numbers** - Use `validatePhoneNumber()` for E.164 format
- [ ] **Validate WebSocket URLs** - Use `validateWebSocketUrl()` for server URLs
- [ ] **Validate DTMF tones** - Use `validateDtmfTone()` before sending
- [ ] **Validate configuration** - Call `validateSipConfig()` before connecting
- [ ] **Sanitize display** - Escape HTML when showing user input
- [ ] **Server-side validation** - Never rely solely on client-side validation

### 🌐 Application Security

- [ ] **Implement CSP** - Set Content-Security-Policy headers to prevent XSS
- [ ] **Use HTTPS everywhere** - Serve application over HTTPS, not HTTP
- [ ] **Configure CORS properly** - Restrict origins that can access your API
- [ ] **Keep dependencies updated** - Regularly run `npm audit` and update packages
- [ ] **Scan for vulnerabilities** - Use automated security scanning tools
- [ ] **Implement logging** - Log security events (auth failures, connection errors)
- [ ] **Monitor in production** - Set up alerts for security anomalies
- [ ] **Regular security audits** - Schedule quarterly security reviews
- [ ] **Document security** - Maintain security documentation for your team
- [ ] **Test security** - Include security tests in your test suite

---

## Common Security Pitfalls

**What This Section Covers**

Even experienced developers make these mistakes. Learn from common security pitfalls and how to avoid them in your VueSip application.

### ❌ Pitfall 1: Using Insecure WebSocket in Production

**The Mistake:**

```typescript
// ❌ BAD - Anyone on the network can intercept this traffic!
const { connect } = useSipClient({
  uri: 'ws://sip.example.com:8088',  // Unencrypted connection
  sipUri: 'sip:1000@example.com',
  password: 'secret'                 // Password visible in network traffic!
})
```

**Why It's Dangerous:**
- All SIP messages transmitted in plaintext
- Passwords visible to anyone on the network (WiFi, ISP, etc.)
- Call details, participants, and metadata exposed
- Vulnerable to man-in-the-middle attacks

**✅ The Fix: Always Use WSS**

```typescript
// ✅ GOOD - TLS-encrypted connection
const { connect } = useSipClient({
  uri: 'wss://sip.example.com:7443',  // Encrypted with TLS
  sipUri: 'sip:1000@example.com',
  password: 'secret'                  // Protected by TLS encryption
})
```

💡 **Development Exception:** `ws://localhost` is acceptable for local development only.

---

### ❌ Pitfall 2: Hardcoding Credentials in Source Code

**The Mistake:**

```typescript
// ❌ BAD - Credentials visible in git history forever!
const { connect } = useSipClient({
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:1000@example.com',
  password: 'hardcoded-password-123'  // This will be in git commits!
})
```

**Why It's Dangerous:**
- Credentials committed to version control (git)
- Visible to anyone with repository access
- Exposed in build artifacts
- Impossible to change without updating code
- Violates security compliance (SOC 2, ISO 27001)

**✅ The Fix: Use Environment Variables or User Input**

```typescript
// ✅ GOOD - Credentials from environment variables
const { connect } = useSipClient({
  uri: import.meta.env.VITE_SIP_URI,        // From .env file (not committed)
  sipUri: userInputSipUri.value,            // From user input
  password: userInputPassword.value         // From user input
})
```

**Setting Up Environment Variables:**

```bash
# .env file (add to .gitignore!)
VITE_SIP_URI=wss://sip.example.com:7443
```

```typescript
// Access in your code
const sipServerUri = import.meta.env.VITE_SIP_URI
```

⚠️ **Important:** Add `.env` to `.gitignore` so it's never committed!

---

### ❌ Pitfall 3: Storing Plaintext Passwords in Browser Storage

**The Mistake:**

```typescript
// ❌ BAD - Password readable by anyone with device access!
localStorage.setItem('sipPassword', 'my-password')

// Later...
const password = localStorage.getItem('sipPassword')  // Plaintext!
```

**Why It's Dangerous:**
- localStorage is unencrypted plain text
- Readable by any JavaScript on the same origin
- Visible in browser dev tools
- Persists even after browser restart
- Accessible to malware and browser extensions

**✅ The Fix: Use VueSip's Encrypted Storage**

```typescript
// ✅ GOOD - AES-GCM encrypted storage
import { createEncryptedAdapter, LocalStorageAdapter } from 'vuesip'

const storage = createEncryptedAdapter(
  new LocalStorageAdapter(),
  {
    enabled: true,           // Enable encryption
    iterations: 100000       // Strong key derivation
  }
)

const { connect } = useSipClient({
  // ... config
  storageAdapter: storage,
  encryptionKey: userDerivedKey  // Derived from user password, not stored
})
```

📝 **Result:** Credentials encrypted with AES-GCM before storage. Unreadable without encryption key.

---

### ❌ Pitfall 4: Skipping Input Validation

**The Mistake:**

```typescript
// ❌ BAD - Using user input directly without validation!
const sipUri = userInput.value  // Could be: "; DROP TABLE users; --"
await makeCall(sipUri)          // Potential injection or crash!
```

**Why It's Dangerous:**
- Malformed input causes crashes
- Potential for injection attacks
- Unexpected behavior
- Poor user experience (unclear error messages)
- Security vulnerabilities

**✅ The Fix: Always Validate User Input**

```typescript
// ✅ GOOD - Validate before use
import { validateSipUri } from 'vuesip'

const result = validateSipUri(userInput.value)

if (result.valid) {
  // Safe to use - input has been validated and normalized
  await makeCall(result.normalized)
} else {
  // Handle invalid input gracefully
  showErrorMessage(`Invalid SIP address: ${result.error}`)
}
```

**Benefits:**
- Catches errors early with clear messages
- Prevents injection attacks
- Normalizes input (lowercase domains, etc.)
- Better user experience

---

### ❌ Pitfall 5: Logging Sensitive Data

**The Mistake:**

```typescript
// ❌ BAD - Credentials exposed in logs!
console.log('Connecting with password:', password)    // Visible in console!
console.log('User config:', config)                   // May contain secrets!

// Logs sent to analytics
analytics.track('login', {
  password: password,        // ❌ Exposed to analytics service!
  ha1: ha1
})
```

**Why It's Dangerous:**
- Credentials visible in browser console
- Exposed in log aggregation services (Datadog, Sentry)
- Sent to analytics platforms
- Stored in log files
- Visible to customer support staff
- May violate compliance regulations

**✅ The Fix: Sanitize All Logs**

```typescript
// ✅ GOOD - Redact sensitive data before logging
const sanitizedConfig = {
  ...config,
  password: '***REDACTED***',      // Hide password
  ha1: '***REDACTED***',           // Hide HA1
  encryptionKey: '***REDACTED***'  // Hide encryption key
}
console.log('User config:', sanitizedConfig)  // Safe to log

// Analytics without sensitive data
analytics.track('login', {
  username: config.authorizationUsername,  // ✅ Safe to log
  uri: config.uri.replace(/:[^:]+$/, ''),  // ✅ URI without credentials
  // Don't include password, ha1, or keys!
})
```

**Utility Function for Sanitization:**

```typescript
// Helper function to sanitize configuration objects
function sanitizeConfig(config: any): any {
  const sensitive = ['password', 'ha1', 'encryptionKey', 'credential', 'apiKey']

  return Object.keys(config).reduce((acc, key) => {
    acc[key] = sensitive.includes(key) ? '***REDACTED***' : config[key]
    return acc
  }, {} as any)
}

// Usage
console.log('Config:', sanitizeConfig(config))
```

---

## Additional Resources

**Deepen Your Understanding**

These external resources provide in-depth information about the security technologies used in VueSip.

### Web Crypto API
- [MDN - Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Complete API reference for browser cryptography
- [Subtle Crypto](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto) - Low-level cryptographic operations

### WebRTC Security
- [WebRTC Security Architecture (RFC 8827)](https://www.rfc-editor.org/rfc/rfc8827) - Official WebRTC security specification
- [DTLS-SRTP (RFC 5764)](https://www.rfc-editor.org/rfc/rfc5764) - Technical specification for media encryption

### SIP Security
- [SIP Authentication (RFC 3261)](https://www.rfc-editor.org/rfc/rfc3261#section-22) - SIP specification, authentication section
- [SIP Security Mechanisms (RFC 3329)](https://www.rfc-editor.org/rfc/rfc3329) - Advanced SIP security features

### OWASP Resources
- [OWASP Top Ten](https://owasp.org/www-project-top-ten/) - Most critical web security risks
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/) - Practical security guidance

---

## Next Steps

**Continue Your VueSip Journey**

Now that you understand how to secure your VueSip application, explore these guides to build powerful VoIP features:

- [Getting Started](./getting-started.md) - Set up your first VueSip application with security in mind
- [Making Calls](./making-calls.md) - Learn how to make outgoing calls securely
- [Device Management](./device-management.md) - Configure audio/video devices properly
- [Call Controls](./call-controls.md) - Advanced call control features and best practices

💡 **Pro Tip:** Return to this security guide periodically to review your application's security posture as it grows and evolves!
