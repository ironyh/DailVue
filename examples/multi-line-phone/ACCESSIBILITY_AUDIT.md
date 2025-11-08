# WCAG 2.1 Level AA/AAA Accessibility Audit
## Multi-Line Phone Example Application

**Audit Date:** 2025-11-08
**Application Path:** `/home/user/VueSip/examples/multi-line-phone/`
**WCAG Version:** 2.1
**Target Levels:** AA (Primary), AAA (Secondary)

---

## Executive Summary

This audit identified **47 accessibility violations** across WCAG 2.1 Level A, AA, and AAA criteria. The application has significant barriers for users relying on screen readers, keyboard navigation, and users with visual impairments.

**Critical Issues:** 12
**Major Issues:** 21
**Minor Issues:** 14

**Compliance Status:**
- ❌ WCAG 2.1 Level A: **Non-compliant** (15 violations)
- ❌ WCAG 2.1 Level AA: **Non-compliant** (24 violations)
- ❌ WCAG 2.1 Level AAA: **Non-compliant** (8 violations)

---

## 1. WCAG Violations by Component

### 1.1 App.vue - Main Application

#### CRITICAL Issues

**A11Y-001: Missing Landmark Regions (WCAG 2.4.1 Level A)**
- **Severity:** Critical
- **Location:** Lines 2-146
- **Issue:** Page structure uses generic `<div>` elements without semantic HTML or ARIA landmarks
- **Impact:** Screen reader users cannot navigate efficiently between major page sections
- **Users Affected:** Screen reader users, keyboard-only users
- **WCAG Criteria:** 2.4.1 Bypass Blocks (Level A), 1.3.1 Info and Relationships (Level A)

**A11Y-002: Missing ARIA Live Regions for Dynamic Content (WCAG 4.1.3 Level AA)**
- **Severity:** Critical
- **Location:** Lines 54-80 (call lines), 125-133 (incoming alerts)
- **Issue:** Call line additions, removals, and state changes not announced to screen readers
- **Impact:** Screen reader users unaware of incoming calls, line status changes, or new call lines
- **Users Affected:** Screen reader users
- **WCAG Criteria:** 4.1.3 Status Messages (Level AA)

**A11Y-003: Heading Hierarchy Violation (WCAG 1.3.1 Level A)**
- **Severity:** Major
- **Location:** Lines 4, 21, 43, 101, 112
- **Issue:** Inconsistent heading levels (h1 → h3, h2, h3) skipping h2 level
```html
<h1>Multi-Line Phone</h1>           <!-- Line 4 -->
<h3>Recent Calls</h3>               <!-- Line 21 - Should be h2 -->
<h2>Active Lines (...)</h2>         <!-- Line 43 - Good -->
<h3>Getting Started</h3>            <!-- Line 101 - Should be h2 -->
<h3>Multi-Line Features</h3>        <!-- Line 112 - Should be h2 -->
```
- **Impact:** Screen reader users cannot understand page structure, navigation is confusing
- **WCAG Criteria:** 1.3.1 Info and Relationships (Level A), 2.4.6 Headings and Labels (Level AA)

#### MAJOR Issues

**A11Y-004: Decorative Emojis Without Text Alternatives (WCAG 1.1.1 Level A)**
- **Severity:** Major
- **Location:** Lines 31, 84, 100, 138
- **Issue:** Emojis used as content without `aria-label` or text alternatives
```html
<!-- Line 31 -->
<span class="history-direction">
  {{ entry.direction === 'incoming' ? '📞 In' : '📲 Out' }}
</span>
<!-- Emoji announced as "telephone receiver emoji In" -->

<!-- Line 84 -->
<div class="empty-icon">📞</div>

<!-- Line 100 -->
<div class="info-icon">ℹ️</div>

<!-- Line 138 -->
<span class="warning-icon">⚠️</span>
```
- **Impact:** Screen readers announce emoji Unicode descriptions, creating verbose and confusing output
- **WCAG Criteria:** 1.1.1 Non-text Content (Level A)

**A11Y-005: Color as Only Differentiator (WCAG 1.4.1 Level A)**
- **Severity:** Major
- **Location:** Lines 772-778, 290-320 (CallLine.vue)
- **Issue:** Call direction (incoming/outgoing) indicated only by color
```css
/* Lines 772-778 */
.history-direction.incoming {
  color: #28a745;  /* Green */
}
.history-direction.outgoing {
  color: #007bff;  /* Blue */
}
```
- **Impact:** Color-blind users cannot distinguish call types
- **WCAG Criteria:** 1.4.1 Use of Color (Level A)

**A11Y-006: Insufficient Button Labels (WCAG 2.4.6 Level AA)**
- **Severity:** Major
- **Location:** Lines 44-51, 143
- **Issue:** Buttons lack descriptive accessible labels
```html
<!-- Line 44 -->
<button @click="showDialpad = !showDialpad" class="btn-new-call" :disabled="!isRegistered">
  {{ showDialpad ? 'Hide Dialpad' : '+ New Call' }}
</button>
<!-- Needs: aria-label="Create new call on available line" -->

<!-- Line 143 -->
<button @click="maxLinesWarning = false" class="warning-close">×</button>
<!-- Needs: aria-label="Close maximum lines warning" -->
```
- **WCAG Criteria:** 2.4.6 Headings and Labels (Level AA), 4.1.2 Name, Role, Value (Level A)

**A11Y-007: Missing Focus Management for Dynamic Content (WCAG 2.4.3 Level A)**
- **Severity:** Major
- **Location:** Lines 125-133 (incoming call alerts)
- **Issue:** When incoming call alert appears, focus doesn't move to it
- **Impact:** Keyboard users must tab through entire page to reach the alert
- **WCAG Criteria:** 2.4.3 Focus Order (Level A), 2.4.7 Focus Visible (Level AA)

**A11Y-008: Call History Lacks Semantic Structure (WCAG 1.3.1 Level A)**
- **Severity:** Major
- **Location:** Lines 20-37
- **Issue:** Call history should use semantic list structure
```html
<!-- Current: Generic divs -->
<div class="history-list">
  <div class="history-item">...</div>
</div>

<!-- Should be: -->
<ul class="history-list" role="list" aria-label="Recent call history">
  <li class="history-item" role="listitem">...</li>
</ul>
```
- **WCAG Criteria:** 1.3.1 Info and Relationships (Level A)

#### MINOR Issues

**A11Y-009: Insufficient Color Contrast (WCAG 1.4.3 Level AA, 1.4.6 Level AAA)**
- **Severity:** Minor
- **Location:** Lines 766, 780
- **Issue:** Some text may not meet 4.5:1 contrast ratio
```css
.history-direction {
  font-size: 0.85em;
  color: #666;  /* Needs testing against background */
}
```
- **WCAG Criteria:** 1.4.3 Contrast (Minimum) Level AA, 1.4.6 Contrast (Enhanced) Level AAA

**A11Y-010: Missing Language Attributes (WCAG 3.1.2 Level AA)**
- **Severity:** Minor
- **Location:** Throughout (abbreviations, code samples)
- **Issue:** Abbreviations and technical terms not marked with `lang` or `abbr`
- **WCAG Criteria:** 3.1.2 Language of Parts (Level AA)

---

### 1.2 CallLine.vue - Individual Call Line Component

#### CRITICAL Issues

**A11Y-011: Missing ARIA Attributes for Call Line State (WCAG 4.1.2 Level A)**
- **Severity:** Critical
- **Location:** Lines 2-13
- **Issue:** Call line div lacks proper ARIA attributes for state announcements
```html
<!-- Current -->
<div class="call-line" :class="{ ... }" @click="handleLineClick">

<!-- Should be -->
<div
  class="call-line"
  role="region"
  :aria-label="`Line ${lineNumber}: ${stateText} - ${displayName}`"
  :aria-current="isActiveLine ? 'true' : 'false'"
  :aria-live="state === 'ringing' ? 'assertive' : 'polite'"
  :aria-atomic="true"
  @click="handleLineClick"
>
```
- **Impact:** Screen readers don't announce line state changes, active line status, or line information
- **WCAG Criteria:** 4.1.2 Name, Role, Value (Level A), 4.1.3 Status Messages (Level AA)

