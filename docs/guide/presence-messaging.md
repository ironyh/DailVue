# Presence and Messaging Guide

This guide explains how to use SIP presence and instant messaging in VueSip. Learn how to track user availability, send real-time messages, and build rich communication experiences.

**What you'll learn:**
- 📍 **Presence Management** - Track who's online, busy, or away in real-time
- 💬 **Instant Messaging** - Send and receive text messages between users
- 🔔 **Status Updates** - Get notified when users change their availability
- ⌨️ **Typing Indicators** - Show "user is typing..." feedback

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

**What's Next?**

- 📚 [API Reference - usePresence](/api/composables/usePresence) - Complete API documentation
- 📚 [API Reference - useMessaging](/api/composables/useMessaging) - Complete API documentation
- 🔧 [SIP Protocol Guide](/guide/sip-protocol) - Deep dive into SIP concepts
- 📞 [Call Management Guide](/guide/call-management) - Learn about making and receiving calls

⚠️ **Important Notes:**
- Presence and messaging features depend on your SIP server supporting them
- Not all SIP servers/clients support delivery receipts or composing indicators
- Test your implementation with your specific SIP infrastructure

💡 **Pro Tip:** Combine presence and messaging for the best user experience - show who's online in your conversation list so users know who's available to chat!
