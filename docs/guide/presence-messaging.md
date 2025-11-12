# Presence and Messaging Guide

This guide explains how to use SIP presence and instant messaging in VueSip. Learn how to track user availability, send real-time messages, and build rich communication experiences.

**What you'll learn:**
- 📍 **Presence Management** - Track who's online, busy, or away in real-time
- 💬 **Instant Messaging** - Send and receive text messages between users
- 🔔 **Status Updates** - Get notified when users change their availability
- ⌨️ **Typing Indicators** - Show "user is typing..." feedback

## Server Compatibility

**What you'll learn:** Which SIP servers and platforms support presence and messaging, and what to configure for each.

Before using presence and messaging features, it's important to verify your SIP server supports them. Not all servers implement these features, and configuration requirements vary.

### Feature Support by SIP Server

VueSip's presence and messaging features work with any SIP server that implements the relevant RFC standards. However, server support varies:

| Server | Presence (RFC 3856) | Messaging (RFC 3428) | IMDN/Receipts | Composing Indicators | Notes |
|--------|---------------------|----------------------|---------------|----------------------|-------|
| **Asterisk** | ✅ Via res_pjsip | ✅ Yes | ⚠️ Limited | ⚠️ Limited | Requires PJSIP stack, not chan_sip |
| **FreeSWITCH** | ✅ Full support | ✅ Full support | ✅ Yes | ✅ Yes | Best overall support |
| **Kamailio** | ✅ Via presence module | ✅ Via msilo module | ✅ Yes | ✅ Yes | Requires module configuration |
| **OpenSIPS** | ✅ Via presence module | ✅ Via msilo module | ⚠️ Limited | ⚠️ Limited | Complex setup required |
| **Jitsi Videobridge** | ❌ No | ⚠️ Limited | ❌ No | ❌ No | Primarily for video conferencing |
| **Twilio** | ❌ No | ✅ Via Programmable Messaging | ❌ No | ❌ No | Different API, not SIP MESSAGE |

**Legend:**
- ✅ Full support - Feature works out of the box or with standard configuration
- ⚠️ Limited - Feature available but requires significant setup or has limitations
- ❌ No - Feature not supported

### Asterisk Configuration

For Asterisk 16+ with PJSIP, presence and messaging require specific configuration:

**1. Enable PJSIP (not chan_sip):**

```ini
; /etc/asterisk/pjsip.conf

[transport-wss]
type=transport
protocol=wss
bind=0.0.0.0:7443
external_media_address=YOUR_PUBLIC_IP
external_signaling_address=YOUR_PUBLIC_IP

[endpoint-template](!)
type=endpoint
context=default
disallow=all
allow=ulaw,alaw,opus
ice_support=yes
force_rport=yes

; Enable presence for endpoint
allow_subscribe=yes
sub_min_expiry=60

; Enable messaging
message_context=messaging

[1000](endpoint-template)
type=endpoint
auth=1000
aors=1000
; Presence and messaging enabled via template

[1000]
type=auth
auth_type=userpass
username=1000
password=secret

[1000]
type=aor
max_contacts=5
```

**2. Configure messaging context:**

```ini
; /etc/asterisk/extensions.conf

[messaging]
; Handle incoming MESSAGE requests
exten => _X.,1,NoOp(Incoming message from ${MESSAGE(from)})
same => n,NoOp(Message body: ${MESSAGE(body)})
same => n,Set(CHANNEL(hangup_handler_push)=message-handler,s,1)
same => n,MessageSend(${MESSAGE(to)},${MESSAGE(from)})
same => n,Hangup()
```

**3. Enable presence:**

```bash
# Asterisk CLI
*CLI> module load res_pjsip_publish_asterisk
*CLI> module load res_pjsip_outbound_publish
*CLI> module load res_pjsip_exten_state
```

**Known Limitations:**
- Delivery receipts (IMDN) not fully supported - requires custom development
- Composing indicators require additional modules
- Presence limited to extension state, not full rich presence

### FreeSWITCH Configuration

FreeSWITCH has the best support for presence and messaging. Minimal configuration needed:

**1. Enable presence and messaging:**

```xml
<!-- /usr/local/freeswitch/conf/sip_profiles/internal.xml -->
<profile name="internal">
  <settings>
    <!-- Enable presence -->
    <param name="manage-presence" value="true"/>
    <param name="presence-hosts" value="example.com"/>

    <!-- Enable messaging -->
    <param name="send-message-query-on-register" value="true"/>

    <!-- WebSocket support -->
    <param name="ws-binding" value=":7443"/>
    <param name="wss-binding" value=":7443"/>
  </settings>
</profile>
```

**2. Configure user directory:**

```xml
<!-- /usr/local/freeswitch/conf/directory/default/1000.xml -->
<user id="1000">
  <params>
    <param name="password" value="secret"/>
    <param name="vm-password" value="1000"/>
  </params>
  <variables>
    <!-- Enable presence for this user -->
    <variable name="presence_id" value="1000@example.com"/>

    <!-- Enable message waiting indicator -->
    <variable name="user_context" value="default"/>
  </variables>
</user>
```

**Features supported:**
- ✅ Full presence with rich status
- ✅ SIP MESSAGE with delivery receipts
- ✅ Composing indicators
- ✅ Message storage and offline delivery
- ✅ SIMPLE (RFC 4662) presence event package

### Kamailio Configuration

Kamailio requires loading specific modules for presence and messaging:

**1. Load required modules:**

```
# /etc/kamailio/kamailio.cfg

# Presence modules
loadmodule "presence.so"
loadmodule "presence_xml.so"

# Messaging modules
loadmodule "msilo.so"  # Message storage
```

**2. Configure presence:**

```
# Presence settings
modparam("presence", "server_address", "sip:example.com:5060")
modparam("presence", "db_url", "mysql://kamailio:password@localhost/kamailio")
modparam("presence", "clean_period", 100)
modparam("presence", "pubruri_with_obp", 1)

# Handle PUBLISH and SUBSCRIBE
route[PRESENCE] {
    if(is_method("PUBLISH")) {
        handle_publish();
        t_release();
        exit;
    }

    if(is_method("SUBSCRIBE")) {
        handle_subscribe();
        t_release();
        exit;
    }
}
```

**3. Configure messaging with offline storage:**

```
# Message storage settings
modparam("msilo", "db_url", "mysql://kamailio:password@localhost/kamailio")
modparam("msilo", "registrar", "sip:example.com")

# Handle MESSAGE requests
route[MESSAGE] {
    if(is_method("MESSAGE")) {
        # Try to deliver
        if(!t_relay()) {
            # Offline - store for later
            m_store();
        }
        exit;
    }
}
```

### Testing Server Compatibility

Before deploying, test your server's feature support:

```typescript
// Test Presence Support
const testPresenceSupport = async () => {
  const { setStatus, subscribe, onPresenceEvent } = usePresence(sipClient)

  let presenceSupported = false
  let subscribeSupported = false

  // Test PUBLISH
  try {
    await setStatus(PresenceState.Available)
    console.log('✅ PUBLISH supported')
    presenceSupported = true
  } catch (error: any) {
    if (error.code === 489 || error.code === 501) {
      console.error('❌ PUBLISH not supported by server')
    }
  }

  // Test SUBSCRIBE
  try {
    await subscribe('sip:test@example.com')
    console.log('✅ SUBSCRIBE supported')
    subscribeSupported = true
  } catch (error: any) {
    if (error.code === 489 || error.code === 501) {
      console.error('❌ SUBSCRIBE not supported by server')
    }
  }

  return { presenceSupported, subscribeSupported }
}

// Test Messaging Support
const testMessagingSupport = async () => {
  const { sendMessage, onMessagingEvent } = useMessaging(sipClient)

  let messagingSupported = false
  let deliveryReceiptsSupported = false

  // Test MESSAGE method
  try {
    await sendMessage('sip:test@example.com', 'Test message')
    console.log('✅ MESSAGE method supported')
    messagingSupported = true
  } catch (error: any) {
    if (error.code === 405) {
      console.error('❌ MESSAGE method not supported')
    }
  }

  // Test delivery receipts
  const receiptPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000)

    onMessagingEvent((event) => {
      if (event.type === 'delivered' || event.type === 'read') {
        clearTimeout(timeout)
        resolve(true)
      }
    })
  })

  try {
    await sendMessage('sip:test@example.com', 'Receipt test', {
      requestDeliveryNotification: true
    })

    deliveryReceiptsSupported = await receiptPromise
    if (deliveryReceiptsSupported) {
      console.log('✅ Delivery receipts supported')
    } else {
      console.warn('⚠️ Delivery receipts not supported')
    }
  } catch (error) {
    console.error('❌ Could not test delivery receipts')
  }

  return { messagingSupported, deliveryReceiptsSupported }
}

// Run all tests
const runCompatibilityTests = async () => {
  console.log('Testing server compatibility...')

  const presenceResults = await testPresenceSupport()
  const messagingResults = await testMessagingSupport()

  console.log('\nCompatibility Results:')
  console.log('Presence (PUBLISH):', presenceResults.presenceSupported ? '✅' : '❌')
  console.log('Subscriptions (SUBSCRIBE):', presenceResults.subscribeSupported ? '✅' : '❌')
  console.log('Messaging (MESSAGE):', messagingResults.messagingSupported ? '✅' : '❌')
  console.log('Delivery Receipts:', messagingResults.deliveryReceiptsSupported ? '✅' : '⚠️')

  return {
    ...presenceResults,
    ...messagingResults
  }
}
```

**Using test results:**

```typescript
// Adapt features based on server capabilities
const { messagingSupported, deliveryReceiptsSupported } = await runCompatibilityTests()

// Conditionally enable features
if (messagingSupported) {
  // Show messaging UI
  showMessagingFeatures()

  if (deliveryReceiptsSupported) {
    // Enable read receipts UI
    enableReadReceipts()
  } else {
    // Hide delivery status indicators
    hideDeliveryStatus()
  }
} else {
  // Disable messaging entirely
  disableMessagingFeatures()
  showWarning('Your SIP server does not support instant messaging')
}
```

### Common Configuration Issues

**Issue: "489 Bad Event" error**

Your server doesn't recognize the presence event package.

```typescript
// Solution: Check server configuration
// For Asterisk: Ensure res_pjsip_publish_asterisk is loaded
// For Kamailio: Load presence.so and presence_xml.so
// For FreeSWITCH: Set manage-presence=true
```

**Issue: Messages not delivered offline**

Server doesn't store messages for offline users.

```typescript
// Solution: Configure message storage
// For Kamailio: Use msilo module
// For FreeSWITCH: Enable message storage in profile
// For Asterisk: Implement custom dialplan logic
```

**Issue: Presence subscriptions fail intermittently**

Server subscription limits are too low.

```typescript
// Solution: Increase server limits
// For Asterisk PJSIP: Set max_contacts in AOR
// For FreeSWITCH: Adjust max-subscriptions-per-user
// For Kamailio: Configure presence module limits
```

---

## Understanding SIP Presence & Messaging

Before diving in, let's understand what these features are and why they're useful:

### What is SIP Presence?

**Presence** lets you broadcast your availability status (available, busy, away) and subscribe to other users' status updates. This is the foundation of features like contact lists that show who's online.

**How it works technically:**
- **PUBLISH** - You broadcast your status to the server ("I'm available")
- **SUBSCRIBE** - You request updates about another user's status ("Tell me when Alice's status changes")
- **NOTIFY** - The server sends you status updates ("Alice is now busy")

### What is SIP Messaging?

**Instant messaging** enables real-time text communication between users using the SIP MESSAGE method. Unlike traditional SMS, SIP messages are sent over your data connection and can include delivery receipts and typing indicators.

**Why use SIP messaging?**
- ✅ Real-time delivery over your existing SIP infrastructure
- ✅ Delivery and read receipts to track message status
- ✅ Composing indicators for better user experience
- ✅ No separate messaging infrastructure needed

---

## Table of Contents