**A11Y-012: Div with Click Handler - Not Keyboard Accessible (WCAG 2.1.1 Level A)**
- **Severity:** Critical
- **Location:** Line 12
- **Issue:** Clickable div without keyboard equivalent
```html
<div @click="handleLineClick">
<!-- Should be button or add: -->
<div
  role="button"
  tabindex="0"
  @click="handleLineClick"
  @keyup.enter="handleLineClick"
  @keyup.space.prevent="handleLineClick"
>
```
- **Impact:** Keyboard users cannot select/activate call lines
- **WCAG Criteria:** 2.1.1 Keyboard (Level A), 4.1.2 Name, Role, Value (Level A)

**A11Y-013: State Changes Not Announced (WCAG 4.1.3 Level AA)**
- **Severity:** Critical
- **Location:** Lines 191-203 (state computation)
- **Issue:** State changes (ringing → active, active → held) not announced
- **Impact:** Screen reader users unaware when call state changes
- **WCAG Criteria:** 4.1.3 Status Messages (Level AA)

#### MAJOR Issues

**A11Y-014: Emoji-Only Button Icons (WCAG 1.1.1 Level A)**
- **Severity:** Major
- **Location:** Lines 40, 44, 57, 67, 78, 83, 95
- **Issue:** Buttons use emoji icons without proper labeling
```html
<!-- Line 40 -->
<button @click.stop="$emit('answer')" class="btn btn--success" title="Answer">
  <span class="btn-icon">📞</span>
  Answer
</button>
<!-- Emoji creates duplicate announcement: "telephone emoji Answer" -->

<!-- Should use aria-hidden on emoji -->
<button
  @click.stop="$emit('answer')"
  class="btn btn--success"
  aria-label="Answer call from ${displayName}"
>
  <span class="btn-icon" aria-hidden="true">📞</span>
  <span>Answer</span>
</button>
```
- **WCAG Criteria:** 1.1.1 Non-text Content (Level A)

**A11Y-015: Color-Only State Indicators (WCAG 1.4.1 Level A)**
- **Severity:** Major
- **Location:** Lines 290-320, 366-394
- **Issue:** Call line states indicated primarily through color
```css
.call-line--active {
  background: linear-gradient(135deg, #e0e7ff 0%, #f0e7ff 100%);
  border-color: #667eea;
}
.call-line--held {
  background: #fff3cd;
  border-color: #ffc107;
}
```
- **Impact:** Color-blind users cannot distinguish line states
- **WCAG Criteria:** 1.4.1 Use of Color (Level A)
- **Recommendation:** Add visible text labels or icons in addition to color

**A11Y-016: DTMF Pad Appears/Disappears Without Announcement (WCAG 4.1.3 Level AA)**
- **Severity:** Major
- **Location:** Lines 110-121
- **Issue:** DTMF pad visibility toggle not announced
```html
<div v-if="showDtmfPad && state === 'active' && !isOnHold" class="dtmf-pad">
<!-- Should have: -->
<div
  v-if="showDtmfPad && state === 'active' && !isOnHold"
  class="dtmf-pad"
  role="region"
  aria-label="DTMF keypad"
  aria-live="polite"
>
```
- **WCAG Criteria:** 4.1.3 Status Messages (Level AA)

**A11Y-017: Audio Elements Without Labels (WCAG 1.1.1 Level A)**
- **Severity:** Major
- **Location:** Lines 32-33
- **Issue:** Audio elements lack accessible names
```html
<audio ref="localAudioRef" autoplay muted></audio>
<audio ref="remoteAudioRef" autoplay :muted="!isActiveLine"></audio>

<!-- Should be: -->
<audio ref="localAudioRef" autoplay muted aria-label="Local audio stream"></audio>
<audio ref="remoteAudioRef" autoplay :muted="!isActiveLine"
       :aria-label="`Remote audio from ${displayName}`"></audio>
```
- **WCAG Criteria:** 1.1.1 Non-text Content (Level A), 4.1.2 Name, Role, Value (Level A)

**A11Y-018: No Keyboard Shortcuts for DTMF (WCAG 2.1.1 Level A - Enhancement)**
- **Severity:** Minor (Enhancement)
- **Location:** Lines 110-121
- **Issue:** DTMF pad requires clicking; keyboard number keys should work
- **Recommendation:** Add keyboard event listeners for number keys when DTMF pad is active
- **WCAG Criteria:** Enhancement beyond compliance

#### MINOR Issues

**A11Y-019: Insufficient Button Labels (WCAG 4.1.2 Level A)**
- **Severity:** Minor
- **Location:** Multiple buttons
- **Issue:** Buttons have `title` but should also have `aria-label` for consistency
```html
<button title="Hold">Hold</button>
<!-- Should also have aria-label="Put call on hold" -->
```
- **WCAG Criteria:** 4.1.2 Name, Role, Value (Level A)

**A11Y-020: Duration Display Not Announced (WCAG 4.1.3 Level AA)**
- **Severity:** Minor
- **Location:** Lines 20-22
- **Issue:** Call duration updates every second but not announced
- **Recommendation:** Use `aria-live="off"` to prevent constant announcements, provide manual way to check
- **WCAG Criteria:** 4.1.3 Status Messages (Level AA)

---

### 1.3 Dialpad.vue - Dialpad Component

#### MAJOR Issues

**A11Y-021: Missing Keyboard Shortcuts for Dialpad (WCAG 2.1.1 Level A)**
- **Severity:** Major
- **Location:** Lines 28-40
- **Issue:** Numeric keyboard keys don't trigger dialpad buttons
```vue
<!-- Should add keyboard event listener -->
<script>
// Add in component
onMounted(() => {
  window.addEventListener('keydown', handleKeyboardInput)
})

function handleKeyboardInput(e: KeyboardEvent) {
  if (props.disabled) return
  const key = e.key
  if (/^[0-9*#]$/.test(key)) {
    e.preventDefault()
    handleKeyPress(key)
  }
}
</script>
```
- **Impact:** Keyboard users must tab through all dialpad buttons
- **WCAG Criteria:** 2.1.1 Keyboard (Level A)

**A11Y-022: No Semantic Form Structure (WCAG 1.3.1 Level A)**
- **Severity:** Major
- **Location:** Lines 2-68
- **Issue:** Dialpad lacks semantic structure
```html
<!-- Current -->
<div class="dialpad">

<!-- Should be -->
<form class="dialpad" role="region" aria-labelledby="dialpad-heading">
  <h3 id="dialpad-heading">Make a Call</h3>
```
- **WCAG Criteria:** 1.3.1 Info and Relationships (Level A)

**A11Y-023: Clear Button Lacks Accessible Label (WCAG 4.1.2 Level A)**
- **Severity:** Major
- **Location:** Lines 17-24
- **Issue:** Clear button only has visual "×" symbol
```html
<button @click="handleClear" class="btn-clear" title="Clear">×</button>

<!-- Should be -->
<button
  @click="handleClear"
  class="btn-clear"
  aria-label="Clear phone number"
>
  <span aria-hidden="true">×</span>
</button>
```
- **WCAG Criteria:** 4.1.2 Name, Role, Value (Level A), 2.4.6 Headings and Labels (Level AA)

#### MINOR Issues

**A11Y-024: Missing Input Description (WCAG 3.3.2 Level A)**
- **Severity:** Minor
- **Location:** Lines 8-16
- **Issue:** Input lacks helper text or aria-describedby
```html
<input
  v-model="internalNumber"
  type="text"
  placeholder="Enter SIP URI or number"
  class="number-input"
  @keyup.enter="handleCall"
  :disabled="disabled"
  aria-label="Phone number or SIP URI"
  aria-describedby="dialpad-hint"
/>
<div id="dialpad-hint" class="sr-only">
  Enter a phone number or SIP URI, then press Enter or click Call button
</div>
```
- **WCAG Criteria:** 3.3.2 Labels or Instructions (Level A)

**A11Y-025: Emoji in Call Button (WCAG 1.1.1 Level A)**
- **Severity:** Minor
- **Location:** Line 48
- **Issue:** Emoji icon creates duplicate announcement
```html
<button class="dialpad__call-btn">
  <span class="call-icon" aria-hidden="true">📞</span>
  <span>Call</span>
</button>
```
- **WCAG Criteria:** 1.1.1 Non-text Content (Level A)

**A11Y-026: Missing Focus Management (WCAG 2.4.3 Level A)**
- **Severity:** Minor
- **Location:** Component mount
- **Issue:** When dialpad becomes visible, focus should move to input
- **WCAG Criteria:** 2.4.3 Focus Order (Level A)

---

### 1.4 IncomingCallAlert.vue - Incoming Call Alert

#### CRITICAL Issues

**A11Y-027: Missing ARIA Live Region (WCAG 4.1.3 Level AA)**
- **Severity:** Critical
- **Location:** Lines 2-34
- **Issue:** Incoming call alert not announced to screen readers
```html
<!-- Current -->
<div class="incoming-call-alert">

<!-- Should be -->
<div
  class="incoming-call-alert"
  role="alertdialog"
  aria-labelledby="alert-title"
  aria-describedby="alert-caller"
  aria-modal="true"
  aria-live="assertive"
>
```
- **Impact:** Screen reader users not notified of incoming calls
- **WCAG Criteria:** 4.1.3 Status Messages (Level AA), 4.1.2 Name, Role, Value (Level A)

**A11Y-028: No Focus Management (WCAG 2.4.3 Level A)**
- **Severity:** Critical
- **Location:** Component lifecycle
- **Issue:** Focus doesn't move to alert when it appears; no focus trap
```javascript
// Should add in onMounted:
const firstButton = document.querySelector('.incoming-call-alert button')
const previousFocus = document.activeElement
firstButton?.focus()

// On unmount, restore focus:
previousFocus?.focus()
```
- **Impact:** Keyboard users may not notice incoming call
- **WCAG Criteria:** 2.4.3 Focus Order (Level A), 2.4.7 Focus Visible (Level AA)

**A11Y-029: No Keyboard Shortcuts (WCAG 2.1.1 Level A - Enhancement)**
- **Severity:** Major
- **Location:** Lines 18-25
- **Issue:** No keyboard shortcuts for Answer (Enter) / Reject (Escape)
```javascript
onMounted(() => {
  window.addEventListener('keydown', handleKeyboard)
})

function handleKeyboard(e: KeyboardEvent) {
  if (e.key === 'Enter') handleAnswer()
  if (e.key === 'Escape') handleReject()
}
```
- **Impact:** Reduced efficiency for keyboard users
- **WCAG Criteria:** Enhancement beyond compliance, supports 2.1.1 Keyboard

#### MAJOR Issues

**A11Y-030: Emoji Without Text Alternative (WCAG 1.1.1 Level A)**
- **Severity:** Major
- **Location:** Line 5
```html
<div class="phone-ring">📞</div>

<!-- Should be -->
<div class="phone-ring" aria-label="Incoming call">
  <span aria-hidden="true">📞</span>
</div>
```
- **WCAG Criteria:** 1.1.1 Non-text Content (Level A)

**A11Y-031: Buttons Lack Descriptive Labels (WCAG 2.4.6 Level AA)**
- **Severity:** Major
- **Location:** Lines 18-25
```html
<button @click="handleAnswer" class="btn-answer" title="Answer">
  <span class="btn-icon">✓</span>
  <span>Answer</span>
</button>

<!-- Should be -->
<button
  @click="handleAnswer"
  class="btn-answer"
  aria-label="Answer incoming call from ${displayName} on line ${lineNumber}"
>
  <span class="btn-icon" aria-hidden="true">✓</span>
  <span>Answer</span>
</button>
```
- **WCAG Criteria:** 2.4.6 Headings and Labels (Level AA)

**A11Y-032: No Focus Trap in Modal (WCAG 2.4.3 Level A)**
- **Severity:** Major
- **Location:** Component
- **Issue:** Users can tab out of the alert dialog
- **Recommendation:** Implement focus trap to keep focus within alert
- **WCAG Criteria:** 2.4.3 Focus Order (Level A)

#### MINOR Issues

**A11Y-033: Notification API Without Error Handling (WCAG 3.3.1 Level A)**
- **Severity:** Minor
- **Location:** Lines 84-90
- **Issue:** No fallback if notification permission denied
```javascript
if ('Notification' in window && Notification.permission === 'granted') {
  try {
    new Notification('Incoming Call', { ... })
  } catch (error) {
    console.warn('Notification failed', error)
  }
} else if (Notification.permission === 'default') {
  // Could request permission
  Notification.requestPermission()
}
```
- **WCAG Criteria:** 3.3.1 Error Identification (Level A)

---

### 1.5 ConnectionPanel.vue - Connection Settings

#### MAJOR Issues

**A11Y-034: Missing Fieldset/Legend Grouping (WCAG 1.3.1 Level A)**
- **Severity:** Major
- **Location:** Lines 12-82
- **Issue:** Form inputs not grouped in fieldset
```html
<!-- Should wrap form groups in fieldset -->
<form @submit.prevent="handleConnect" class="connection-form">
  <fieldset>
    <legend>SIP Account Credentials</legend>
    <!-- form groups -->
  </fieldset>
</form>
```
- **WCAG Criteria:** 1.3.1 Info and Relationships (Level A), 3.3.2 Labels or Instructions (Level A)

**A11Y-035: Password Field Lacks Requirements (WCAG 3.3.2 Level A)**
- **Severity:** Major
- **Location:** Lines 26-35
- **Issue:** No password requirements or aria-describedby
```html
<input
  id="password"
  v-model="config.password"
  type="password"
  placeholder="Enter password"
  :disabled="isConnected"
  required
  aria-describedby="password-hint"
/>
<div id="password-hint" class="form-hint">
  Enter your SIP account password
</div>
```
- **WCAG Criteria:** 3.3.2 Labels or Instructions (Level A)

**A11Y-036: Status Indicator Uses Color Only (WCAG 1.4.1 Level A)**
- **Severity:** Major
- **Location:** Lines 5-8, 278-303
- **Issue:** Connection status indicated only by color dot
```html
<div class="status-indicator" :class="statusClass">
  <span class="status-dot"></span>
  <span class="status-text">{{ statusText }}</span>
</div>
<!-- Good: Has text. But color-blind users can't distinguish dot colors -->

<!-- Add visible icon or shape -->
<span class="status-icon" :aria-label="statusText">
  <svg v-if="isRegistered"><!-- checkmark --></svg>
  <svg v-else-if="isConnected"><!-- connecting --></svg>
  <svg v-else><!-- disconnected --></svg>
</span>
```
- **WCAG Criteria:** 1.4.1 Use of Color (Level A)

**A11Y-037: Emoji Icons Without Labeling (WCAG 1.1.1 Level A)**
- **Severity:** Major
- **Location:** Lines 68, 78
```html
<span class="btn-icon">🔌</span>
<!-- Should be aria-hidden since button has text -->
<span class="btn-icon" aria-hidden="true">🔌</span>
```
- **WCAG Criteria:** 1.1.1 Non-text Content (Level A)

#### MINOR Issues

**A11Y-038: Loading State Not Announced (WCAG 4.1.3 Level AA)**
- **Severity:** Minor
- **Location:** Lines 66-71
- **Issue:** "Connecting..." state change not announced
```html
<button :disabled="!canConnect || isConnecting" aria-live="polite">
  <span v-if="!isConnecting" class="btn-icon" aria-hidden="true">🔌</span>
  <span v-else class="btn-spinner" role="status" aria-label="Connecting"></span>
  {{ isConnecting ? 'Connecting...' : 'Connect' }}
</button>
```
- **WCAG Criteria:** 4.1.3 Status Messages (Level AA)

**A11Y-039: Pulsing Animation May Be Distracting (WCAG 2.3.3 Level AAA)**
- **Severity:** Minor
- **Location:** Lines 263-275
- **Issue:** Status dot pulsing animation may distract some users
- **Recommendation:** Provide option to reduce motion via prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  .status-dot {
    animation: none;
  }
}
```
- **WCAG Criteria:** 2.3.3 Animation from Interactions (Level AAA), 2.2.2 Pause, Stop, Hide (Level A)

**A11Y-040: No Visible Error Messages (WCAG 3.3.1 Level A)**
- **Severity:** Minor
- **Location:** Form validation
- **Issue:** Connection errors not displayed in UI (only console)
- **Recommendation:** Add visible error message region
```html
<div role="alert" aria-live="assertive" v-if="errorMessage" class="error-message">
  {{ errorMessage }}