- [Quick Start](#quick-start)
- [Presence Management](#presence-management)
  - [Setting Your Status](#setting-your-status)
  - [Watching Other Users](#watching-other-users)
  - [Presence Events](#presence-events)
  - [Auto-Refresh](#auto-refresh)
- [Instant Messaging](#instant-messaging)
  - [Sending Messages](#sending-messages)
  - [Receiving Messages](#receiving-messages)
  - [Message Status Tracking](#message-status-tracking)
  - [Composing Indicators](#composing-indicators)
- [Conversations](#conversations)
- [Message Management](#message-management)
- [Best Practices](#best-practices)
- [Advanced Examples](#advanced-examples)

---

## Quick Start

Let's get you up and running quickly with basic examples.

### Presence Quick Start

This example shows how to set your status and watch another user in just a few lines:

```typescript
import { useSipClient, usePresence, PresenceState } from 'vuesip'

// Get the SIP client instance
const { sipClient } = useSipClient()

// Initialize presence composable
const { setStatus, subscribe, watchedUsers } = usePresence(sipClient)

// Set your status to "Available" - broadcasts to all watchers
await setStatus(PresenceState.Available)

// Watch another user - you'll get notified when their status changes
await subscribe('sip:alice@example.com')

// Check Alice's current status from the reactive watchedUsers map
const aliceStatus = watchedUsers.value.get('sip:alice@example.com')
console.log(`Alice is: ${aliceStatus?.state}`) // e.g., "available", "busy"
```

💡 **Tip:** Status updates are real-time and reactive. When Alice changes her status, `watchedUsers` automatically updates!

### Messaging Quick Start

This example shows how to send a message and track unread counts:

```typescript
import { useSipClient, useMessaging } from 'vuesip'

// Get the SIP client instance
const { sipClient } = useSipClient()

// Initialize messaging composable
const { sendMessage, messages, unreadCount } = useMessaging(sipClient)

// Send a simple text message to Bob
await sendMessage('sip:bob@example.com', 'Hello!')

// Access the reactive unread message count
console.log(`Unread messages: ${unreadCount.value}`)

// All messages are stored in the reactive messages array
console.log(`Total messages: ${messages.value.length}`)
```

💡 **Tip:** Messages are automatically stored and organized by conversation. You can access them at any time!

---

## Presence Management

The `usePresence` composable provides complete SIP presence functionality. Think of it as your "status broadcaster" - it lets you tell others your availability and monitor theirs.

### Why Presence Matters

Presence is essential for modern communication apps. It helps users know:
- 👤 Who's online and available to chat
- 🔴 Who's busy and shouldn't be disturbed
- ⏰ Who's away from their device
- 💬 When to expect a response

### Setting Your Status

Broadcasting your presence status lets others know your availability. This is typically one of the first things you do after connecting.

```typescript
import { ref } from 'vue'
import { useSipClient, usePresence, PresenceState } from 'vuesip'

const { sipClient } = useSipClient()
const { setStatus, currentStatus, currentState } = usePresence(sipClient)

// Basic status - just set yourself as available
await setStatus(PresenceState.Available)

// Status with a message - tell people why you're away
await setStatus(PresenceState.Away, {
  statusMessage: 'At lunch, back at 1pm'
})

// Busy status - let people know you're occupied
await setStatus(PresenceState.Busy, {
  statusMessage: 'In a meeting'
})

// Offline status - you're going away
await setStatus(PresenceState.Offline)

// Custom status - use your own description
await setStatus(PresenceState.Custom, {
  statusMessage: 'Working from home'
})

// Status with custom expiry - automatically expire after set time
await setStatus(PresenceState.Available, {
  statusMessage: 'Available for calls',
  expires: 7200 // Status expires in 2 hours (7200 seconds)
})
```

📝 **Note:** Your status is published to the SIP server using the PUBLISH method. Anyone who has subscribed to your presence will be notified via NOTIFY messages.

#### Presence States

Choose from these standard presence states:

| State | Description | When to Use |
|-------|-------------|-------------|
| `Available` | User is online and available | User is actively using the app and ready to communicate |
| `Away` | User is away from their device | User is idle or stepped away temporarily |
| `Busy` | User is busy / do not disturb | User is in a meeting or shouldn't be interrupted |
| `Offline` | User is offline | User is disconnecting or logging out |
| `Custom` | Custom status with message | Any other status with a custom description |

✅ **Best Practice:** Always set your status to `Available` when connecting and `Offline` when disconnecting for good user experience.

#### Current Status

You can access your own current presence status at any time using reactive properties:

```typescript
const { currentStatus, currentState } = usePresence(sipClient)

// Get just the state (simple string)
console.log(currentState.value) // 'available'

// Get the full status object with all details
console.log(currentStatus.value)
// Output:
// {
//   uri: 'sip:self@example.com',           // Your SIP URI
//   state: 'available',                     // Your current state
//   statusMessage: 'Working from home',     // Your status message
//   lastUpdated: Date                       // When status was last updated
// }
```

💡 **Tip:** Use `currentState` for simple checks (e.g., display in UI). Use `currentStatus` when you need the full details including message and timestamp.

---

### Watching Other Users

Subscribing to other users' presence gives you real-time updates whenever their status changes. This is how you build contact lists that show who's online.

**How it works:**
1. You call `subscribe()` with a user's SIP URI
2. VueSip sends a SUBSCRIBE request to the SIP server
3. The server sends back NOTIFY messages whenever that user's status changes
4. The `watchedUsers` map automatically updates with the new status

```typescript
const {
  subscribe,           // Subscribe to a user's presence
  unsubscribe,         // Stop watching a user
  watchedUsers,        // Map of all watched users and their status
  subscriptions,       // Details about active subscriptions
  subscriptionCount,   // Number of users you're watching
  getStatus           // Helper to get a specific user's status
} = usePresence(sipClient)

// Basic subscription - start watching Alice's status
const subscriptionId = await subscribe('sip:alice@example.com')

// Subscription with options - customize expiry time and headers
await subscribe('sip:bob@example.com', {
  expires: 7200, // Subscription refreshes every 2 hours
  extraHeaders: ['X-Custom-Header: value'] // Add custom SIP headers
})

// Get a specific user's status
const aliceStatus = getStatus('sip:alice@example.com')
if (aliceStatus) {
  console.log(`Alice: ${aliceStatus.state}`)           // e.g., "available"
  console.log(`Message: ${aliceStatus.statusMessage}`) // e.g., "In a meeting"
  console.log(`Last updated: ${aliceStatus.lastUpdated}`) // Date object
}

// Iterate through all watched users
watchedUsers.value.forEach((status, uri) => {
  console.log(`${uri}: ${status.state} - ${status.statusMessage}`)
})

// Check how many users you're watching
console.log(`Watching ${subscriptionCount.value} users`)

// Stop watching a specific user
await unsubscribe('sip:alice@example.com')

// Stop watching all users (useful on logout)
await unsubscribeAll()
```

💡 **Tip:** The `watchedUsers` map is reactive! Use it directly in your Vue templates to display contact lists that update automatically.

⚠️ **Warning:** Many SIP servers limit the number of active subscriptions (often 50-100). Monitor `subscriptionCount` and unsubscribe from users you no longer need to watch.

#### Subscription Details

For advanced scenarios, you can monitor the state of your subscriptions:

```typescript
const { subscriptions } = usePresence(sipClient)

// Each subscription has detailed information
subscriptions.value.forEach((subscription, uri) => {
  console.log({
    id: subscription.id,              // Unique subscription ID
    targetUri: subscription.targetUri, // The user you're watching
    state: subscription.state,         // 'pending' | 'active' | 'terminated'
    expires: subscription.expires,     // Expiry time in seconds
    lastStatus: subscription.lastStatus // Most recent status received
  })
})
```

📝 **Note:** Subscription states:
- **pending** - SUBSCRIBE sent, waiting for response
- **active** - Subscription confirmed, receiving updates
- **terminated** - Subscription ended (expired or unsubscribed)

---

### Presence Events

Listen for presence events to react to status changes in real-time. This is perfect for showing notifications, updating UI, or logging activity.

```typescript
const { onPresenceEvent } = usePresence(sipClient)

// Register an event listener
const unsubscribe = onPresenceEvent((event) => {
  switch (event.type) {
    case 'updated':
      // A user's status changed
      console.log(`${event.uri} status changed to ${event.status?.state}`)
      console.log(`Message: ${event.status?.statusMessage}`)
      // Example: Show notification "Alice is now available"
      break

    case 'subscribed':
      // Successfully subscribed to a user
      console.log(`Subscribed to ${event.uri}`)
      // Example: Update UI to show you're watching this user
      break

    case 'unsubscribed':
      // Unsubscribed from a user
      console.log(`Unsubscribed from ${event.uri}`)
      // Example: Remove user from your contact list
      break

    case 'error':
      // Subscription failed or error occurred
      console.error(`Presence error for ${event.uri}:`, event.error)
      // Example: Show error message to user
      break
  }
})

// Later: Clean up the listener (important!)
unsubscribe()
```

#### Event Types

Understanding each event type helps you build responsive features:

| Event Type | When It Fires | What To Do | Properties |
|------------|---------------|------------|------------|
| `updated` | User's status changed | Update UI, show notification | `uri`, `status`, `timestamp` |
| `subscribed` | Successfully subscribed | Confirm in UI | `uri`, `subscription`, `timestamp` |
| `unsubscribed` | Stopped watching user | Update contact list | `uri`, `subscription`, `timestamp` |
| `error` | Subscription failed | Show error, retry | `uri`, `error`, `timestamp` |

✅ **Best Practice:** Always unsubscribe from event listeners in component cleanup (e.g., `onBeforeUnmount`) to prevent memory leaks.

---

### Auto-Refresh

One of the most powerful features of VueSip's presence system is **automatic subscription refresh**. Here's why this matters and how it works:

**The Problem:** SIP subscriptions expire after a set time (typically 1 hour). If they expire, you stop receiving status updates.

**The Solution:** VueSip automatically refreshes subscriptions before they expire, so you get continuous updates without any manual intervention.

```typescript
// Subscribe with 1 hour expiry
await subscribe('sip:alice@example.com', {
  expires: 3600 // 1 hour (3600 seconds)
})

// VueSip automatically refreshes at 54 minutes (90% of 60 minutes)
// This happens silently in the background - no code needed!
```

**How Auto-Refresh Works:**

1. ⏰ VueSip schedules a refresh at 90% of the expiry time
2. 🔄 At 54 minutes, it automatically unsubscribes and re-subscribes
3. ✅ Your subscription continues without interruption
4. 🔁 The cycle repeats until you manually unsubscribe

**Benefits:**
- ✅ Maintains continuous presence updates
- ✅ Uses the same subscription options (expires, headers)
- ✅ Handles errors gracefully (retries on failure)
- ✅ Automatically cleared when you manually unsubscribe
- ✅ Zero maintenance required!

💡 **Tip:** Shorter expiry times mean more frequent refresh requests to the server. Balance responsiveness with server load by using reasonable expiry times (1-2 hours is typical).

---

## Instant Messaging

The `useMessaging` composable provides SIP MESSAGE functionality for real-time text communication. Think of it as your messaging engine - it handles sending, receiving, and organizing all your conversations.

### Why SIP Messaging?

SIP messaging offers several advantages over traditional SMS or separate chat systems:
- 📱 **Integrated** - Works over your existing SIP connection
- ⚡ **Real-time** - Messages are delivered instantly
- ✅ **Receipts** - Track delivery and read status
- ⌨️ **Indicators** - Show "typing..." to other users
- 🔒 **Secure** - Can be encrypted with TLS/SRTP

---

### Sending Messages

Sending messages is straightforward. Messages are sent using the SIP MESSAGE method and can include various options like delivery receipts.

```typescript
import { ref } from 'vue'
import { useSipClient, useMessaging, MessageContentType } from 'vuesip'

const { sipClient } = useSipClient()
const { sendMessage, messages } = useMessaging(sipClient)

// Simple text message - the most common use case
const messageId = await sendMessage('sip:bob@example.com', 'Hello!')
// Returns a unique message ID you can use to track this message

// JSON message - send structured data
await sendMessage('sip:bob@example.com', '{"action":"call","time":"3pm"}', {
  contentType: MessageContentType.JSON
})

// HTML message - send rich formatted content
await sendMessage('sip:bob@example.com', '<p>Hello <strong>World</strong></p>', {
  contentType: MessageContentType.HTML
})

// Message with custom SIP headers
await sendMessage('sip:bob@example.com', 'Hello!', {
  extraHeaders: [
    'X-Custom-Header: value',
    'X-Priority: high'
  ]
})

// Request delivery notification - know when it's delivered
await sendMessage('sip:bob@example.com', 'Important message', {
  requestDeliveryNotification: true
  // You'll receive a 'delivered' event when Bob's client receives it
})

// Request read notification - know when it's been read
await sendMessage('sip:bob@example.com', 'Please confirm receipt', {
  requestReadNotification: true
  // You'll receive a 'read' event when Bob opens the message
})
```

#### Content Types

Choose the right content type for your use case:

| Content Type | Description | Example Use Case |
|--------------|-------------|------------------|
| `MessageContentType.Text` | Plain text (default) | Basic chat messages |
| `MessageContentType.HTML` | HTML content | Rich formatted messages with bold, links, etc. |
| `MessageContentType.JSON` | JSON data | Structured data exchange, commands, metadata |
| `MessageContentType.Custom` | Custom MIME type | Application-specific data formats |

📝 **Note:** The receiving client must support the content type. Plain text is universally supported.

⚠️ **Warning:** Delivery and read notifications depend on the recipient's client supporting these features. Not all SIP clients send these notifications.

---

### Receiving Messages

Messages are automatically received and stored when they arrive. VueSip handles all the heavy lifting - you just need to listen for events and access the messages.

```typescript
const { messages, onMessagingEvent } = useMessaging(sipClient)

// Listen for all messaging events
const unsubscribe = onMessagingEvent((event) => {
  switch (event.type) {
    case 'received':
      // New incoming message - show it to the user
      console.log(`New message from ${event.message.from}`)
      console.log(`Content: ${event.message.content}`)

      // Example actions:
      // - Show browser notification
      // - Play notification sound
      // - Update UI with new message
      // - Increment unread badge
      break

    case 'sent':
      // Your outgoing message was sent successfully
      console.log('Message sent successfully')
      // Example: Update UI to show checkmark
      break

    case 'failed':
      // Your message failed to send
      console.error('Message failed to send:', event.error)
      // Example: Show error, offer retry option
      break

    case 'delivered':
      // Your message was delivered to recipient's device
      console.log('Message delivered')
      // Example: Show double checkmark in UI
      break

    case 'read':
      // Recipient opened and read your message
      console.log('Message read')
      // Example: Show blue checkmarks like WhatsApp
      break
  }
})

// Access all messages (reactive array)
messages.value.forEach((message) => {
  console.log({
    id: message.id,              // Unique message ID
    from: message.from,           // Sender's SIP URI
    to: message.to,               // Recipient's SIP URI
    content: message.content,     // Message text/content
    direction: message.direction, // 'incoming' or 'outgoing'
    status: message.status,       // Current status (pending, sent, etc.)
    timestamp: message.timestamp, // When message was created
    isRead: message.isRead       // Whether message has been read
  })
})

// Don't forget to clean up!
onBeforeUnmount(() => {
  unsubscribe()
})
```

💡 **Tip:** Use the `received` event to trigger real-time UI updates and notifications. The `messages` array is best for displaying conversation history.

✅ **Best Practice:** Always display the sender's name or URI with incoming messages so users know who it's from.

---

### Message Status Tracking

Every message goes through a lifecycle from creation to delivery. VueSip tracks each stage so you can provide detailed feedback to users (like WhatsApp's checkmarks).

```typescript
const { messages, getMessagesForUri } = useMessaging(sipClient)

// Get all messages with a specific user
const bobMessages = getMessagesForUri('sip:bob@example.com')

bobMessages.forEach((msg) => {
  // Track the complete lifecycle
  console.log(`Status: ${msg.status}`)        // Current status
  console.log(`Created: ${msg.timestamp}`)    // When user sent it
  console.log(`Sent: ${msg.sentAt}`)         // When it left your device
  console.log(`Delivered: ${msg.deliveredAt}`) // When it reached their device
  console.log(`Read: ${msg.readAt}`)         // When they opened it
})
```

#### Message Status Values

Understanding each status helps you provide accurate feedback:

| Status | What It Means | Display To User | Icon Example |
|--------|---------------|-----------------|--------------|
| `Pending` | Message queued, not sent yet | "Sending..." | ⏳ Clock |
| `Sending` | Currently being transmitted | "Sending..." | ⏳ Clock |
| `Sent` | Successfully sent from your device | "Sent" | ✓ Single check |
| `Delivered` | Arrived at recipient's device | "Delivered" | ✓✓ Double check |
| `Read` | Recipient opened the message | "Read" | ✓✓ Blue checks |
| `Failed` | Failed to send | "Failed - Tap to retry" | ❌ Red X |

**Status Flow:**
```
Pending → Sending → Sent → Delivered → Read
              ↓
           Failed
```

💡 **Tip:** Use different visual indicators for each status to mirror familiar messaging apps:
- Single gray check = Sent
- Double gray checks = Delivered
- Double blue checks = Read
- Red icon = Failed

📝 **Note:** You'll only receive `Delivered` and `Read` statuses if you requested notifications when sending and the recipient's client supports them.

---

### Composing Indicators

Composing indicators (also known as "typing indicators" or "is typing") show when someone is actively typing a message. This provides immediate feedback and makes conversations feel more natural and real-time.

**Why use composing indicators?**
- 💬 Shows the conversation is active
- ⏱️ Sets expectation that a response is coming
- 🎯 Improves user experience in real-time chat

```typescript
const { sendComposingIndicator, composingIndicators } = useMessaging(sipClient)

// Send composing indicator when user starts typing
const handleInput = async (text: string) => {
  if (text.length > 0) {
    // User is typing - send "composing" state
    await sendComposingIndicator('sip:bob@example.com', true)
  } else {
    // Input cleared - send "idle" state
    await sendComposingIndicator('sip:bob@example.com', false)
  }
}

// Check if other users are composing
const bobIndicator = composingIndicators.value.get('sip:bob@example.com')
if (bobIndicator?.isComposing) {
  console.log('Bob is typing...')
  // Show "Bob is typing..." in your UI
}
```

**How Composing Indicators Work:**

1. 👤 User starts typing in input field
2. 📤 Your app sends `sendComposingIndicator(uri, true)`
3. 🔔 Recipient sees "User is typing..." indicator
4. ⏰ Automatically times out after 10 seconds if not refreshed
5. 🛑 Send `sendComposingIndicator(uri, false)` when user stops typing

**Automatic Timeout:**
- ⏱️ Indicators automatically expire after 10 seconds
- 🔄 Send periodic updates while user is still typing
- ✅ Prevents stale "typing..." indicators if something fails

📝 **Note:** Composing indicators are **non-critical** - they're sent as SIP MESSAGE with special content type. They won't throw errors if they fail.

✅ **Best Practice:** Debounce composing indicators! Don't send one on every keystroke. Wait 300-500ms after the last keystroke (see Best Practices section for example).

⚠️ **Warning:** Not all SIP servers and clients support composing indicators. They're a "nice to have" feature but shouldn't be critical to your app.

---

## Conversations

VueSip automatically organizes your messages into **conversations** - a clean way to group all messages with each contact. This saves you the work of manually grouping and sorting messages.

**What's a conversation?**
A conversation is a collection of all messages (incoming and outgoing) exchanged with a specific user, along with metadata like unread count and composing status.

```typescript
const { conversations } = useMessaging(sipClient)

// Access conversations (Map of URI → Conversation)
conversations.value.forEach((conv, uri) => {
  console.log({
    uri: conv.uri,                    // The contact's SIP URI
    displayName: conv.displayName,     // Friendly name (if available)
    messages: conv.messages,           // Array of all messages with this contact
    unreadCount: conv.unreadCount,     // Number of unread messages
    lastMessageAt: conv.lastMessageAt, // Timestamp of most recent message
    isComposing: conv.isComposing     // Is this person typing right now?
  })
})

// Get a specific conversation
const aliceConv = conversations.value.get('sip:alice@example.com')
if (aliceConv) {
  console.log(`${aliceConv.unreadCount} unread messages from Alice`)
  console.log(`Last message: ${aliceConv.lastMessageAt}`)

  // Display all messages in this conversation
  aliceConv.messages.forEach(msg => {
    console.log(`${msg.direction}: ${msg.content}`)
  })
}
```

**Conversations automatically:**
- 📁 **Group messages** by peer URI (all Alice messages together)
- 🔢 **Track unread counts** per conversation
- 📅 **Sort messages** by timestamp within each conversation
- 🔄 **Update in real-time** when new messages arrive
- ⌨️ **Reflect composing indicators** for each contact

**Common Use Cases:**

```typescript
// Display conversation list sorted by recent activity
const sortedConversations = Array.from(conversations.value.values())
  .sort((a, b) => {
    // Sort by last message time, most recent first
    return b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
  })

// Show unread badge for each conversation
sortedConversations.forEach(conv => {
  if (conv.unreadCount > 0) {
    console.log(`[${conv.unreadCount}] ${conv.displayName}`)
  }
})

// Get total unread across all conversations
const totalUnread = Array.from(conversations.value.values())
  .reduce((sum, conv) => sum + conv.unreadCount, 0)
console.log(`${totalUnread} total unread messages`)
```

💡 **Tip:** The `conversations` map is reactive! Use it directly in your Vue template to build conversation lists that update automatically when new messages arrive.

✅ **Best Practice:** Sort conversations by `lastMessageAt` to show the most recent conversations first, just like messaging apps.

---

## Message Management

Beyond sending and receiving, you need to manage messages - marking them as read, deleting old messages, searching, and filtering. VueSip provides all the tools you need.

### Mark Messages as Read

Marking messages as read updates the unread count and sets the `isRead` flag. This is essential for badge counters and notification management.

```typescript
const { markAsRead, markAllAsRead } = useMessaging(sipClient)

// Mark a specific message as read
markAsRead('msg-123')
// Use case: User clicks on a message in the list

// Mark all messages from a specific user as read
markAllAsRead('sip:alice@example.com')
// Use case: User opens Alice's conversation - mark everything as read

// Mark ALL messages as read (from all users)
markAllAsRead()
// Use case: "Mark all as read" button in your UI
```

✅ **Best Practice:** Automatically mark messages as read when the user views a conversation. This keeps unread counts accurate and matches user expectations.

---

### Delete Messages

Delete individual messages or clear entire conversations. Useful for privacy, storage management, or letting users clean up their message history.

```typescript
const { deleteMessage, clearMessages } = useMessaging(sipClient)

// Delete a specific message
deleteMessage('msg-123')
// Use case: User long-presses and selects "Delete"

// Clear all messages from a specific user
clearMessages('sip:alice@example.com')
// Use case: "Clear conversation" button

// Clear ALL messages (nuclear option!)
clearMessages()
// Use case: "Delete all messages" in settings, or logout cleanup
```

⚠️ **Warning:** Deletion is permanent! Consider adding a confirmation dialog before clearing messages, especially for `clearMessages()` without parameters.

💡 **Tip:** Deleted messages are removed from memory only. For persistent storage, you'll need to implement your own database layer.

---

### Filter and Search Messages

Find specific messages using powerful filtering options. Perfect for search features, analytics, or building filtered views.

```typescript
const { getFilteredMessages, MessageDirection, MessageStatus } = useMessaging(sipClient)

// Filter by direction - only incoming messages
const incoming = getFilteredMessages({
  direction: MessageDirection.Incoming
})
// Use case: Show only messages you received

// Filter by status - find undelivered messages
const unread = getFilteredMessages({
  status: MessageStatus.Delivered // Messages delivered but not read
})
// Use case: Find which messages haven't been read yet

// Filter by date range - get messages from January
const recent = getFilteredMessages({
  dateFrom: new Date('2024-01-01'),
  dateTo: new Date('2024-01-31')
})
// Use case: Monthly message report or archive

// Search message content - full-text search
const searchResults = getFilteredMessages({
  searchQuery: 'meeting'
})
// Use case: Search bar - find all messages containing "meeting"

// Combine multiple filters for precise results
const results = getFilteredMessages({
  uri: 'sip:alice@example.com',           // Only Alice's messages
  direction: MessageDirection.Incoming,    // Only incoming
  status: MessageStatus.Delivered,         // Only delivered
  searchQuery: 'meeting',                  // Containing "meeting"
  dateFrom: new Date('2024-01-01')        // From January onwards
})
// Use case: Very specific searches like "Show me all delivered messages
// from Alice containing 'meeting' since January"
```

**Available Filters:**

| Filter | Type | Description |
|--------|------|-------------|
| `uri` | string | Filter messages with specific user |
| `direction` | enum | `Incoming` or `Outgoing` |
| `status` | enum | `Pending`, `Sent`, `Delivered`, `Read`, `Failed` |
| `searchQuery` | string | Search message content (case-insensitive) |
| `dateFrom` | Date | Messages after this date |
| `dateTo` | Date | Messages before this date |

💡 **Tip:** Combine `uri` with `searchQuery` to implement per-conversation search, just like WhatsApp or iMessage.

---

### Unread Count

Track the total number of unread messages across all conversations. Essential for notification badges and user awareness.

```typescript
const { unreadCount } = useMessaging(sipClient)

// Display badge count
console.log(`${unreadCount.value} unread messages`)

// Use in your template
<template>
  <div class="app-icon">
    <span v-if="unreadCount > 0" class="badge">
      {{ unreadCount }}
    </span>
  </div>
</template>

// Watch for changes to trigger actions
watch(unreadCount, (count) => {
  if (count > 0) {
    // Update browser tab title
    document.title = `(${count}) Messages`

    // Update native notification badge
    updateBadge(count)

    // Play notification sound (only if count increased)
    playNotificationSound()
  } else {
    // Reset when all messages are read
    document.title = 'Messages'
    updateBadge(0)
  }
})
```

💡 **Tip:** The `unreadCount` is reactive and automatically updates when messages are marked as read or new messages arrive.

✅ **Best Practice:** Update your browser tab title or favicon with the unread count so users can see notifications even when the tab is in the background.

---

## Best Practices

Follow these patterns to build robust, user-friendly presence and messaging features.

### Presence Best Practices

#### 1. Set Status on Connection

Always set your status when you connect to let others know you're online.

```typescript
const { isConnected } = useSipClient()
const { setStatus } = usePresence(sipClient)

// Watch connection status
watch(isConnected, async (connected) => {
  if (connected) {
    // Just connected - set status to available
    await setStatus(PresenceState.Available)
  }
})
```

✅ **Why:** This immediately broadcasts your availability to all watchers as soon as you're online.

---

#### 2. Update Status Based on User Activity

Automatically detect when the user goes idle and update their status accordingly.

```typescript
let idleTimeout: number

const handleActivity = () => {
  // User did something - clear any idle timeout
  clearTimeout(idleTimeout)

  // Set back to available
  setStatus(PresenceState.Available)

  // Set new timeout for idle detection
  idleTimeout = window.setTimeout(() => {
    // User has been idle for 10 minutes - mark as away
    setStatus(PresenceState.Away, {
      statusMessage: 'Idle for 10 minutes'
    })
  }, 10 * 60 * 1000) // 10 minutes
}

// Listen for user activity
window.addEventListener('mousemove', handleActivity)
window.addEventListener('keydown', handleActivity)
window.addEventListener('click', handleActivity)
```

✅ **Why:** Users often forget to set themselves as "Away". Auto-detection provides accurate presence without user intervention.

💡 **Tip:** Use the Page Visibility API to detect when users switch tabs and set them as Away.

---

#### 3. Set Offline Before Unload

Always set your status to offline when disconnecting or closing the app.

```typescript
onBeforeUnmount(async () => {
  // Component unmounting - set offline
  await setStatus(PresenceState.Offline)
})

// Or in browser context
window.addEventListener('beforeunload', () => {
  // Page closing - set offline (fire and forget, can't await)
  setStatus(PresenceState.Offline)
})
```

✅ **Why:** This immediately notifies all watchers that you're offline. Without this, they won't know until your presence expires (could be hours!).

⚠️ **Warning:** The `beforeunload` event is not reliable on mobile browsers. Consider using the Page Visibility API or background sync for mobile.

---

#### 4. Handle Subscription Limits

Many SIP servers limit the number of concurrent subscriptions. Respect these limits to avoid errors.

```typescript
const MAX_SUBSCRIPTIONS = 50 // Check your server's limit

const { subscribe, subscriptionCount } = usePresence(sipClient)

const safeSubscribe = async (uri: string) => {
  // Check if we're at the limit
  if (subscriptionCount.value >= MAX_SUBSCRIPTIONS) {
    console.warn('Subscription limit reached')
    // Could unsubscribe from least active users to make room
    return
  }

  await subscribe(uri)
}
```

✅ **Why:** Exceeding subscription limits will cause all new subscriptions to fail. Better to manage this proactively.

💡 **Tip:** Prioritize subscriptions - keep active contacts subscribed, unsubscribe from users you haven't messaged in weeks.

---

### Messaging Best Practices

#### 1. Handle Errors Gracefully

Network issues happen. Always wrap message sending in try-catch and provide user feedback.

```typescript
const { sendMessage } = useMessaging(sipClient)

const safeSendMessage = async (to: string, content: string) => {
  try {
    await sendMessage(to, content)
    // Success - show confirmation
    showSuccess('Message sent')
  } catch (error) {
    // Failed - inform user
    showError('Failed to send message')
    console.error(error)
    // Could also offer a retry button
  }
}
```

✅ **Why:** Silent failures are frustrating. Always give users feedback about what happened.

---

#### 2. Implement Retry Logic

For critical messages, automatically retry failed sends with exponential backoff.

```typescript
const retryMessage = async (messageId: string, maxRetries = 3) => {
  const message = messages.value.find(m => m.id === messageId)
  if (!message || message.status !== MessageStatus.Failed) return

  // Retry up to maxRetries times
  for (let i = 0; i < maxRetries; i++) {
    try {
      await sendMessage(message.to, message.content)
      deleteMessage(messageId) // Remove failed copy
      return // Success!
    } catch (error) {
      // Failed - wait before retrying
      if (i === maxRetries - 1) throw error // Final attempt failed

      // Exponential backoff: wait 1s, then 2s, then 3s
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
}
```

✅ **Why:** Temporary network issues shouldn't cause permanent message loss. Auto-retry improves reliability.

💡 **Tip:** Show a "Retrying..." indicator in the UI so users know the app is working to send their message.

---

#### 3. Auto-Mark Messages as Read

Mark messages as read automatically when the user views a conversation.

```typescript
const { markAllAsRead } = useMessaging(sipClient)

const openConversation = (uri: string) => {
  // Open conversation UI
  showConversation(uri)

  // Mark all messages from this user as read
  markAllAsRead(uri)
}
```

✅ **Why:** Users expect messages to be marked as read when they view them. This matches familiar messaging app behavior.

---

#### 4. Debounce Composing Indicators

Don't send a composing indicator on every keystroke - that's wasteful and spammy.

```typescript
import { useDebounceFn } from '@vueuse/core'

const { sendComposingIndicator } = useMessaging(sipClient)

// Debounced version - waits 500ms after last keystroke
const sendComposing = useDebounceFn((to: string, isComposing: boolean) => {
  sendComposingIndicator(to, isComposing)
}, 500)

const handleInput = (to: string, text: string) => {
  // This will only send after user stops typing for 500ms
  sendComposing(to, text.length > 0)
}
```

✅ **Why:** Reduces server load and network traffic. A 500ms delay is imperceptible to users but significantly reduces the number of requests.

---

#### 5. Limit Message History

Prevent memory bloat by keeping only recent messages in memory.

```typescript
const MAX_MESSAGES = 1000 // Keep last 1000 messages

watch(messages, (msgs) => {
  if (msgs.length > MAX_MESSAGES) {
    // Find oldest messages
    const toRemove = msgs
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(0, msgs.length - MAX_MESSAGES)

    // Delete them
    toRemove.forEach(msg => deleteMessage(msg.id))
  }
})
```

✅ **Why:** Unlimited message storage will eventually cause performance issues. Keep only what you need.

💡 **Tip:** For apps that need full history, consider moving old messages to IndexedDB or a backend database instead of deleting them.

---

## Advanced Examples

Complete, production-ready examples combining multiple features.

### Complete Presence Integration

A full presence system with buddy list, status changes, and automatic subscription management.

```typescript
<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useSipClient, usePresence, PresenceState } from 'vuesip'

const { sipClient, isConnected } = useSipClient()
const {
  setStatus,
  subscribe,
  unsubscribe,
  watchedUsers,
  currentState,
  onPresenceEvent
} = usePresence(sipClient)

// Your contact list (could come from API or database)
const buddyList = ref([
  'sip:alice@example.com',
  'sip:bob@example.com',
  'sip:charlie@example.com'
])

// Set status and subscribe to buddies when connected
watch(isConnected, async (connected) => {
  if (connected) {
    // Step 1: Announce we're online
    await setStatus(PresenceState.Available, {
      statusMessage: 'Online'
    })

    // Step 2: Subscribe to all buddies to watch their status
    for (const buddy of buddyList.value) {
      await subscribe(buddy)
    }
  }
})

// Listen for presence updates in real-time
onPresenceEvent((event) => {
  if (event.type === 'updated') {
    console.log(`${event.uri} is now ${event.status?.state}`)

    // Could show notification: "Alice is now available"
    // Could play sound when important contacts come online
    // Could update UI badge counts
  }
})

// Helper to change your status
const changeStatus = async (state: PresenceState, message?: string) => {
  await setStatus(state, { statusMessage: message })
}

// Cleanup on component unmount
onBeforeUnmount(async () => {
  // Set offline so buddies know we're gone
  await setStatus(PresenceState.Offline)

  // Unsubscribe from all buddies
  await unsubscribeAll()
})
</script>

<template>
  <div class="presence-panel">
    <!-- Your status controls -->
    <div class="my-status">
      <h3>My Status: {{ currentState }}</h3>
      <button @click="changeStatus(PresenceState.Available)">
        Available
      </button>
      <button @click="changeStatus(PresenceState.Away)">
        Away
      </button>
      <button @click="changeStatus(PresenceState.Busy)">
        Busy
      </button>
    </div>

    <!-- Buddy list showing each contact's status -->
    <div class="buddy-list">
      <h3>Contacts</h3>
      <div
        v-for="(status, uri) in watchedUsers"
        :key="uri"
        class="buddy"
      >
        <!-- Status indicator (green, yellow, red dot) -->
        <span
          class="status-indicator"
          :class="status.state"
        ></span>

        <!-- Contact name/URI -->
        <span class="uri">{{ uri }}</span>

        <!-- Status message (e.g., "In a meeting") -->
        <span class="status-message">{{ status.statusMessage }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Visual status indicators */
.status-indicator {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-indicator.available { background: #00ff00; }
.status-indicator.away { background: #ffaa00; }
.status-indicator.busy { background: #ff0000; }
.status-indicator.offline { background: #888888; }
</style>
```

---

### Complete Messaging Integration

A full messaging interface with conversation list, chat window, and typing indicators.

```typescript
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useSipClient, useMessaging } from 'vuesip'

const { sipClient } = useSipClient()
const {
  sendMessage,
  messages,
  conversations,
  unreadCount,
  composingIndicators,
  sendComposingIndicator,
  markAllAsRead,
  onMessagingEvent
} = useMessaging(sipClient)

// Currently selected conversation
const currentChat = ref<string | null>(null)

// Message input field
const messageInput = ref('')

// Get messages for current conversation
const currentMessages = computed(() => {
  if (!currentChat.value) return []
  return conversations.value.get(currentChat.value)?.messages || []
})

// Check if the other person is typing
const peerIsTyping = computed(() => {
  if (!currentChat.value) return false
  return composingIndicators.value.get(currentChat.value)?.isComposing || false
})

// Send a message
const handleSend = async () => {
  if (!messageInput.value.trim() || !currentChat.value) return

  try {
    // Send the message
    await sendMessage(currentChat.value, messageInput.value)

    // Clear input
    messageInput.value = ''

    // Stop composing indicator
    await sendComposingIndicator(currentChat.value, false)
  } catch (error) {
    console.error('Failed to send message:', error)
    // Could show error to user here
  }
}

// Handle typing - send composing indicator
let composingTimer: number
watch(messageInput, (value) => {
  if (!currentChat.value) return

  // Clear previous timer
  clearTimeout(composingTimer)

  if (value.length > 0) {
    // User is typing - send composing indicator
    sendComposingIndicator(currentChat.value, true)

    // Auto-stop after 10 seconds of no typing
    composingTimer = window.setTimeout(() => {
      sendComposingIndicator(currentChat.value!, false)
    }, 10000)
  } else {
    // Input cleared - stop composing indicator
    sendComposingIndicator(currentChat.value, false)
  }
})

// Open a conversation
const openChat = (uri: string) => {
  currentChat.value = uri

  // Mark all messages in this conversation as read
  markAllAsRead(uri)
}

// Listen for new messages
onMessagingEvent((event) => {
  if (event.type === 'received') {
    // New message arrived

    if (event.message.from !== currentChat.value) {
      // Message from someone else - show notification
      showNotification(`New message from ${event.message.from}`)
    } else {
      // Message from current chat - auto-mark as read
      markAllAsRead(event.message.from)
    }
  }
})
</script>

<template>
  <div class="messaging-app">
    <!-- Left sidebar: Conversation list -->
    <aside class="conversation-list">
      <h2>
        Messages
        <!-- Unread badge -->
        <span v-if="unreadCount > 0" class="badge">
          {{ unreadCount }}
        </span>
      </h2>

      <!-- List of conversations -->
      <div
        v-for="(conv, uri) in conversations"
        :key="uri"
        class="conversation-item"
        :class="{ active: uri === currentChat }"
        @click="openChat(uri)"
      >
        <div class="conv-header">
          <!-- Contact name -->
          <span class="uri">{{ conv.displayName || uri }}</span>

          <!-- Unread count for this conversation -->
          <span v-if="conv.unreadCount > 0" class="unread-badge">
            {{ conv.unreadCount }}
          </span>
        </div>

        <div class="conv-preview">
          <!-- Show typing indicator or last message preview -->
          <span v-if="conv.isComposing" class="typing">
            typing...
          </span>
          <span v-else class="last-message">
            {{ conv.messages[conv.messages.length - 1]?.content }}
          </span>
        </div>
      </div>
    </aside>

    <!-- Right side: Chat window -->
    <main class="chat-window">
      <div v-if="currentChat" class="chat-content">
        <!-- Chat header -->
        <header class="chat-header">
          <h3>{{ currentChat }}</h3>
        </header>

        <!-- Messages -->
        <div class="messages">
          <div
            v-for="msg in currentMessages"
            :key="msg.id"
            class="message"
            :class="msg.direction"
          >
            <!-- Message bubble -->
            <div class="message-content">
              {{ msg.content }}
            </div>

            <!-- Timestamp and status -->
            <div class="message-meta">
              {{ msg.timestamp.toLocaleTimeString() }}

              <!-- Show delivery/read status for outgoing messages -->
              <span v-if="msg.direction === 'outgoing'" class="status">
                {{ msg.status }}
              </span>
            </div>
          </div>
        </div>

        <!-- Typing indicator -->
        <div v-if="peerIsTyping" class="typing-indicator">
          typing...
        </div>

        <!-- Message input -->
        <footer class="chat-input">
          <input
            v-model="messageInput"
            type="text"
            placeholder="Type a message..."
            @keyup.enter="handleSend"
          />
          <button @click="handleSend">Send</button>
        </footer>
      </div>

      <!-- Empty state -->
      <div v-else class="no-chat">
        Select a conversation to start messaging
      </div>
    </main>
  </div>
</template>
```

---

### Combined Presence and Messaging

Combine both systems to show contact availability alongside conversations.

```typescript
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useSipClient, usePresence, useMessaging, PresenceState } from 'vuesip'

const { sipClient } = useSipClient()

// Initialize both composables
const { watchedUsers, subscribe } = usePresence(sipClient)
const { conversations, sendMessage } = useMessaging(sipClient)

// Combine presence and messaging data into unified contact list
const contacts = computed(() => {
  const result = []

  // Iterate through all conversations
  for (const [uri, conv] of conversations.value) {
    // Get presence data for this contact
    const presence = watchedUsers.value.get(uri)

    // Combine all data
    result.push({
      uri,
      // Presence info
      presence: presence?.state || PresenceState.Offline,
      statusMessage: presence?.statusMessage,
      // Messaging info
      unreadCount: conv.unreadCount,
      lastMessage: conv.messages[conv.messages.length - 1],
      isComposing: conv.isComposing
    })
  }

  // Sort by priority: unread first, then by recent activity
  return result.sort((a, b) => {
    // Unread messages come first
    if (a.unreadCount !== b.unreadCount) {
      return b.unreadCount - a.unreadCount
    }
    // Then sort by most recent message
    const aTime = a.lastMessage?.timestamp.getTime() || 0
    const bTime = b.lastMessage?.timestamp.getTime() || 0
    return bTime - aTime
  })
})

// Quick message - only allow if user is available
const quickMessage = async (uri: string) => {
  const presence = watchedUsers.value.get(uri)

  if (presence?.state === PresenceState.Available) {
    // User is available - send message
    await sendMessage(uri, 'Quick hello!')
  } else {
    // User not available - show warning
    console.log('User not available right now')
    // Could show toast: "Alice is currently busy"
  }
}
</script>

<template>
  <div class="contact-list">
    <div
      v-for="contact in contacts"
      :key="contact.uri"
      class="contact"
    >
      <!-- Presence indicator (colored dot) -->
      <div
        class="presence-indicator"
        :class="contact.presence"
      ></div>

      <div class="contact-info">
        <!-- Contact name -->
        <div class="contact-name">
          {{ contact.uri }}
        </div>

        <!-- Status message from presence -->
        <div class="contact-status">
          {{ contact.statusMessage }}
        </div>

        <!-- Typing indicator -->
        <div v-if="contact.isComposing" class="composing">
          typing...
        </div>
      </div>

      <!-- Unread badge -->
      <div v-if="contact.unreadCount > 0" class="unread-badge">
        {{ contact.unreadCount }}
      </div>

      <!-- Quick message button (disabled if not available) -->
      <button
        @click="quickMessage(contact.uri)"
        :disabled="contact.presence !== PresenceState.Available"
      >
        Message
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Different colors for different presence states */
.presence-indicator.available { background: #00ff00; }
.presence-indicator.away { background: #ffaa00; }
.presence-indicator.busy { background: #ff0000; }
.presence-indicator.offline { background: #888888; }

/* Disabled button styling */
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

---

## Troubleshooting

**What you'll learn:** Solutions to common presence and messaging problems you might encounter.

This section helps you diagnose and fix issues with presence status updates, message delivery, subscriptions, and more.

### Presence Status Not Updating

**Problem:** You set your status but other users don't see the update, or you don't receive updates from users you're watching.

**Symptoms:**
- `setStatus()` succeeds but watchers don't get notified
- `watchedUsers` map doesn't update when remote status changes
- Status appears stuck on last known value

**Solutions:**

1. **Verify server supports presence**

   Not all SIP servers support PUBLISH/SUBSCRIBE/NOTIFY for presence.

   ```typescript
   // Enable debug mode to see if PUBLISH is successful
   const { setStatus } = usePresence(sipClient, { debug: true })

   try {
     await setStatus(PresenceState.Available)
     // Check console for SIP 200 OK response
   } catch (error) {
     console.error('Presence error:', error)
     // Look for 489 Bad Event or 501 Not Implemented
   }
   ```

   **Common error codes:**
   - `489 Bad Event` - Server doesn't support presence event package
   - `501 Not Implemented` - Server doesn't implement PUBLISH method
   - `403 Forbidden` - You're not authorized to publish presence

2. **Check subscription status**

   ```typescript
   const { subscriptions, subscriptionCount } = usePresence(sipClient)

   // Verify subscriptions are active
   console.log(`Active subscriptions: ${subscriptionCount.value}`)

   subscriptions.value.forEach((sub, uri) => {
     console.log(`${uri}: ${sub.state}`)  // Should be 'active'
     if (sub.state === 'terminated' || sub.state === 'pending') {
       console.warn(`Subscription issue for ${uri}`)
     }
   })
   ```

3. **Verify subscription expiry isn't too short**

   ```typescript
   // Subscriptions may expire too quickly
   await subscribe('sip:alice@example.com', {
     expires: 3600  // Use at least 1 hour (3600 seconds)
   })
   ```

4. **Check for subscription limits**

   Many SIP servers limit concurrent subscriptions (typically 50-100).

   ```typescript
   if (subscriptionCount.value >= 50) {
     console.warn('Approaching subscription limit')
     // Unsubscribe from inactive users
     await unsubscribe('sip:inactive@example.com')
   }
   ```

5. **Monitor presence events for errors**

   ```typescript
   onPresenceEvent((event) => {
     if (event.type === 'error') {
       console.error(`Presence error for ${event.uri}:`, event.error)
       // Re-subscribe if subscription failed
       if (event.error.code === 'SUBSCRIPTION_FAILED') {
         setTimeout(() => subscribe(event.uri), 5000)
       }
     }
   })
   ```

---

### Messages Not Sending or Receiving

**Problem:** Messages fail to send, or you don't receive incoming messages from other users.

**Symptoms:**
- `sendMessage()` throws error or times out
- Message status stuck on 'pending' or 'sending'
- No `received` events for incoming messages
- Messages appear sent but recipient never receives them

**Solutions:**

1. **Verify server supports SIP MESSAGE method**

   ```typescript
   const { sendMessage, onMessagingEvent } = useMessaging(sipClient)

   // Listen for send failures
   onMessagingEvent((event) => {
     if (event.type === 'failed') {
       console.error('Message failed:', event.error)

       // Check for specific error codes
       if (event.error.code === 405) {
         console.error('Server does not support MESSAGE method')
       } else if (event.error.code === 404) {
         console.error('Recipient not found')
       } else if (event.error.code === 480) {
         console.error('Recipient temporarily unavailable')
       }
     }
   })

   try {
     await sendMessage('sip:bob@example.com', 'Test')
   } catch (error) {
     console.error('Send failed:', error)
   }
   ```

   **Common SIP error codes:**
   - `404 Not Found` - Recipient doesn't exist
   - `405 Method Not Allowed` - Server doesn't support MESSAGE
   - `480 Temporarily Unavailable` - Recipient offline
   - `606 Not Acceptable` - Message content type not supported

2. **Check message content type compatibility**

   ```typescript
   // Use plain text for maximum compatibility
   await sendMessage('sip:bob@example.com', 'Hello', {
     contentType: MessageContentType.Text  // Most widely supported
   })

   // HTML and JSON may not be supported by all clients
   // Test with plain text first
   ```

3. **Verify you're registered**

   You must be registered to send/receive messages.

   ```typescript
   const { isRegistered } = useSipClient()
   const { sendMessage } = useMessaging(sipClient)

   if (!isRegistered.value) {
     console.error('Cannot send message - not registered')
     return
   }

   await sendMessage('sip:bob@example.com', 'Hello')
   ```

4. **Check for network/firewall issues**

   ```typescript
   // Add timeout to detect network issues
   const timeout = setTimeout(() => {
     console.warn('Message send taking longer than expected - possible network issue')
   }, 5000)

   try {
     await sendMessage('sip:bob@example.com', 'Hello')
     clearTimeout(timeout)
   } catch (error) {
     clearTimeout(timeout)
     console.error('Network error:', error)
   }
   ```

5. **Implement retry logic for failed messages**

   ```typescript
   const retryMessage = async (to: string, content: string, maxRetries = 3) => {
     for (let attempt = 1; attempt <= maxRetries; attempt++) {
       try {
         await sendMessage(to, content)
         console.log('Message sent successfully')
         return
       } catch (error) {
         console.warn(`Attempt ${attempt}/${maxRetries} failed`)

         if (attempt === maxRetries) {
           throw new Error('Max retries exceeded')
         }

         // Exponential backoff: 1s, 2s, 4s
         await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)))
       }
     }
   }
   ```

---

### Delivery Receipts Not Working

**Problem:** You request delivery or read notifications but never receive them.

**Symptoms:**
- Message status never progresses beyond 'sent'
- No `delivered` or `read` events fire
- `deliveredAt` and `readAt` remain undefined

**Solutions:**

1. **Understand server and client support requirements**

   ⚠️ **Important:** Delivery receipts require support from:
   - Your SIP server (must route IMDN notifications)
   - The recipient's SIP client (must send notifications)
   - Both clients must support the IMDN extension

   ```typescript
   // Request notifications, but don't rely on them
   await sendMessage('sip:bob@example.com', 'Important message', {
     requestDeliveryNotification: true,
     requestReadNotification: true
   })

   // Treat delivery/read receipts as optional enhancement
   // Don't block on waiting for them
   ```

2. **Check what your server supports**

   ```typescript
   // Many servers don't support IMDN
   // Test with known compatible clients first

   onMessagingEvent((event) => {
     if (event.type === 'delivered') {
       console.log('Server supports delivery receipts!')
     }
     if (event.type === 'read') {
       console.log('Server supports read receipts!')
     }
   })
   ```

3. **Don't depend on receipts for critical functionality**

   ```typescript
   // ❌ Bad - Blocking on receipt
   await sendMessage(to, content, { requestDeliveryNotification: true })
   await waitForDelivery()  // This may never resolve!

   // ✅ Good - Treat receipts as enhancement
   await sendMessage(to, content, { requestDeliveryNotification: true })
   // Continue without waiting - update UI if receipt arrives later
   ```

---

### Composing Indicators Not Appearing

**Problem:** You send composing indicators but the recipient doesn't see "typing..." indicator.

**Symptoms:**
- `sendComposingIndicator()` succeeds but no visual update on recipient side
- `composingIndicators` map never updates
- No `isComposing` state changes

**Solutions:**

1. **Verify both clients support composing indicators**

   Composing indicators are sent as special SIP MESSAGE with `application/im-iscomposing+xml` content type.

   ```typescript
   const { sendComposingIndicator, composingIndicators } = useMessaging(sipClient)

   // This may fail silently if not supported
   await sendComposingIndicator('sip:bob@example.com', true)

   // Check if you receive indicators from others
   watch(composingIndicators, (indicators) => {
     console.log('Composing indicators:', indicators)
     // If this never updates, server may not support them
   })
   ```

2. **Understand automatic timeout**

   Composing indicators automatically expire after 10 seconds.

   ```typescript
   // Send initial indicator
   await sendComposingIndicator('sip:bob@example.com', true)

   // Refresh every 5 seconds while user is still typing
   const refreshInterval = setInterval(async () => {
     if (isUserStillTyping()) {
       await sendComposingIndicator('sip:bob@example.com', true)
     } else {
       clearInterval(refreshInterval)
       await sendComposingIndicator('sip:bob@example.com', false)
     }
   }, 5000)
   ```

3. **Don't rely on composing indicators for critical functionality**

   ```typescript
   // Composing indicators are a "nice to have" feature
   // Your app should work fine without them

   try {
     await sendComposingIndicator(to, true)
   } catch (error) {
     // Fail silently - don't show error to user
     console.debug('Composing indicator not supported')
   }
   ```

---

### High Message Counts Causing Performance Issues

**Problem:** App becomes slow or unresponsive with large message history.

**Symptoms:**
- UI lags when scrolling through messages
- Memory usage grows over time
- `messages` array becomes very large
- App crashes on mobile devices

**Solutions:**

1. **Implement message history limits**

   ```typescript
   const MAX_MESSAGES = 500  // Keep last 500 messages per conversation

   watch(messages, (allMessages) => {
     // Group by conversation
     const byConversation = new Map<string, Message[]>()

     allMessages.forEach(msg => {
       const key = msg.direction === 'incoming' ? msg.from : msg.to
       if (!byConversation.has(key)) {
         byConversation.set(key, [])
       }
       byConversation.get(key)!.push(msg)
     })

     // Trim each conversation to MAX_MESSAGES
     byConversation.forEach((msgs, uri) => {
       if (msgs.length > MAX_MESSAGES) {
         const toDelete = msgs
           .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
           .slice(0, msgs.length - MAX_MESSAGES)

         toDelete.forEach(msg => deleteMessage(msg.id))
       }
     })
   })
   ```

2. **Use virtual scrolling for large message lists**

   ```vue
   <template>
     <!-- Use virtual scroller for performance -->
     <RecycleScroller
       :items="currentMessages"
       :item-size="80"
       key-field="id"
     >
       <template #default="{ item }">
         <MessageBubble :message="item" />
       </template>
     </RecycleScroller>
   </template>
   ```

3. **Implement pagination/lazy loading**

   ```typescript
   const messagesPerPage = 50
   const currentPage = ref(1)

   const visibleMessages = computed(() => {
     const start = (currentPage.value - 1) * messagesPerPage
     const end = start + messagesPerPage
     return currentMessages.value.slice(start, end)
   })

   // Load more when user scrolls to top
   const loadOlderMessages = () => {
     currentPage.value++
   }
   ```

4. **Archive old messages to IndexedDB**

   ```typescript
   // Archive messages older than 30 days to browser storage
   const archiveOldMessages = async () => {
     const thirtyDaysAgo = new Date()
     thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

     const oldMessages = getFilteredMessages({
       dateTo: thirtyDaysAgo
     })

     // Save to IndexedDB
     await saveToIndexedDB(oldMessages)

     // Remove from memory
     oldMessages.forEach(msg => deleteMessage(msg.id))
   }

   // Run daily
   setInterval(archiveOldMessages, 24 * 60 * 60 * 1000)
   ```

---

### Subscription Limit Errors

**Problem:** Server rejects new presence subscriptions with 403 or 500 errors.

**Symptoms:**
- `subscribe()` fails after certain number of subscriptions
- Error: "Too many subscriptions" or similar
- Some subscriptions work, others fail

**Solutions:**

1. **Check your server's subscription limit**

   ```typescript
   // Most servers limit to 50-200 concurrent subscriptions
   const { subscriptionCount, subscribe } = usePresence(sipClient)

   const MAX_SUBSCRIPTIONS = 50  // Adjust based on your server

   const safeSubscribe = async (uri: string) => {
     if (subscriptionCount.value >= MAX_SUBSCRIPTIONS) {
       throw new Error('Subscription limit reached')
     }

     await subscribe(uri)
   }
   ```

2. **Implement subscription priority system**

   ```typescript
   // Prioritize active contacts
   interface ContactPriority {
     uri: string
     priority: number  // Higher = more important
     lastInteraction: Date
   }

   const manageSubscriptions = async (contacts: ContactPriority[]) => {
     // Sort by priority
     const sorted = contacts.sort((a, b) => b.priority - a.priority)

     // Subscribe to top N contacts
     const toSubscribe = sorted.slice(0, MAX_SUBSCRIPTIONS)

     for (const contact of toSubscribe) {
       if (!watchedUsers.value.has(contact.uri)) {
         await subscribe(contact.uri)
       }
     }

     // Unsubscribe from low-priority contacts
     watchedUsers.value.forEach((status, uri) => {
       if (!toSubscribe.find(c => c.uri === uri)) {
         unsubscribe(uri)
       }
     })
   }
   ```

3. **Unsubscribe from inactive users**

   ```typescript
   // Automatically unsubscribe from users you haven't messaged in 7 days
   const cleanupInactiveSubscriptions = () => {
     const sevenDaysAgo = new Date()
     sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

     watchedUsers.value.forEach((status, uri) => {
       const conversation = conversations.value.get(uri)

       if (!conversation || conversation.lastMessageAt < sevenDaysAgo) {
         unsubscribe(uri)
       }
     })
   }

   // Run periodically
   setInterval(cleanupInactiveSubscriptions, 60 * 60 * 1000)  // Every hour
   ```

---

### Network Disconnection and Reconnection

**Problem:** Network drops and presence/messaging state becomes inconsistent.

**Symptoms:**
- Subscriptions show 'terminated' after network issue
- Messages fail to send after reconnection
- Presence status not updating after reconnect

**Solutions:**

1. **Detect reconnection and restore subscriptions**

   ```typescript
   const { isConnected } = useSipClient()
   const { subscribe, unsubscribeAll } = usePresence(sipClient)

   // Store subscription list
   const subscribedUris = ref<string[]>([])

   watch(isConnected, async (connected, wasConnected) => {
     if (connected && wasConnected === false) {
       console.log('Reconnected - restoring subscriptions')

       // Clear any stale subscriptions
       await unsubscribeAll()

       // Re-subscribe to all previous contacts
       for (const uri of subscribedUris.value) {
         try {
           await subscribe(uri)
         } catch (error) {
           console.warn(`Failed to restore subscription to ${uri}`)
         }
       }

       // Re-publish presence
       await setStatus(PresenceState.Available)
     }
   })

   // Track subscriptions
   onPresenceEvent((event) => {
     if (event.type === 'subscribed') {
       if (!subscribedUris.value.includes(event.uri)) {
         subscribedUris.value.push(event.uri)
       }
     } else if (event.type === 'unsubscribed') {
       subscribedUris.value = subscribedUris.value.filter(uri => uri !== event.uri)
     }
   })
   ```

2. **Queue messages during disconnection**

   ```typescript
   const messageQueue = ref<Array<{to: string, content: string}>>([])

   const safeSendMessage = async (to: string, content: string) => {
     if (!isConnected.value) {
       // Queue for later
       messageQueue.value.push({ to, content })
       console.log('Message queued - offline')
       return
     }

     try {
       await sendMessage(to, content)
     } catch (error) {
       // If send fails, queue it
       messageQueue.value.push({ to, content })
       console.warn('Message queued - send failed')
     }
   }

   // Send queued messages on reconnect
   watch(isConnected, async (connected) => {
     if (connected && messageQueue.value.length > 0) {
       console.log(`Sending ${messageQueue.value.length} queued messages`)

       const queue = [...messageQueue.value]
       messageQueue.value = []

       for (const msg of queue) {
         try {
           await sendMessage(msg.to, msg.content)
         } catch (error) {
           // Re-queue if still failing
           messageQueue.value.push(msg)
         }
       }
     }
   })
   ```

---

### Common Error Codes Reference

Understanding SIP error codes helps diagnose issues quickly:

#### Presence-Related Errors

| Code | Meaning | Solution |
|------|---------|----------|
| `403` | Forbidden | Not authorized to publish/subscribe - check permissions |
| `404` | Not Found | User doesn't exist - verify SIP URI |
| `405` | Method Not Allowed | Server doesn't allow PUBLISH/SUBSCRIBE - check server config |
| `489` | Bad Event | Event package not supported - server doesn't support presence |
| `501` | Not Implemented | PUBLISH/SUBSCRIBE not implemented on server |
| `600` | Busy Everywhere | User has Do Not Disturb enabled |

#### Messaging-Related Errors

| Code | Meaning | Solution |
|------|---------|----------|
| `404` | Not Found | Recipient doesn't exist - verify SIP URI |
| `405` | Method Not Allowed | MESSAGE method not allowed - check server config |
| `413` | Request Entity Too Large | Message too large - reduce message size |
| `415` | Unsupported Media Type | Content type not supported - use text/plain |
| `480` | Temporarily Unavailable | Recipient offline - queue for later |
| `606` | Not Acceptable | Message format rejected - change content type |

## Mobile & Browser Compatibility

**What you'll learn:** Platform-specific considerations and best practices for presence and messaging on mobile browsers and different platforms.

Presence and messaging features work across modern browsers, but there are platform-specific considerations, especially for mobile devices.

### Browser Support Matrix

| Browser | Desktop Presence | Desktop Messaging | Mobile Presence | Mobile Messaging | Notes |
|---------|------------------|-------------------|-----------------|------------------|-------|
| **Chrome** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Best support, recommended |
| **Firefox** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Excellent support |
| **Safari** | ✅ Full | ✅ Full | ⚠️ Limited | ⚠️ Limited | Background limitations |
| **Edge** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | Chromium-based, same as Chrome |
| **Samsung Internet** | ✅ Full | ✅ Full | ✅ Good | ✅ Good | Minor quirks on Android |

**Legend:**
- ✅ Full - All features work without issues
- ⚠️ Limited - Features work but with platform restrictions
- ❌ No - Not supported or significant issues

### HTTPS Requirement

⚠️ **Critical:** Both presence and messaging require HTTPS in production environments.

```typescript
// ✅ Works in production
wss://sip.example.com:7443  // Secure WebSocket over HTTPS

// ✅ Works in development
ws://localhost:7443         // Localhost exception

// ❌ Fails in production
ws://sip.example.com:7443   // Insecure WebSocket over HTTP
```

**Why HTTPS is required:**
- SIP over WebSocket (WSS) requires secure connection
- Browser security policies block insecure WebSocket on HTTPS pages
- Modern browsers require HTTPS for many features

### Mobile Platform Considerations

#### iOS Safari Limitations

iOS Safari has specific restrictions that affect presence and messaging:

**1. Background Tab Behavior**

When the app goes to background, WebSocket connections are suspended:

```typescript
// Detect when app goes to background/foreground
document.addEventListener('visibilitychange', async () => {
  const { isConnected, connect, disconnect } = useSipClient()
  const { setStatus, subscribe, unsubscribeAll } = usePresence(sipClient)

  if (document.hidden) {
    // App went to background
    console.log('App backgrounded - connection may suspend')

    // Option 1: Set status to away
    await setStatus(PresenceState.Away, {
      statusMessage: 'Away from device'
    })

    // Option 2: Gracefully disconnect (recommended for long background periods)
    // await disconnect()

  } else {
    // App came to foreground
    console.log('App foregrounded - reconnecting if needed')

    if (!isConnected.value) {
      await connect()
      // Restore presence subscriptions
      await restoreSubscriptions()
    }

    // Update status back to available
    await setStatus(PresenceState.Available)
  }
})
```

**2. WebSocket Timeout**

iOS suspends network activity after ~30 seconds in background:

```typescript
// Implement ping/pong to keep connection alive
const startKeepAlive = () => {
  const interval = setInterval(() => {
    if (!document.hidden && isConnected.value) {
      // Send keep-alive (implementation depends on your SIP server)
      sipClient.sendOptions('sip:keepalive@example.com')
    }
  }, 25000)  // Every 25 seconds, before iOS 30s timeout

  return () => clearInterval(interval)
}

// Start keep-alive when connected
watch(isConnected, (connected) => {
  if (connected) {
    const stopKeepAlive = startKeepAlive()

    // Clean up on disconnect
    watch(isConnected, (stillConnected) => {
      if (!stillConnected) {
        stopKeepAlive()
      }
    }, { once: true })
  }
})
```

**3. Notification Limitations**

iOS doesn't support Web Push notifications for WebSocket events:

```typescript
// Use local notifications for incoming messages when app is active
const { onMessagingEvent } = useMessaging(sipClient)

onMessagingEvent((event) => {
  if (event.type === 'received') {
    // Check if app has focus
    if (document.hidden) {
      // App in background - show local notification
      showLocalNotification({
        title: `Message from ${event.message.from}`,
        body: event.message.content,
        icon: '/icons/message.png'
      })
    }
  }
})

const showLocalNotification = (options: any) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(options.title, {
      body: options.body,
      icon: options.icon
    })
  }
}

// Request notification permission on app start
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}
```

#### Android Considerations

Android browsers handle background activity more gracefully but have their own quirks:

**1. Battery Optimization**

Android may throttle background WebSocket connections to save battery:

```typescript
// Detect battery optimization and warn user
const checkBatteryOptimization = async () => {
  // Check if app is in power-saving mode
  if ('getBattery' in navigator) {
    const battery = await (navigator as any).getBattery()

    battery.addEventListener('levelchange', () => {
      if (battery.level < 0.2) {
        // Warn user that presence may be affected
        showWarning('Low battery may affect real-time presence updates')

        // Consider reducing subscription count
        reduceLowPrioritySubscriptions()
      }
    })
  }
}

const reduceLowPrioritySubscriptions = () => {
  const { unsubscribe, watchedUsers } = usePresence(sipClient)

  // Unsubscribe from users you haven't messaged recently
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  watchedUsers.value.forEach((status, uri) => {
    const conversation = conversations.value.get(uri)
    if (!conversation || conversation.lastMessageAt < sevenDaysAgo) {
      unsubscribe(uri)
    }
  })
}
```

**2. Chrome Mobile Quirks**

Chrome on Android may show "site running in background" notifications:

```typescript
// Configure connection to minimize battery usage
const mobileOptimizedConfig = {
  uri: 'wss://sip.example.com:7443',
  sipUri: 'sip:user@example.com',
  password: 'secret',

  // Reduce keepalive frequency on mobile
  wsOptions: {
    keepAliveInterval: isMobile() ? 60000 : 25000  // 60s on mobile, 25s on desktop
  },

  // Adjust registration expiry
  registrationOptions: {
    expires: isMobile() ? 300 : 600  // 5min on mobile, 10min on desktop
  }
}

const isMobile = () => {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}
```

### Performance Optimization for Mobile

#### Reduce Data Usage

Mobile users often have limited data plans. Optimize presence and messaging for data efficiency:

```typescript
// Limit message history on mobile
const MAX_MESSAGES_MOBILE = 100
const MAX_MESSAGES_DESKTOP = 500

const messageLimit = isMobile() ? MAX_MESSAGES_MOBILE : MAX_MESSAGES_DESKTOP

// Automatically clean old messages
watch(messages, (msgs) => {
  if (msgs.length > messageLimit) {
    const toDelete = msgs
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(0, msgs.length - messageLimit)

    toDelete.forEach(msg => deleteMessage(msg.id))
  }
})

// Reduce subscription count on mobile
const MAX_SUBSCRIPTIONS_MOBILE = 25
const MAX_SUBSCRIPTIONS_DESKTOP = 50

const subscriptionLimit = isMobile()
  ? MAX_SUBSCRIPTIONS_MOBILE
  : MAX_SUBSCRIPTIONS_DESKTOP
```

#### Optimize Composing Indicators

Composing indicators can generate significant network traffic. Optimize for mobile:

```typescript
// Debounce composing indicators more aggressively on mobile
const { sendComposingIndicator } = useMessaging(sipClient)

const debounceDelay = isMobile() ? 1000 : 500  // 1s on mobile, 500ms on desktop

const debouncedComposing = useDebounceFn(
  (to: string, isComposing: boolean) => {
    sendComposingIndicator(to, isComposing)
  },
  debounceDelay
)

// On mobile, only send composing indicator every few keystrokes
let keystrokeCount = 0
const handleInput = (to: string, text: string) => {
  if (isMobile()) {
    keystrokeCount++
    if (keystrokeCount % 3 === 0 || text.length === 0) {
      // Only send every 3 keystrokes
      debouncedComposing(to, text.length > 0)
    }
  } else {
    // Desktop: send normally
    debouncedComposing(to, text.length > 0)
  }
}
```

### Offline/Online Detection

Handle network transitions gracefully on mobile:

```typescript
// Detect online/offline transitions
window.addEventListener('online', async () => {
  console.log('Network connection restored')

  const { connect, isConnected } = useSipClient()
  const { setStatus } = usePresence(sipClient)

  // Reconnect if needed
  if (!isConnected.value) {
    try {
      await connect()
      await setStatus(PresenceState.Available)

      // Send queued messages
      await sendQueuedMessages()

    } catch (error) {
      console.error('Reconnection failed:', error)
      showError('Failed to reconnect. Please try again.')
    }
  }
})

window.addEventListener('offline', async () => {
  console.log('Network connection lost')

  const { setStatus } = usePresence(sipClient)

  // Set status to offline
  try {
    await setStatus(PresenceState.Offline)
  } catch (error) {
    // May fail if already disconnected
    console.debug('Could not update status - already offline')
  }

  // Show offline indicator
  showWarning('You are offline. Messages will be queued.')
})
```

### Touch Interface Considerations

Optimize messaging UI for touch interfaces:

```typescript
// Increase touch target size for mobile
const styles = computed(() => ({
  messageItem: {
    minHeight: isMobile() ? '48px' : '32px',  // Larger touch targets
    padding: isMobile() ? '12px' : '8px'
  },
  button: {
    minHeight: isMobile() ? '44px' : '36px',  // iOS recommends 44px minimum
    fontSize: isMobile() ? '16px' : '14px'    // Prevent zoom on input focus
  }
}))
```

```html
<template>
  <div class="messaging-app">
    <!-- Prevent zoom on input focus (iOS) -->
    <input
      type="text"
      :style="{ fontSize: '16px' }"  <!-- Minimum 16px prevents iOS zoom -->
      placeholder="Type a message..."
    />

    <!-- Larger touch targets for message actions -->
    <button
      :style="styles.button"
      @click="sendMessage"
    >
      Send
    </button>
  </div>
</template>
```

### Progressive Web App (PWA) Considerations

For PWA deployments, handle app lifecycle events:

```typescript
// Service Worker message handling
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'NEW_MESSAGE') {
      // Handle background message reception
      const { from, content } = event.data.message

      // Show notification
      showNotification({
        title: `Message from ${from}`,
        body: content
      })

      // Update UI if app is open
      if (!document.hidden) {
        refreshMessages()
      }
    }
  })
}

// Handle PWA installation
window.addEventListener('appinstalled', () => {
  console.log('PWA installed - enabling mobile optimizations')

  // Enable mobile-specific features
  enablePushNotifications()
  enableBackgroundSync()
})
```

### Browser-Specific Workarounds

#### Safari Date Handling

Safari has issues with some date formats in SIP headers:

```typescript
// Ensure ISO 8601 format for Safari compatibility
const formatDateForSafari = (date: Date) => {
  return date.toISOString()  // Always use ISO format
}

// Parse dates defensively
const parseMessageDate = (dateString: string) => {
  const date = new Date(dateString)

  if (isNaN(date.getTime())) {
    // Fallback for invalid dates
    console.warn('Invalid date:', dateString)
    return new Date()
  }

  return date
}
```

#### Firefox Local Storage

Firefox has strict privacy settings that may block localStorage:

```typescript
// Check localStorage availability
const isStorageAvailable = () => {
  try {
    const test = '__storage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch (e) {
    return false
  }
}

// Fallback to memory storage if localStorage blocked
const storage = isStorageAvailable() ? localStorage : new Map()

const setItem = (key: string, value: string) => {
  if (storage instanceof Map) {
    storage.set(key, value)
  } else {
    storage.setItem(key, value)
  }
}
```

---

## Summary

You've learned how to build complete presence and messaging features with VueSip!

**Key Takeaways:**

📍 **Presence Management**
- Set your status with `setStatus()` to broadcast availability
- Subscribe to users with `subscribe()` to receive real-time status updates
- Use PUBLISH to announce your status, SUBSCRIBE to watch others, NOTIFY for updates
- Auto-refresh keeps subscriptions alive automatically

💬 **Instant Messaging**
- Send messages with `sendMessage()` - supports text, HTML, and JSON
- Listen for incoming messages with `onMessagingEvent()`
- Track message lifecycle from pending → sent → delivered → read
- Use composing indicators for "typing..." feedback

🗂️ **Conversations**
- Messages are automatically grouped by contact URI
- Each conversation tracks unread count and composing status
- Use the reactive `conversations` map for building UI

🛠️ **Best Practices**
- Set status on connect, offline on disconnect
- Handle errors gracefully with try-catch
- Debounce composing indicators to reduce network traffic
- Limit subscription counts to respect server limits
- Auto-mark messages as read when viewing conversations

### You've accomplished:

✅ **Understand SIP Presence** - You know how PUBLISH, SUBSCRIBE, and NOTIFY work together
✅ **Manage User Status** - Set and broadcast your availability to other users
✅ **Track Contact Presence** - Subscribe to users and receive real-time status updates
✅ **Send Messages** - Use SIP MESSAGE to send instant messages
✅ **Receive Messages** - Handle incoming messages and organize them into conversations
✅ **Track Message Status** - Monitor delivery from pending → sent → delivered → read
✅ **Handle Composing Indicators** - Show "user is typing..." feedback
✅ **Manage Conversations** - Automatically organize messages by contact
✅ **Troubleshoot Issues** - Diagnose and fix common presence and messaging problems
✅ **Configure Servers** - Set up Asterisk, FreeSWITCH, and Kamailio for presence/messaging
✅ **Test Effectively** - Use mocks, write unit tests, and debug SIP messages
✅ **Optimize for Mobile** - Handle iOS/Android limitations and optimize for battery/data

### Key Takeaways:

💡 **Presence is reactive** - Use Vue's reactivity with `watchedUsers` to automatically update your UI when status changes

💡 **Server support varies** - Not all SIP servers support all features. Test your server's capabilities and adapt your app accordingly

💡 **Handle errors gracefully** - Network issues, server limits, and offline users are normal. Build resilience into your app

💡 **HTTPS is required** - Production deployments need secure WebSocket (WSS) connections

💡 **Mobile needs special care** - iOS and Android have platform-specific limitations around background connections and notifications

💡 **Subscriptions have limits** - Most servers limit concurrent presence subscriptions to 50-200. Manage them wisely

💡 **Delivery receipts are optional** - Don't depend on delivery/read receipts for critical functionality - treat them as enhancements

💡 **Mock for development** - Use mock implementations to develop and test UI without needing live SIP infrastructure

---

## What's Next?

**Where to go from here:** Choose your path based on what you want to build next.

### For Building a Full Messaging App:

- 📚 **[Getting Started Guide](./getting-started.md)** - Set up VueSip and understand core concepts
- 📞 **[Making Calls](./making-calls.md)** - Add voice calling to your messaging app
- 📹 **[Video Calling](./video-calling.md)** - Enable video chat alongside messaging
- 📋 **[Call History](./call-history.md)** - Track and display communication history

### For Advanced Presence & Messaging Features:

- 🔐 **[Security Guide](./security.md)** - Secure your presence and messaging implementation
- ⚡ **[Performance Guide](./performance.md)** - Optimize for large-scale deployments
- 🎛️ **[Device Management](./device-management.md)** - Handle audio/video devices for richer messaging

### For API Reference:

- 📖 **[usePresence API](/api/composables/usePresence)** - Complete API documentation and type definitions
- 📖 **[useMessaging API](/api/composables/useMessaging)** - Complete API documentation and type definitions
- 📖 **[useSipClient API](/api/composables/useSipClient)** - SIP client configuration and methods
- 📖 **[Events API](/api/events)** - All presence and messaging events explained

### For Production Deployment:

- 🔧 **[Server Configuration](./server-configuration.md)** - Production-ready server setups
- 🐛 **[Troubleshooting Guide](./troubleshooting.md)** - Comprehensive troubleshooting reference
- 📊 **[Monitoring & Analytics](./monitoring.md)** - Track presence and messaging metrics

### Example Projects:

- 💻 **[Full Softphone Example](https://github.com/yourusername/vuesip/tree/main/examples/softphone)** - Complete app with calling, presence, and messaging
- 💬 **[Messaging Widget](https://github.com/yourusername/vuesip/tree/main/examples/messaging-widget)** - Embeddable chat widget
- 👥 **[Contact List](https://github.com/yourusername/vuesip/tree/main/examples/presence-list)** - Presence-enabled contact list
- 🎮 **[CodeSandbox Demos](https://codesandbox.io/s/vuesip-presence)** - Interactive online examples

---

## Getting Help

**Need assistance?** Here's where to find help:

📚 **Documentation:**
- **[Full Documentation](https://vuesip.dev/docs)** - Complete guides and API reference
- **[API Reference](https://vuesip.dev/api)** - Detailed API documentation
- **[FAQ](https://vuesip.dev/faq)** - Common questions and answers

🐛 **Bug Reports & Feature Requests:**
- **[GitHub Issues](https://github.com/yourusername/vuesip/issues)** - Report bugs or request features
- Include: VueSip version, SIP server type/version, browser, and minimal reproduction

💬 **Community:**
- **[GitHub Discussions](https://github.com/yourusername/vuesip/discussions)** - Ask questions and share tips
- **[Discord Server](https://discord.gg/vuesip)** - Real-time community help

📧 **Professional Support:**
- **[Enterprise Support](https://vuesip.dev/support)** - Priority support for production deployments
- **[Consulting Services](https://vuesip.dev/consulting)** - Custom development and integration help

---

## Important Reminders

⚠️ **Server Compatibility:**
- Presence and messaging require your SIP server to support RFC 3856 (Presence) and RFC 3428 (MESSAGE)
- FreeSWITCH has the best support, Asterisk requires PJSIP, Kamailio needs module configuration
- Test your server's capabilities before deploying to production

⚠️ **Feature Support:**
- Delivery receipts (IMDN) require both server and client support - they may not work in all scenarios
- Composing indicators are a "nice to have" enhancement - don't rely on them for critical functionality
- Always build fallbacks for unsupported features

⚠️ **Production Considerations:**
- HTTPS (WSS) is required for production deployments
- Implement error handling and retry logic for network issues
- Handle iOS/Android platform limitations for mobile deployments
- Monitor subscription counts to avoid hitting server limits
- Implement message history limits to prevent memory issues

⚠️ **Security Best Practices:**
- Sanitize message content to prevent XSS attacks
- Validate SIP URIs before subscribing or messaging
- Don't store sensitive information in presence status messages
- Implement rate limiting to prevent abuse
- Use secure WebSocket (WSS) in production

---

## Final Tips

💡 **Combine Features:** The best user experience comes from combining presence and messaging. Show who's online in your message list so users know who's available to chat.

💡 **Start Simple:** Begin with basic presence and messaging, then add advanced features like delivery receipts and composing indicators once the basics work reliably.

💡 **Test Thoroughly:** Use the provided mock implementations to develop and test your UI without needing live SIP infrastructure. This speeds up development significantly.

💡 **Monitor Performance:** Track subscription counts, message throughput, and memory usage, especially on mobile devices. Implement limits before hitting server or device constraints.

💡 **Handle Errors Gracefully:** Network issues, server limits, and offline users are normal in real-world deployments. Build resilience into your app from the start.

💡 **Optimize for Mobile:** If targeting mobile users, implement the iOS/Android optimizations from this guide. Background connection handling and battery optimization are critical for good mobile UX.

💡 **Stay Updated:** SIP server implementations evolve. Check your server's documentation for the latest presence and messaging configuration options.

---

**Congratulations!** You now have the knowledge to build production-ready presence and messaging features with VueSip. Whether you're building a simple status indicator or a full-featured messaging app, you have all the tools and patterns you need to succeed.

Happy coding! 🚀

---

## Testing & Development

**What you'll learn:** How to test and develop presence and messaging features without a full SIP infrastructure, plus strategies for debugging and quality assurance.

Developing presence and messaging features can be challenging when you don't have a SIP server readily available or when you want to test edge cases. This section provides strategies for effective development and testing.

### Mock Implementations for Development

During UI development, you can mock the presence and messaging composables to test your interface without needing a SIP server.

**Why mock?**
- Develop UI without SIP infrastructure
- Test edge cases (offline users, errors, etc.)
- Fast iteration without network delays
- Test features your server doesn't support

#### Mock Presence Composable

```typescript
// mocks/mockPresence.ts
import { ref, computed } from 'vue'
import type { PresenceStatus, PresenceState } from 'vuesip'

export const useMockPresence = () => {
  const watchedUsers = ref(new Map<string, PresenceStatus>())
  const currentState = ref<PresenceState>('offline')
  const currentStatus = ref<PresenceStatus | null>(null)
  const subscriptionCount = computed(() => watchedUsers.value.size)

  // Mock status updates
  const setStatus = async (state: PresenceState, options?: any) => {
    console.log('[MOCK] Setting status to:', state, options)

    currentState.value = state
    currentStatus.value = {
      uri: 'sip:self@example.com',
      state,
      statusMessage: options?.statusMessage || '',
      lastUpdated: new Date()
    }

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Mock subscription with automatic status changes
  const subscribe = async (uri: string, options?: any) => {
    console.log('[MOCK] Subscribing to:', uri)

    // Add to watched users with random initial state
    const states: PresenceState[] = ['available', 'away', 'busy', 'offline']
    const randomState = states[Math.floor(Math.random() * states.length)]

    watchedUsers.value.set(uri, {
      uri,
      state: randomState,
      statusMessage: `Mock status for ${uri}`,
      lastUpdated: new Date()
    })

    // Simulate random status changes every 10 seconds
    const interval = setInterval(() => {
      if (watchedUsers.value.has(uri)) {
        const newState = states[Math.floor(Math.random() * states.length)]
        watchedUsers.value.set(uri, {
          uri,
          state: newState,
          statusMessage: `Now ${newState}`,
          lastUpdated: new Date()
        })
      } else {
        clearInterval(interval)
      }
    }, 10000)

    await new Promise(resolve => setTimeout(resolve, 200))
  }

  const unsubscribe = async (uri: string) => {
    console.log('[MOCK] Unsubscribing from:', uri)
    watchedUsers.value.delete(uri)
  }

  const getStatus = (uri: string) => {
    return watchedUsers.value.get(uri)
  }

  return {
    watchedUsers,
    currentState,
    currentStatus,
    subscriptionCount,
    setStatus,
    subscribe,
    unsubscribe,
    getStatus,
    onPresenceEvent: (callback: any) => () => {}  // No-op
  }
}
```

#### Mock Messaging Composable

```typescript
// mocks/mockMessaging.ts
import { ref, computed } from 'vue'
import type { Message, MessageStatus } from 'vuesip'

export const useMockMessaging = () => {
  const messages = ref<Message[]>([])
  const composingIndicators = ref(new Map<string, { isComposing: boolean }>())
  const unreadCount = computed(() =>
    messages.value.filter(m => !m.isRead && m.direction === 'incoming').length
  )

  // Generate unique message ID
  let messageIdCounter = 1
  const generateId = () => `mock-msg-${messageIdCounter++}`

  // Mock sending messages
  const sendMessage = async (to: string, content: string, options?: any) => {
    console.log('[MOCK] Sending message to:', to, content)

    const message: Message = {
      id: generateId(),
      from: 'sip:self@example.com',
      to,
      content,
      direction: 'outgoing',
      status: 'pending',
      timestamp: new Date(),
      isRead: true
    }

    messages.value.push(message)

    // Simulate send progress
    await new Promise(resolve => setTimeout(resolve, 500))
    message.status = 'sending'

    await new Promise(resolve => setTimeout(resolve, 500))
    message.status = 'sent'
    message.sentAt = new Date()

    // Simulate delivery receipt if requested
    if (options?.requestDeliveryNotification) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      message.status = 'delivered'
      message.deliveredAt = new Date()
    }

    // Simulate read receipt if requested
    if (options?.requestReadNotification) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      message.status = 'read'
      message.readAt = new Date()
    }

    // Simulate automatic reply
    setTimeout(() => {
      receiveMessage(to, `Reply to: ${content}`)
    }, 3000)

    return message.id
  }

  // Mock receiving messages
  const receiveMessage = (from: string, content: string) => {
    console.log('[MOCK] Receiving message from:', from)

    const message: Message = {
      id: generateId(),
      from,
      to: 'sip:self@example.com',
      content,
      direction: 'incoming',
      status: 'delivered',
      timestamp: new Date(),
      isRead: false,
      deliveredAt: new Date()
    }

    messages.value.push(message)
  }

  // Mock composing indicators
  const sendComposingIndicator = async (to: string, isComposing: boolean) => {
    console.log('[MOCK] Composing indicator to:', to, isComposing)
    // No-op in mock
  }

  const markAsRead = (messageId: string) => {
    const message = messages.value.find(m => m.id === messageId)
    if (message) {
      message.isRead = true
      message.readAt = new Date()
    }
  }

  const markAllAsRead = (uri?: string) => {
    messages.value.forEach(msg => {
      if (!uri || msg.from === uri || msg.to === uri) {
        msg.isRead = true
        msg.readAt = new Date()
      }
    })
  }

  const deleteMessage = (messageId: string) => {
    const index = messages.value.findIndex(m => m.id === messageId)
    if (index !== -1) {
      messages.value.splice(index, 1)
    }
  }

  const clearMessages = (uri?: string) => {
    if (uri) {
      messages.value = messages.value.filter(m => m.from !== uri && m.to !== uri)
    } else {
      messages.value = []
    }
  }

  // Mock conversations computed
  const conversations = computed(() => {
    const convMap = new Map()
    messages.value.forEach(msg => {
      const uri = msg.direction === 'incoming' ? msg.from : msg.to
      if (!convMap.has(uri)) {
        convMap.set(uri, {
          uri,
          messages: [],
          unreadCount: 0,
          lastMessageAt: new Date(0),
          isComposing: composingIndicators.value.get(uri)?.isComposing || false
        })
      }

      const conv = convMap.get(uri)
      conv.messages.push(msg)
      if (!msg.isRead && msg.direction === 'incoming') {
        conv.unreadCount++
      }
      if (msg.timestamp > conv.lastMessageAt) {
        conv.lastMessageAt = msg.timestamp
      }
    })
    return convMap
  })

  return {
    messages,
    conversations,
    unreadCount,
    composingIndicators,
    sendMessage,
    markAsRead,
    markAllAsRead,
    deleteMessage,
    clearMessages,
    sendComposingIndicator,
    onMessagingEvent: (callback: any) => () => {}  // No-op
  }
}
```

#### Using Mocks in Your Application

```typescript
// composables/usePresence.ts or useMessaging.ts
import { useMockPresence } from '@/mocks/mockPresence'
import { useMockMessaging } from '@/mocks/mockMessaging'
import { usePresence as useRealPresence } from 'vuesip'
import { useMessaging as useRealMessaging } from 'vuesip'

// Use environment variable to toggle between mock and real
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

export const usePresence = (...args: any[]) => {
  return USE_MOCK ? useMockPresence() : useRealPresence(...args)
}

export const useMessaging = (...args: any[]) => {
  return USE_MOCK ? useMockMessaging() : useRealMessaging(...args)
}
```

```bash
# .env.development
VITE_USE_MOCK=true

# .env.production
VITE_USE_MOCK=false
```

### Testing Strategies

#### Unit Testing with Vitest

```typescript
// __tests__/PresenceComponent.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { useMockPresence } from '@/mocks/mockPresence'
import PresenceComponent from '@/components/PresenceComponent.vue'

// Mock the composable
vi.mock('vuesip', () => ({
  usePresence: () => useMockPresence()
}))

describe('PresenceComponent', () => {
  it('displays user status correctly', async () => {
    const wrapper = mount(PresenceComponent)

    // Mock provides reactive state
    const { setStatus } = useMockPresence()
    await setStatus('available', { statusMessage: 'Online' })

    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('available')
    expect(wrapper.text()).toContain('Online')
  })

  it('subscribes to users on mount', async () => {
    const subscribe = vi.fn()
    vi.mock('vuesip', () => ({
      usePresence: () => ({
        ...useMockPresence(),
        subscribe
      })
    }))

    const wrapper = mount(PresenceComponent, {
      props: {
        usersToWatch: ['sip:alice@example.com', 'sip:bob@example.com']
      }
    })

    await wrapper.vm.$nextTick()

    expect(subscribe).toHaveBeenCalledWith('sip:alice@example.com')
    expect(subscribe).toHaveBeenCalledWith('sip:bob@example.com')
  })
})
```

#### Integration Testing

```typescript
// __tests__/MessagingFlow.test.ts
import { describe, it, expect } from 'vitest'
import { useMockMessaging } from '@/mocks/mockMessaging'

describe('Messaging Flow', () => {
  it('sends and receives messages correctly', async () => {
    const { sendMessage, messages, conversations } = useMockMessaging()

    // Send a message
    const messageId = await sendMessage('sip:bob@example.com', 'Hello Bob!')

    // Verify message was added
    expect(messages.value).toHaveLength(1)
    expect(messages.value[0].content).toBe('Hello Bob!')
    expect(messages.value[0].status).toBe('sent')

    // Verify conversation was created
    expect(conversations.value.has('sip:bob@example.com')).toBe(true)

    const conv = conversations.value.get('sip:bob@example.com')
    expect(conv.messages).toHaveLength(1)
    expect(conv.unreadCount).toBe(0)
  })

  it('tracks unread count correctly', async () => {
    const { messages, unreadCount, markAsRead } = useMockMessaging()

    // Simulate incoming message
    messages.value.push({
      id: 'msg-1',
      from: 'sip:alice@example.com',
      to: 'sip:self@example.com',
      content: 'Test',
      direction: 'incoming',
      status: 'delivered',
      timestamp: new Date(),
      isRead: false
    })

    expect(unreadCount.value).toBe(1)

    // Mark as read
    markAsRead('msg-1')

    expect(unreadCount.value).toBe(0)
  })
})
```

### Debugging Presence and Messaging

#### Enable Debug Logging

```typescript
// Enable detailed logging for presence
const { setStatus, subscribe } = usePresence(sipClient, {
  debug: true  // Shows all PUBLISH/SUBSCRIBE/NOTIFY messages
})

// Enable detailed logging for messaging
const { sendMessage } = useMessaging(sipClient, {
  debug: true  // Shows all MESSAGE requests and responses
})
```

#### Monitor SIP Messages in Browser DevTools

```typescript
// Intercept and log all SIP messages
const originalSend = WebSocket.prototype.send
WebSocket.prototype.send = function(data) {
  if (typeof data === 'string' && data.includes('SIP/2.0')) {
    console.log('📤 Outgoing SIP:', data)
  }
  return originalSend.call(this, data)
}

// Log incoming messages
window.addEventListener('message', (event) => {
  if (event.data && typeof event.data === 'string' && event.data.includes('SIP/2.0')) {
    console.log('📥 Incoming SIP:', event.data)
  }
})
```

#### Presence State Tracker

```typescript
// Track all presence state changes for debugging
const { onPresenceEvent } = usePresence(sipClient)

const presenceLog = ref<Array<{timestamp: Date, event: any}>>([])

onPresenceEvent((event) => {
  presenceLog.value.push({
    timestamp: new Date(),
    event
  })

  console.group(`🔔 Presence Event: ${event.type}`)
  console.log('URI:', event.uri)
  console.log('Status:', event.status)
  console.log('Timestamp:', event.timestamp)
  console.groupEnd()
})

// Export log for analysis
const exportPresenceLog = () => {
  const json = JSON.stringify(presenceLog.value, null, 2)
  downloadFile('presence-log.json', json)
}
```

#### Message Flow Tracker

```typescript
// Track complete message lifecycle
const { onMessagingEvent } = useMessaging(sipClient)

const messageTracker = new Map<string, Array<{
  timestamp: Date
  event: string
  status?: string
}>>()

onMessagingEvent((event) => {
  const id = event.message?.id
  if (!id) return

  if (!messageTracker.has(id)) {
    messageTracker.set(id, [])
  }

  messageTracker.get(id)!.push({
    timestamp: new Date(),
    event: event.type,
    status: event.message?.status
  })

  console.group(`💬 Message Event: ${event.type}`)
  console.log('Message ID:', id)
  console.log('Content:', event.message?.content)
  console.log('Status:', event.message?.status)
  console.log('Lifecycle:', messageTracker.get(id))
  console.groupEnd()
})
```

### Performance Testing

#### Load Testing Presence Subscriptions

```typescript
// Test subscription limits
const testSubscriptionLoad = async (count: number) => {
  console.log(`Testing ${count} subscriptions...`)

  const startTime = performance.now()
  const { subscribe, subscriptionCount } = usePresence(sipClient)

  const errors = []

  for (let i = 0; i < count; i++) {
    try {
      await subscribe(`sip:user${i}@example.com`)
    } catch (error) {
      errors.push({ index: i, error })
    }
  }

  const endTime = performance.now()
  const duration = endTime - startTime

  console.log(`Results:`)
  console.log(`- Total time: ${duration.toFixed(2)}ms`)
  console.log(`- Successful: ${subscriptionCount.value}`)
  console.log(`- Failed: ${errors.length}`)
  console.log(`- Avg time per subscription: ${(duration / count).toFixed(2)}ms`)

  if (errors.length > 0) {
    console.log(`- First error at index ${errors[0].index}:`, errors[0].error)
  }
}

// Run test
testSubscriptionLoad(100)
```

#### Load Testing Message Throughput

```typescript
// Test message sending rate
const testMessageThroughput = async (messageCount: number) => {
  console.log(`Sending ${messageCount} messages...`)

  const { sendMessage, onMessagingEvent } = useMessaging(sipClient)
  const startTime = performance.now()

  let sent = 0
  let failed = 0

  onMessagingEvent((event) => {
    if (event.type === 'sent') sent++
    if (event.type === 'failed') failed++
  })

  const promises = []
  for (let i = 0; i < messageCount; i++) {
    promises.push(
      sendMessage('sip:test@example.com', `Message ${i}`)
        .catch(err => console.error(`Message ${i} failed:`, err))
    )
  }

  await Promise.all(promises)

  const endTime = performance.now()
  const duration = endTime - startTime

  console.log(`Results:`)
  console.log(`- Total time: ${duration.toFixed(2)}ms`)
  console.log(`- Sent: ${sent}`)
  console.log(`- Failed: ${failed}`)
  console.log(`- Messages/second: ${(messageCount / (duration / 1000)).toFixed(2)}`)
}

// Run test
testMessageThroughput(100)
```

### CI/CD Integration

#### Example GitHub Actions Workflow

```yaml
# .github/workflows/test-presence-messaging.yml
name: Test Presence & Messaging

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      # Use containerized FreeSWITCH for testing
      freeswitch:
        image: drachtio/drachtio-freeswitch-mrf
        ports:
          - 7443:7443
          - 5060:5060

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          SIP_SERVER: ws://localhost:7443
          SIP_USER: 1000
          SIP_PASS: 1234

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---