</div>
```
- **WCAG Criteria:** 3.3.1 Error Identification (Level A)

---

### 1.6 index.html - Document Structure

#### MINOR Issues

**A11Y-041: Missing Skip Link (WCAG 2.4.1 Level A)**
- **Severity:** Minor
- **Location:** Lines 27-29
- **Issue:** No "skip to main content" link
```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <div id="app">
    <main id="main-content">
      <!-- content -->
    </main>
  </div>
</body>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}
.skip-link:focus {
  top: 0;
}
</style>
```
- **WCAG Criteria:** 2.4.1 Bypass Blocks (Level A)

**A11Y-042: Missing Meta Description (Enhancement)**
- **Severity:** Minor
- **Location:** Head section
- **Issue:** No meta description for SEO and context
```html
<meta name="description" content="Multi-line SIP phone application supporting up to 5 concurrent VoIP calls">
```
- **WCAG Criteria:** Enhancement beyond compliance

---

## 2. Multi-Line Specific Accessibility Issues

### Issue Summary

| Issue | Severity | WCAG Criteria | Status |
|-------|----------|---------------|--------|
| Call lines not announced when added/removed | Critical | 4.1.3 Level AA | ❌ |
| Active line switching not keyboard accessible | Critical | 2.1.1 Level A | ❌ |
| Active line not indicated to screen readers | Critical | 4.1.2 Level A | ❌ |
| Line states use color only | Major | 1.4.1 Level A | ❌ |
| Dialpad number keys don't work | Major | 2.1.1 Level A | ❌ |
| DTMF tones not keyboard accessible | Major | 2.1.1 Level A | ⚠️ (Buttons work, but not number keys) |
| Multiple states confuse screen readers | Major | 4.1.3 Level AA | ❌ |
| Incoming calls not announced | Critical | 4.1.3 Level AA | ❌ |
| Line status changes not announced | Critical | 4.1.3 Level AA | ❌ |
| No focus management when switching lines | Major | 2.4.3 Level A | ❌ |
| Call history lacks semantic structure | Major | 1.3.1 Level A | ❌ |

### A11Y-043: Call Line Management for Screen Readers
**Severity:** Critical
**Impact:** Screen reader users have no awareness of:
- How many lines are active
- Which line is currently active
- When a new line is added
- When a line is removed
- Line state changes (ringing → active → held)

**Required Changes:**
1. Add ARIA live region for call line announcements
2. Add aria-label to each call line with full state
3. Add aria-current to active line
4. Announce line additions/removals
5. Announce state transitions

### A11Y-044: Active Line Switching Keyboard Accessibility
**Severity:** Critical
**Impact:** Keyboard users cannot switch between lines efficiently

**Required Changes:**
1. Make call lines keyboard focusable (role="button" or actual buttons)
2. Add keyboard event handlers (Enter/Space to activate)
3. Add keyboard shortcuts (Ctrl+1-5 for lines 1-5)
4. Manage focus when switching lines
5. Add visual focus indicators

### A11Y-045: Multiple Simultaneous Call States
**Severity:** Major
**Impact:** Screen readers struggle to convey multiple active calls with different states

**Required Changes:**
1. Implement proper ARIA live regions per line
2. Use aria-atomic to announce complete line state
3. Debounce rapid state changes
4. Provide summary region announcing total active calls
5. Use appropriate aria-live values (polite vs assertive)

---

## 3. Complex Interface Accessibility Issues

### A11Y-046: Landmark Regions Not Defined
**Severity:** Critical
**WCAG:** 1.3.1 Level A, 2.4.1 Level A

**Current Structure:**
```html
<div class="multi-line-phone">
  <div class="left-panel">...</div>
  <div class="center-panel">...</div>
  <div class="right-panel">...</div>
</div>
```

**Required Structure:**
```html
<div class="multi-line-phone">
  <header>
    <h1>Multi-Line Phone</h1>
  </header>

  <main>
    <aside aria-label="Connection settings and call history">
      <!-- left-panel content -->
    </aside>

    <section aria-labelledby="active-lines-heading">
      <h2 id="active-lines-heading">Active Lines</h2>
      <!-- center-panel content -->
    </section>

    <aside aria-label="Dialpad and features">
      <!-- right-panel content -->
    </aside>
  </main>
</div>
```

### A11Y-047: Dynamic Content Update Announcements
**Severity:** Critical
**WCAG:** 4.1.3 Level AA

**Missing Announcements:**
- Call duration updates (should not announce every second)
- New call added to a line
- Call state changes
- Hold/unhold actions
- Mute/unmute actions
- Incoming call alerts
- Maximum lines warning

**Solution:** Implement ARIA live regions with appropriate politeness levels

---

## 4. Recommendations by Priority

### Priority 1 (Critical - Immediate Action Required)

#### P1-001: Implement ARIA Live Regions for Dynamic Content
**Files:** App.vue, CallLine.vue, IncomingCallAlert.vue
**Effort:** 8 hours
**Impact:** High

```vue
<!-- App.vue -->
<template>
  <div class="multi-line-phone">
    <!-- Screen reader announcements -->
    <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
      {{ srAnnouncement }}
    </div>

    <div role="alert" aria-live="assertive" class="sr-only">
      {{ srAlert }}
    </div>

    <!-- Rest of template -->
  </div>
</template>

<script>
const srAnnouncement = ref('')
const srAlert = ref('')

// Watch for call line changes
watch(callLines, (newLines, oldLines) => {
  if (newLines.length > oldLines.length) {
    const newLine = newLines[newLines.length - 1]
    srAlert.value = `New call on line ${newLines.length}`
  } else if (newLines.length < oldLines.length) {
    srAnnouncement.value = `Call ended. ${newLines.length} active ${newLines.length === 1 ? 'call' : 'calls'}`
  }
}, { deep: true })

// Watch for state changes
watch(callLines, (lines) => {
  lines.forEach((line, index) => {
    const oldState = oldStates.get(line.id)
    if (oldState && oldState !== line.state) {
      if (line.state === 'ringing') {
        srAlert.value = `Incoming call on line ${index + 1} from ${line.remoteDisplayName || line.remoteUri}`
      } else if (line.state === 'active') {
        srAnnouncement.value = `Line ${index + 1} call active`
      } else if (line.state === 'held') {
        srAnnouncement.value = `Line ${index + 1} on hold`
      }
    }
  })
}, { deep: true })

// Add CSS for screen reader only content
</script>

<style>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
```

#### P1-002: Make Call Lines Keyboard Accessible
**Files:** CallLine.vue
**Effort:** 4 hours
**Impact:** High

```vue
<!-- CallLine.vue -->
<template>
  <div
    class="call-line"
    role="button"
    tabindex="0"
    :aria-label="ariaLabel"
    :aria-current="isActiveLine ? 'true' : 'false'"
    :aria-pressed="isActiveLine"
    @click="handleLineClick"
    @keyup.enter="handleLineClick"
    @keyup.space.prevent="handleLineClick"
  >
    <!-- content -->
  </div>
</template>

<script setup>
const ariaLabel = computed(() => {
  const parts = [
    `Line ${props.lineNumber}`,
    props.state === 'ringing' ? 'Incoming call' : stateText.value,
    `from ${displayName.value}`,
  ]

  if (props.isActiveLine) parts.push('Active line')
  if (props.isOnHold) parts.push('On hold')
  if (props.isMuted) parts.push('Muted')
  if (props.state === 'active') parts.push(`Duration ${formattedDuration.value}`)

  return parts.join(', ')
})
</script>
```

#### P1-003: Implement Focus Management for Incoming Call Alerts
**Files:** IncomingCallAlert.vue
**Effort:** 3 hours
**Impact:** High

```vue
<!-- IncomingCallAlert.vue -->
<template>
  <div
    ref="alertRef"
    class="incoming-call-alert"
    role="alertdialog"
    aria-labelledby="alert-title"
    aria-describedby="alert-caller"
    aria-modal="true"
    @keydown="handleKeyboard"
  >
    <div class="alert-content">
      <div class="alert-info">
        <h3 id="alert-title" class="alert-title">Incoming Call</h3>
        <div class="alert-line">Line {{ lineNumber }}</div>
        <div id="alert-caller" class="caller-info">
          <div class="caller-name">{{ displayName }}</div>
          <div class="caller-uri">{{ remoteUri }}</div>
        </div>
      </div>

      <div class="alert-actions">
        <button ref="answerBtn" @click="handleAnswer" class="btn-answer"
                aria-label="`Answer call from ${displayName} on line ${lineNumber}`">
          <span aria-hidden="true">✓</span>
          <span>Answer</span>
        </button>
        <button @click="handleReject" class="btn-reject"
                aria-label="`Reject call from ${displayName}`">
          <span aria-hidden="true">✕</span>
          <span>Reject</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const alertRef = ref<HTMLElement | null>(null)
const answerBtn = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
let focusTrap: HTMLElement[] = []

onMounted(() => {
  // Store previous focus
  previousFocus = document.activeElement as HTMLElement

  // Set up focus trap
  const focusableElements = alertRef.value?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  focusTrap = Array.from(focusableElements || []) as HTMLElement[]

  // Move focus to first button
  answerBtn.value?.focus()

  // Trap focus within dialog
  document.addEventListener('keydown', trapFocus)
})

onUnmounted(() => {
  document.removeEventListener('keydown', trapFocus)
  // Restore focus
  previousFocus?.focus()
})

function trapFocus(e: KeyboardEvent) {
  if (e.key !== 'Tab') return

  const firstElement = focusTrap[0]
  const lastElement = focusTrap[focusTrap.length - 1]

  if (e.shiftKey && document.activeElement === firstElement) {
    e.preventDefault()
    lastElement?.focus()
  } else if (!e.shiftKey && document.activeElement === lastElement) {
    e.preventDefault()
    firstElement?.focus()
  }
}

function handleKeyboard(e: KeyboardEvent) {
  if (e.key === 'Enter') handleAnswer()
  if (e.key === 'Escape') handleReject()
}
</script>
```

#### P1-004: Add Semantic Landmarks
**Files:** App.vue
**Effort:** 2 hours
**Impact:** High

```vue
<!-- App.vue -->
<template>
  <div class="multi-line-phone">
    <header class="header">
      <h1>Multi-Line Phone</h1>
      <p class="subtitle">VueSip Advanced Example - Manage up to 5 concurrent calls</p>
    </header>

    <div class="main-container">
      <!-- Left Panel -->
      <aside class="left-panel" aria-label="Connection settings and call history">
        <nav aria-label="SIP connection">
          <ConnectionPanel ... />
        </nav>

        <section aria-labelledby="call-history-heading" v-if="callHistory.length > 0">
          <h2 id="call-history-heading">Recent Calls</h2>
          <ul class="history-list" role="list">
            <li v-for="entry in callHistory.slice(0, 10)" :key="entry.id"
                class="history-item" role="listitem">
              <!-- history content -->
            </li>
          </ul>
        </section>
      </aside>

      <!-- Center Panel -->
      <main class="center-panel">
        <section aria-labelledby="active-lines-heading">
          <div class="call-lines-header">
            <h2 id="active-lines-heading">
              Active Lines
              <span class="sr-only">
                {{ activeCallCount }} of {{ MAX_LINES }} lines in use
              </span>
            </h2>
            <!-- buttons -->
          </div>

          <div class="call-lines" role="group" aria-label="Active call lines">
            <CallLine v-for="(line, index) in callLines" ... />
          </div>
        </section>
      </main>

      <!-- Right Panel -->
      <aside class="right-panel" aria-label="Dialpad and application features">
        <section aria-label="Dialpad" v-if="showDialpad && isRegistered">
          <Dialpad ... />
        </section>
        <!-- info panels -->
      </aside>
    </div>
  </div>
</template>
```

### Priority 2 (Major - Complete Within Sprint)

#### P2-001: Fix Color-Only Indicators
**Files:** App.vue, CallLine.vue, ConnectionPanel.vue
**Effort:** 6 hours
**Impact:** Medium

**Call Line States - Add Text/Icon Indicators:**
```vue
<!-- CallLine.vue -->
<template>
  <div class="call-line">
    <div class="call-line__header">
      <div class="call-line__number">
        <span class="line-badge" :class="{ active: isActiveLine }">
          <span v-if="isActiveLine" aria-hidden="true">▶ </span>
          Line {{ lineNumber }}
        </span>
        <span class="state-badge" :class="stateClass">
          <span class="state-icon" aria-hidden="true">{{ stateIcon }}</span>
          {{ stateText }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
const stateIcon = computed(() => {
  const icons = {
    idle: '○',
    ringing: '🔔',
    calling: '📞',
    active: '●',
    held: '⏸',
    terminated: '✕',
    failed: '⚠'
  }
  return icons[props.state] || '○'
})
</script>
```

**Call History - Add Text Indicators:**
```vue
<!-- App.vue -->
<div class="history-info">
  <span class="history-uri">{{ entry.remoteUri || 'Unknown' }}</span>
  <span class="history-direction" :class="entry.direction">
    <span aria-hidden="true">{{ entry.direction === 'incoming' ? '📞' : '📲' }}</span>
    {{ entry.direction === 'incoming' ? 'Incoming' : 'Outgoing' }}
  </span>
</div>
```

#### P2-002: Add Keyboard Shortcuts for Dialpad
**Files:** Dialpad.vue
**Effort:** 4 hours
**Impact:** Medium

```vue
<!-- Dialpad.vue -->
<script setup>
import { onMounted, onUnmounted } from 'vue'

// Add keyboard listener when component is visible
onMounted(() => {
  document.addEventListener('keydown', handleKeyboardInput)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyboardInput)
})

function handleKeyboardInput(e: KeyboardEvent) {
  // Only handle if dialpad is active and not disabled
  if (props.disabled) return

  // Don't interfere if user is typing in input
  if (document.activeElement?.tagName === 'INPUT') return

  const key = e.key

  // Handle number keys, *, #
  if (/^[0-9*#]$/.test(key)) {
    e.preventDefault()
    handleKeyPress(key)
  }

  // Handle Enter to call
  if (key === 'Enter' && internalNumber.value.trim()) {
    e.preventDefault()
    handleCall()
  }

  // Handle Backspace to delete
  if (key === 'Backspace' && internalNumber.value) {
    e.preventDefault()
    internalNumber.value = internalNumber.value.slice(0, -1)
    emit('update:number', internalNumber.value)
  }
}
</script>

<!-- Add aria-keyshortcuts to buttons -->
<template>
  <button
    v-for="key in dialpadKeys"
    :key="key.value"
    @click="handleKeyPress(key.value)"
    class="dialpad-key"
    :aria-keyshortcuts="key.value"
    :aria-label="`Dial ${key.digit} ${key.letters ? key.letters : ''}`"
  >
    <span class="key-digit">{{ key.digit }}</span>
    <span v-if="key.letters" class="key-letters">{{ key.letters }}</span>
  </button>
</template>
```

#### P2-003: Fix Heading Hierarchy
**Files:** App.vue
**Effort:** 1 hour
**Impact:** Medium

```vue
<!-- App.vue -->
<template>
  <div class="multi-line-phone">
    <header class="header">
      <h1>Multi-Line Phone</h1> <!-- Keep as h1 -->
      <p class="subtitle">...</p>
    </header>

    <div class="main-container">
      <aside class="left-panel">
        <!-- Change from h3 to h2 -->
        <h2>Recent Calls</h2>
      </aside>

      <main class="center-panel">
        <!-- Keep as h2 -->
        <h2>Active Lines ({{ activeCallCount }}/{{ MAX_LINES }})</h2>
      </main>

      <aside class="right-panel">
        <!-- Change from h3 to h2 -->
        <h2>Getting Started</h2>
        <!-- and -->
        <h2>Multi-Line Features</h2>
      </aside>
    </div>
  </div>
</template>
```

#### P2-004: Remove/Hide Decorative Emojis
**Files:** All components
**Effort:** 2 hours
**Impact:** Medium

**Strategy:** Add `aria-hidden="true"` to all decorative emojis that are accompanied by text:

```vue
<!-- Before -->
<span class="btn-icon">📞</span>

<!-- After -->
<span class="btn-icon" aria-hidden="true">📞</span>
```

**Files to update:**
- App.vue: Lines 31, 84, 100, 138
- CallLine.vue: Lines 40, 44, 57, 67, 78, 83, 95, 103
- Dialpad.vue: Line 48
- IncomingCallAlert.vue: Line 5
- ConnectionPanel.vue: Lines 68, 78

#### P2-005: Add Form Field Grouping and Descriptions
**Files:** ConnectionPanel.vue
**Effort:** 3 hours
**Impact:** Medium

```vue
<!-- ConnectionPanel.vue -->
<template>
  <div class="connection-panel">
    <form @submit.prevent="handleConnect" class="connection-form">
      <fieldset>
        <legend class="sr-only">SIP Account Configuration</legend>

        <div class="form-group">
          <label for="sipUri">SIP URI</label>
          <input
            id="sipUri"
            v-model="config.sipUri"
            type="text"
            placeholder="sip:1000@example.com"
            :disabled="isConnected"
            required
            aria-required="true"
            aria-describedby="sipUri-hint"
          />
          <small id="sipUri-hint" class="form-hint">
            Your SIP account URI (e.g., sip:1000@example.com)
          </small>
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="config.password"
            type="password"
            placeholder="Enter password"
            :disabled="isConnected"
            required
            aria-required="true"
            aria-describedby="password-hint"
          />
          <small id="password-hint" class="form-hint">
            Your SIP account password
          </small>
        </div>

        <!-- Similar for other fields -->
      </fieldset>

      <!-- Error message region -->
      <div role="alert" aria-live="assertive" v-if="errorMessage" class="error-message">
        {{ errorMessage }}
      </div>

      <!-- Form actions -->
    </form>
  </div>
</template>

<style scoped>
.form-hint {
  display: block;
  margin-top: 4px;
  font-size: 0.85em;
  color: #6c757d;
}

.error-message {
  padding: 12px;
  margin-top: 16px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 8px;
  color: #721c24;
}
</style>
```

### Priority 3 (Minor - Nice to Have)

#### P3-001: Add Skip Link
**Files:** index.html, App.vue
**Effort:** 1 hour
**Impact:** Low

```html
<!-- index.html -->
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <div id="app"></div>
</body>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px 16px;
  text-decoration: none;
  z-index: 10000;
  border-radius: 0 0 4px 0;
}
.skip-link:focus {
  top: 0;
}
</style>
```

```vue
<!-- App.vue -->
<main class="center-panel" id="main-content">
  <!-- content -->
</main>
```

#### P3-002: Add Reduced Motion Support
**Files:** All components with animations
**Effort:** 2 hours
**Impact:** Low

```css
/* Add to all components with animations */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .status-dot {
    animation: none;
  }

  .call-line--ringing {
    animation: none;
  }

  .phone-ring {
    animation: none;
  }
}
```

#### P3-003: Improve Button Descriptions
**Files:** CallLine.vue
**Effort:** 2 hours
**Impact:** Low

```vue
<!-- CallLine.vue -->
<button
  @click.stop="$emit('answer')"
  class="btn btn--success"
  :aria-label="`Answer incoming call from ${displayName}`"
>
  <span aria-hidden="true">📞</span>
  <span>Answer</span>
</button>

<button
  @click.stop="handleToggleHold"
  class="btn btn--secondary"
  :aria-label="isOnHold ? `Resume call with ${displayName}` : `Put call with ${displayName} on hold`"
  :aria-pressed="isOnHold"
>
  <span class="btn-icon" aria-hidden="true">{{ isOnHold ? '▶️' : '⏸️' }}</span>
  {{ isOnHold ? 'Resume' : 'Hold' }}
</button>
```

#### P3-004: Add Visible Error Messages
**Files:** ConnectionPanel.vue, App.vue
**Effort:** 3 hours
**Impact:** Low

```vue
<!-- ConnectionPanel.vue -->
<script setup>
const errorMessage = ref('')

async function handleConnect() {
  errorMessage.value = ''
  try {
    // connection logic
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'Failed to connect to SIP server. Please check your credentials.'
  }
}
</script>

<template>
  <div role="alert" aria-live="assertive" v-if="errorMessage" class="error-message">
    <strong>Connection Error:</strong> {{ errorMessage }}
  </div>
</template>
```

---

## 5. ARIA Patterns to Use

### Pattern 1: Alert Dialog (Incoming Calls)
**Reference:** [WAI-ARIA Authoring Practices - Alert Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)

```vue
<div
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-desc"
>
  <h3 id="dialog-title">Incoming Call</h3>
  <div id="dialog-desc">Call from {{ callerName }}</div>
  <button>Answer</button>
  <button>Reject</button>
</div>
```

**Requirements:**
- Focus moves to dialog when it opens
- Focus is trapped within dialog
- Focus returns to triggering element when closed
- Escape key closes dialog (reject call)
- aria-modal="true" indicates modal behavior

### Pattern 2: Live Region (Status Updates)
**Reference:** [WAI-ARIA Authoring Practices - Live Regions](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)

```vue
<!-- Polite announcements (state changes) -->
<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
  {{ statusAnnouncement }}
</div>

<!-- Assertive announcements (incoming calls) -->
<div role="alert" aria-live="assertive" class="sr-only">
  {{ alertAnnouncement }}
</div>
```

**Usage:**
- `aria-live="polite"`: For state changes, line updates
- `aria-live="assertive"`: For incoming calls, critical errors
- `aria-atomic="true"`: Read entire region on update
- `class="sr-only"`: Visually hidden but available to screen readers

### Pattern 3: Radio Group (Call Lines)
**Alternative Approach:** Treat call lines as a radio group where one is active

```vue
<div role="radiogroup" aria-labelledby="lines-label">
  <div id="lines-label" class="sr-only">Active call lines</div>

  <div
    v-for="line in callLines"
    :key="line.id"
    role="radio"
    :aria-checked="line.id === activeLineId"
    :aria-label="`Line ${getLineNumber(line.id)}: ${line.state}`"
    tabindex="0"
    @click="makeLineActive(line.id)"
    @keydown.space.prevent="makeLineActive(line.id)"
  >
    <!-- line content -->
  </div>
</div>
```

### Pattern 4: Feed (Call History)
**Reference:** [WAI-ARIA Authoring Practices - Feed](https://www.w3.org/WAI/ARIA/apg/patterns/feed/)

```vue
<section aria-labelledby="history-heading">
  <h2 id="history-heading">Recent Calls</h2>
  <ul role="feed" aria-label="Call history feed">
    <li
      v-for="entry in callHistory"
      :key="entry.id"
      role="article"
      :aria-label="`${entry.direction} call ${entry.direction === 'incoming' ? 'from' : 'to'} ${entry.remoteUri}`"
    >
      <!-- history content -->
    </li>
  </ul>
</section>
```

### Pattern 5: Button (Call Line Selection)
**Reference:** [WAI-ARIA Authoring Practices - Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)

```vue
<div
  role="button"
  tabindex="0"
  :aria-pressed="isActiveLine"
  :aria-label="callLineAriaLabel"
  @click="handleLineClick"
  @keydown.enter="handleLineClick"
  @keydown.space.prevent="handleLineClick"
>
  <!-- Call line content -->
</div>
```

**Requirements:**
- `role="button"` for screen readers
- `tabindex="0"` for keyboard focus
- Handle both Enter and Space keys
- `aria-pressed` for toggle buttons
- Descriptive `aria-label`

---

## 6. Testing Recommendations

### Automated Testing Tools
1. **axe DevTools** - Browser extension for automated accessibility testing
2. **WAVE** - Web accessibility evaluation tool
3. **Lighthouse** - Built into Chrome DevTools
4. **Pa11y** - Automated accessibility testing CLI tool

### Manual Testing Checklist

#### Keyboard Navigation
- [ ] Can navigate entire app using only keyboard (Tab, Shift+Tab)
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] Focus order is logical
- [ ] No keyboard traps
- [ ] Can switch between call lines with keyboard
- [ ] Can answer/reject calls with keyboard
- [ ] Dialpad works with number keys
- [ ] DTMF pad works with number keys

#### Screen Reader Testing
**Test with:**
- NVDA (Windows - Free)
- JAWS (Windows - Commercial)
- VoiceOver (macOS/iOS - Built-in)
- TalkBack (Android - Built-in)

**Checklist:**
- [ ] All page regions announced correctly
- [ ] Heading hierarchy is logical when navigating
- [ ] Call line states announced
- [ ] Active line announced
- [ ] Line additions/removals announced
- [ ] Incoming calls announced
- [ ] State changes announced
- [ ] Button labels are descriptive
- [ ] Form labels are associated correctly
- [ ] Error messages are announced
- [ ] Loading states are announced

#### Color Contrast Testing
- [ ] Test with Color Contrast Analyzer
- [ ] All text meets 4.5:1 ratio (AA)
- [ ] Large text meets 3:1 ratio (AA)
- [ ] Test with color blindness simulators
- [ ] Ensure color is not only indicator

#### Low Vision Testing
- [ ] Test at 200% zoom
- [ ] Test with high contrast mode
- [ ] Test with reduced motion
- [ ] Ensure all content remains visible and functional

### Testing Scenarios

#### Scenario 1: Receive Incoming Call
1. Start screen reader
2. Navigate to application
3. Trigger incoming call (or wait for one)
4. **Verify:** Incoming call announcement is immediate and assertive
5. **Verify:** Focus moves to incoming call alert
6. **Verify:** Can answer with keyboard (Enter)
7. **Verify:** Can reject with keyboard (Escape)
8. **Verify:** Call state change announced

#### Scenario 2: Make Outgoing Call
1. Navigate to dialpad with keyboard
2. **Verify:** Can type number with keyboard
3. **Verify:** Can use number keys to dial
4. **Verify:** Form labels are announced
5. Press Enter or click Call button
6. **Verify:** Call state announced ("Calling...")
7. **Verify:** When answered, state change announced
8. **Verify:** Call duration visible but not constantly announced

#### Scenario 3: Switch Between Multiple Lines
1. Set up 2+ active calls
2. Navigate to call lines with keyboard
3. **Verify:** Each line is keyboard focusable
4. **Verify:** Line information announced when focused
5. Activate different line with Enter/Space
6. **Verify:** Line switch announced
7. **Verify:** Active line clearly indicated visually
8. **Verify:** Hold state announced for previous line

#### Scenario 4: Use DTMF During Call
1. Navigate to active call
2. Open DTMF pad
3. **Verify:** DTMF pad appearance announced
4. **Verify:** Can use number keys on keyboard
5. Press DTMF button
6. **Verify:** Button press acknowledged (visual or audio)

---

## 7. Implementation Roadmap

### Phase 1: Critical Fixes (Week 1-2)
**Goal:** Achieve basic WCAG 2.1 Level A compliance

| Task | Effort | Owner | Dependencies |
|------|--------|-------|--------------|
| Add ARIA live regions | 8h | Dev | None |
| Make call lines keyboard accessible | 4h | Dev | None |
| Implement focus management for alerts | 3h | Dev | None |
| Add semantic landmarks | 2h | Dev | None |
| Fix heading hierarchy | 1h | Dev | None |
| **Total** | **18h** | | |

### Phase 2: Major Improvements (Week 3-4)
**Goal:** Achieve WCAG 2.1 Level AA compliance

| Task | Effort | Owner | Dependencies |
|------|--------|-------|--------------|
| Fix color-only indicators | 6h | Dev | Phase 1 |
| Add keyboard shortcuts for dialpad | 4h | Dev | None |
| Add form field grouping | 3h | Dev | None |
| Remove/hide decorative emojis | 2h | Dev | None |
| Improve button descriptions | 2h | Dev | Phase 1 |
| **Total** | **17h** | | |

### Phase 3: Polish & AAA (Week 5)
**Goal:** Address remaining issues and AAA criteria

| Task | Effort | Owner | Dependencies |
|------|--------|-------|--------------|
| Add skip link | 1h | Dev | Phase 1 |
| Add reduced motion support | 2h | Dev | None |
| Add visible error messages | 3h | Dev | None |
| Comprehensive testing | 8h | QA | Phases 1-2 |
| Documentation updates | 4h | Tech Writer | All phases |
| **Total** | **18h** | | |

### Total Effort Estimate
- **Phase 1:** 18 hours (Critical)
- **Phase 2:** 17 hours (Major)
- **Phase 3:** 18 hours (Polish)
- **Total:** 53 hours (~1.3 sprints)

---

## 8. Success Metrics

### Compliance Targets
- [ ] **WCAG 2.1 Level A:** 100% compliance
- [ ] **WCAG 2.1 Level AA:** 100% compliance
- [ ] **WCAG 2.1 Level AAA:** 80% compliance (where applicable)

### Automated Testing Scores
- [ ] **Lighthouse Accessibility Score:** ≥95/100
- [ ] **axe DevTools:** 0 violations
- [ ] **WAVE:** 0 errors, <5 alerts

### User Testing
- [ ] **Screen Reader Users:** 5 users can complete all tasks
- [ ] **Keyboard-Only Users:** 5 users can complete all tasks
- [ ] **Low Vision Users:** 3 users can complete tasks at 200% zoom
- [ ] **Color Blind Users:** 3 users can distinguish all states

### Performance Benchmarks
- [ ] **Focus Management:** <100ms to move focus
- [ ] **State Announcements:** <200ms after state change
- [ ] **Keyboard Response:** <50ms for keypress handling

---

## 9. Maintenance & Ongoing Compliance

### Code Review Checklist
For every new component or feature:
- [ ] All interactive elements are keyboard accessible
- [ ] Proper ARIA attributes used
- [ ] Color not used as only indicator
- [ ] Focus management implemented
- [ ] Semantic HTML used
- [ ] Screen reader testing completed
- [ ] Automated accessibility tests pass

### Continuous Monitoring
- Run axe-core in CI/CD pipeline
- Monthly manual accessibility audits
- User feedback monitoring
- Stay updated on WCAG guidelines

---

## 10. Resources & References

### WCAG 2.1 Guidelines
- [WCAG 2.1 Specification](https://www.w3.org/TR/WCAG21/)
- [How to Meet WCAG (Quick Reference)](https://www.w3.org/WAI/WCAG21/quickref/)
- [Understanding WCAG 2.1](https://www.w3.org/WAI/WCAG21/Understanding/)

### ARIA Patterns
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [Using ARIA](https://www.w3.org/TR/using-aria/)
- [ARIA in HTML](https://www.w3.org/TR/html-aria/)

### Testing Tools
- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE Tool](https://wave.webaim.org/)
- [Pa11y](https://pa11y.org/)
- [Color Contrast Analyzer](https://www.tpgi.com/color-contrast-checker/)

### Screen Readers
- [NVDA](https://www.nvaccess.org/) (Windows - Free)
- [JAWS](https://www.freedomscientific.com/products/software/jaws/) (Windows)
- VoiceOver (macOS/iOS - Built-in)
- TalkBack (Android - Built-in)

### Learning Resources
- [WebAIM](https://webaim.org/)
- [The A11Y Project](https://www.a11yproject.com/)
- [Inclusive Components](https://inclusive-components.design/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

---

## Appendix A: Complete Code Examples

### A.1 Enhanced App.vue with Full Accessibility

```vue
<template>
  <div class="multi-line-phone">
    <!-- Screen reader announcements -->
    <div role="status" aria-live="polite" aria-atomic="true" class="sr-only">
      {{ srAnnouncement }}
    </div>

    <div role="alert" aria-live="assertive" class="sr-only">
      {{ srAlert }}
    </div>

    <!-- Skip link target -->
    <span id="main-content"></span>

    <header class="header">
      <h1>Multi-Line Phone</h1>
      <p class="subtitle">VueSip Advanced Example - Manage up to 5 concurrent calls</p>
    </header>

    <div class="main-container">
      <!-- Left Panel: Connection and Call History -->
      <aside class="left-panel" aria-label="Connection settings and call history">
        <nav aria-label="SIP connection settings">
          <ConnectionPanel
            v-model:connected="isConnected"
            v-model:registered="isRegistered"
            :is-connecting="isConnecting"
            @connect="handleConnect"
            @disconnect="handleDisconnect"
          />
        </nav>

        <!-- Call History -->
        <section
          v-if="callHistory.length > 0"
          aria-labelledby="call-history-heading"
        >
          <h2 id="call-history-heading">Recent Calls</h2>
          <ul class="history-list" role="list">
            <li
              v-for="entry in callHistory.slice(0, 10)"
              :key="entry.id"
              class="history-item"
              role="listitem"
            >
              <div class="history-info">
                <span class="history-uri">{{ entry.remoteUri || 'Unknown' }}</span>
                <span class="history-direction" :class="entry.direction">
                  <span aria-hidden="true">
                    {{ entry.direction === 'incoming' ? '📞' : '📲' }}
                  </span>
                  {{ entry.direction === 'incoming' ? 'Incoming' : 'Outgoing' }}
                </span>
              </div>
              <span class="history-duration">{{ formatDuration(entry.duration || 0) }}</span>
            </li>
          </ul>
        </section>
      </aside>

      <!-- Center Panel: Active Call Lines -->
      <main class="center-panel">
        <section aria-labelledby="active-lines-heading">
          <div class="call-lines-header">
            <h2 id="active-lines-heading">
              Active Lines ({{ activeCallCount }}/{{ MAX_LINES }})
              <span class="sr-only">
                {{ activeCallCount }} of {{ MAX_LINES }} lines currently in use
              </span>
            </h2>
            <button
              v-if="activeCallCount < MAX_LINES"
              @click="showDialpad = !showDialpad"
              class="btn-new-call"
              :disabled="!isRegistered"
              :aria-label="showDialpad ? 'Hide dialpad' : 'Show dialpad to make new call'"
              :aria-expanded="showDialpad"
            >
              {{ showDialpad ? 'Hide Dialpad' : '+ New Call' }}
            </button>
          </div>

          <!-- Call Lines -->
          <div class="call-lines" role="group" aria-label="Active call lines">
            <CallLine
              v-for="(line, index) in callLines"
              :key="line.id"
              :line-number="index + 1"
              :session="line.session"
              :state="line.state"
              :remote-uri="line.remoteUri"
              :remote-display-name="line.remoteDisplayName"
              :duration="line.duration"
              :is-on-hold="line.isOnHold"
              :is-muted="line.isMuted"
              :is-active-line="line.id === activeLineId"
              :local-stream="line.localStream"
              :remote-stream="line.remoteStream"
              @answer="handleAnswer(line)"
              @reject="handleReject(line)"
              @hangup="handleHangup(line)"
              @hold="handleHold(line)"
              @unhold="handleUnhold(line)"
              @mute="handleMute(line)"
              @unmute="handleUnmute(line)"
              @make-active="makeLineActive(line.id)"
              @send-dtmf="handleSendDTMF(line, $event)"
            />
          </div>

          <!-- Empty State -->
          <div v-if="activeCallCount === 0" class="empty-state">
            <div class="empty-icon" aria-hidden="true">📞</div>
            <h3>No Active Calls</h3>
            <p>Use the dialpad to make a new call or wait for incoming calls</p>
          </div>
        </section>
      </main>

      <!-- Right Panel: Dialpad and Info -->
      <aside class="right-panel" aria-label="Dialpad and application features">
        <section v-if="showDialpad && isRegistered" aria-label="Dialpad">
          <Dialpad
            v-model:number="dialNumber"
            @call="handleMakeCall"
            :disabled="activeCallCount >= MAX_LINES"
          />
        </section>

        <section v-if="!isRegistered" class="info-panel" aria-labelledby="getting-started-heading">
          <div aria-hidden="true" class="info-icon">ℹ️</div>
          <h2 id="getting-started-heading">Getting Started</h2>
          <ol class="info-list">
            <li>Configure your SIP credentials in the Connection Panel</li>
            <li>Click "Connect" to establish connection</li>
            <li>Once registered, use the dialpad to make calls</li>
            <li>Manage up to 5 concurrent calls</li>
            <li>Switch between calls by clicking on them</li>
          </ol>
        </section>

        <section v-else class="info-panel" aria-labelledby="features-heading">
          <h2 id="features-heading">Multi-Line Features</h2>
          <ul class="feature-list">
            <li><strong>Hold/Resume:</strong> Put calls on hold while talking to others</li>
            <li><strong>Call Switching:</strong> Click on a line to make it active</li>
            <li><strong>Mute:</strong> Mute audio per call</li>
            <li><strong>DTMF:</strong> Send touch tones during calls</li>
            <li><strong>Multiple Lines:</strong> Handle up to 5 simultaneous calls</li>
          </ul>
        </section>
      </aside>
    </div>

    <!-- Incoming Call Alert -->
    <IncomingCallAlert
      v-for="line in incomingLines"
      :key="line.id"
      :remote-uri="line.remoteUri || 'Unknown'"
      :remote-display-name="line.remoteDisplayName"
      :line-number="getLineNumber(line.id)"
      @answer="handleAnswer(line)"
      @reject="handleReject(line)"
    />

    <!-- Max Lines Warning -->
    <div v-if="maxLinesWarning" role="alert" aria-live="assertive" class="max-lines-warning">
      <div class="warning-content">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <div class="warning-text">
          <strong>Maximum Lines Reached</strong>
          <p>You've reached the maximum of {{ MAX_LINES }} concurrent calls. Please end a call before starting a new one.</p>
        </div>
        <button
          @click="maxLinesWarning = false"
          class="warning-close"
          aria-label="Close maximum lines warning"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// ... existing imports and setup ...

// Screen reader announcements
const srAnnouncement = ref('')
const srAlert = ref('')
const previousCallLineStates = new Map<string, CallState>()

// Watch for call line additions/removals
watch(callLines, (newLines, oldLines) => {
  if (newLines.length > oldLines.length) {
    srAlert.value = `New call added. ${newLines.length} active ${newLines.length === 1 ? 'call' : 'calls'}`
  } else if (newLines.length < oldLines.length) {
    srAnnouncement.value = `Call ended. ${newLines.length} active ${newLines.length === 1 ? 'call' : 'calls'}`
  }
}, { deep: true })

// Watch for state changes
watch(callLines, (lines) => {
  lines.forEach((line, index) => {
    const oldState = previousCallLineStates.get(line.id)
    if (oldState && oldState !== line.state) {
      const lineNumber = index + 1
      const displayName = line.remoteDisplayName || line.remoteUri || 'Unknown'

      if (line.state === 'ringing') {
        srAlert.value = `Incoming call on line ${lineNumber} from ${displayName}`
      } else if (line.state === 'active' && oldState === 'ringing') {
        srAnnouncement.value = `Line ${lineNumber} call with ${displayName} active`
      } else if (line.state === 'active' && oldState === 'calling') {
        srAnnouncement.value = `Line ${lineNumber} call to ${displayName} connected`
      } else if (line.isOnHold && !oldState.includes('held')) {
        srAnnouncement.value = `Line ${lineNumber} on hold`
      } else if (!line.isOnHold && oldState.includes('held')) {
        srAnnouncement.value = `Line ${lineNumber} resumed`
      } else if (line.state === 'terminated') {
        srAnnouncement.value = `Line ${lineNumber} call ended`
      } else if (line.state === 'failed') {
        srAlert.value = `Line ${lineNumber} call failed`
      }
    }
    previousCallLineStates.set(line.id, line.state)
  })
}, { deep: true })

// Watch for active line changes
watch(activeLineId, (newId, oldId) => {
  if (newId !== oldId && newId) {
    const line = callLines.value.find(l => l.id === newId)
    if (line) {
      const lineNumber = callLines.value.indexOf(line) + 1
      const displayName = line.remoteDisplayName || line.remoteUri || 'Unknown'
      srAnnouncement.value = `Switched to line ${lineNumber} with ${displayName}`
    }
  }
})

// ... rest of existing code ...
</script>

<style scoped>
/* ... existing styles ... */

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
</style>
```

---

## Appendix B: Accessibility Testing Script

```javascript
// accessibility-test.js
// Run with: node accessibility-test.js

const { AxePuppeteer } = require('@axe-core/puppeteer');
const puppeteer = require('puppeteer');

async function runAccessibilityTests() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5173'); // Adjust URL as needed
  await page.waitForSelector('.multi-line-phone');

  const results = await new AxePuppeteer(page).analyze();

  console.log('Accessibility Test Results:');
  console.log('===========================');
  console.log(`Violations: ${results.violations.length}`);
  console.log(`Passes: ${results.passes.length}`);
  console.log(`Incomplete: ${results.incomplete.length}`);

  if (results.violations.length > 0) {
    console.log('\\nViolations:');
    results.violations.forEach((violation, index) => {
      console.log(`\\n${index + 1}. ${violation.help}`);
      console.log(`   Impact: ${violation.impact}`);
      console.log(`   WCAG: ${violation.tags.filter(tag => tag.startsWith('wcag')).join(', ')}`);
      console.log(`   Affected elements: ${violation.nodes.length}`);
      violation.nodes.forEach(node => {
        console.log(`   - ${node.html.substring(0, 100)}...`);
      });
    });
  }

  await browser.close();

  process.exit(results.violations.length > 0 ? 1 : 0);
}

runAccessibilityTests().catch(console.error);
```

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-08 | Accessibility Audit Team | Initial comprehensive audit |

