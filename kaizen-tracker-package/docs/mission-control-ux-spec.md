# Mission Control — Coach Dashboard UX Specification
**Kaizen Tracker v2 · Design System & Information Architecture**
*Authored: 2026-05-21 · Status: Draft for Review*

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [UX Audit of Current Dashboard](#2-ux-audit-of-current-dashboard)
3. [Information Architecture](#3-information-architecture)
4. [Layout Hierarchy & Wireframes](#4-layout-hierarchy--wireframes)
5. [Component Inventory](#5-component-inventory)
6. [Navigation System](#6-navigation-system)
7. [Design Tokens & Spacing](#7-design-tokens--spacing)
8. [Figma Auto-Layout Structure](#8-figma-auto-layout-structure)
9. [Mobile Responsive Strategy](#9-mobile-responsive-strategy)
10. [Accessibility Guidelines](#10-accessibility-guidelines)
11. [UX Rationale — Every Major Decision](#11-ux-rationale--every-major-decision)

---

## 1. Design Philosophy

### The 3-Second Rule
A coach running a live practice cannot afford to navigate menus to find critical information. Every status that matters — session state, attendance count, urgent alerts — must be readable within 3 seconds of opening the app, without any scrolling or interaction.

### Mission Control, Not Dashboard
The word "dashboard" implies passive reporting. "Mission Control" implies active command. The design:
- **Surfaces problems proactively** — it reaches out to the coach, not vice versa
- **Makes the next action obvious** — one dominant CTA at any given moment
- **Compresses time** — shows past (recent activity), present (live session), and future (upcoming events) simultaneously

### Design Principles
| Principle | Implementation |
|---|---|
| **Clarity over decoration** | Glass effects only where they create depth hierarchy, never for aesthetics alone |
| **Operational density** | More information per square inch than a typical dashboard, but organized, not cluttered |
| **Status at a glance** | Color-coded status system: green/amber/red used consistently and exclusively for status |
| **Touch-first interactions** | All interactive targets minimum 44×44px, primary actions reachable with one thumb |
| **Reduce cognitive load** | Group related information spatially; coach should not need to hold mental state |

---

## 2. UX Audit of Current Dashboard

### What the Current App Does Well
- Clean card-based layout with good whitespace
- Radix UI components provide solid accessibility baseline
- Supabase state management is reliable
- Dark mode support is scaffolded

### Critical UX Problems to Solve

#### Problem 1 — No Unified View
**Current state:** Six separate tabs (Launch, Attendance, Summary, Charts, Raffle, Settings). A coach must navigate to each tab to understand what's happening.
**Impact:** During a practice, a coach might be on the Attendance tab but miss that a player crossed a milestone visible on Summary. There is no ambient awareness.
**Fix:** Mission Control unifies the most critical information from every tab onto one screen.

#### Problem 2 — No Session Status Awareness
**Current state:** The LaunchPage shows an "active session warning" (lines 152–165 of LaunchPage.tsx) but this is only visible when you navigate there. There is no persistent indicator.
**Impact:** A coach could forget a session is active, navigate away, and return confused.
**Fix:** Persistent session status bar pinned to the top of every screen.

#### Problem 3 — No Alerts or Warnings
**Current state:** The app calculates perfect attendance streaks (AttendancePage.tsx lines 45–50) and session stats but never proactively warns the coach about anything.
**Impact:** A coach doesn't know that 5 players haven't checked in yet, or that a player is on the verge of losing raffle eligibility.
**Fix:** Alert surface in the dashboard with categorized, actionable alerts.

#### Problem 4 — LaunchPage is Form-First
**Current state:** The first screen the coach sees is a multi-field form (date picker, time, type, duration). This is cognitively heavy before context is established.
**Impact:** Friction at the most common action: starting a session.
**Fix:** Replace with a single Smart Start button that pre-fills sensible defaults (today's date, current time, last-used type/duration). Advanced options behind a disclosure.

#### Problem 5 — Navigation is Undiscoverable on Mobile
**Current state:** Mobile nav is a hamburger → drawer. The drawer shows 6 items. No indication which tab is most relevant to current context.
**Fix:** Bottom navigation bar on mobile (max 5 items, icons + labels). Context-aware highlighting based on session state.

#### Problem 6 — Leaderboard Ticker Occupies Prime Real Estate
**Current state:** The LeaderboardTicker runs across the full width just below the top nav. On mobile this consumes ~48px and is rarely actionable.
**Fix:** Move ticker into the Mission Control Dashboard as an inline Leaderboard strip card. Show it contextually (after a session, not during pre-session setup).

#### Problem 7 — Charts are Buried
**Current state:** ChartsPage is a separate tab with 5 standalone charts. Coaches likely never visit it mid-practice.
**Fix:** Promote sparklines (mini charts) into relevant cards. ChartsPage becomes a "deep analysis" view, not a primary nav destination.

#### Problem 8 — Raffle Has No Pre-Game Moment
**Current state:** RafflePage is a tab you navigate to. There's no moment of anticipation, no announcement moment.
**Fix:** Raffle becomes a **Modal Experience** triggered from the Mission Control dashboard via a Rewards card. When the raffle spins, it expands to full-screen. This increases the theatrical value.

---

## 3. Information Architecture

### Content Hierarchy (Priority Order)

```
TIER 1 — ALWAYS VISIBLE (0-scroll, above fold)
├── Global Session Status Bar         [active/idle/pending]
├── Mission Control Hero Pane
│   ├── Quick Action Primary CTA       [Start Session / Manage Session / End Session]
│   ├── Session Summary (when active)  [type, duration, time elapsed, headcount]
│   └── Today at a Glance             [date, next event, weather mood]
└── Alert Surface                      [0–3 badges, max, stacked]

TIER 2 — PRIMARY CONTENT (light scroll on desktop, card grid)
├── Attendance Snapshot               [present / absent / late]
├── Upcoming Events                   [next 3 events in timeline]
├── Today's Workflow Checklist        [check-off tasks]
└── Leaderboard Strip                 [top 5 by hours, sparkline]

TIER 3 — SECONDARY CONTENT (scroll or collapsed by default)
├── Recent Activity Feed              [last 5–7 events]
├── Training Summaries                [practice vs. optional hours, weekly trend]
└── Reward / Raffle Status            [eligibility counts, next spin]

TIER 4 — DEDICATED PAGES (full-page nav destinations)
├── Session Setup                     [previously "LaunchPage"]
├── Attendance Manager                [previously "AttendancePage"]
├── Reports & Charts                  [previously "Summary" + "Charts"]
├── Raffle Theater                    [previously "RafflePage"]
└── Settings                          [team config, roster, archive]
```

### Navigation Taxonomy

```
Primary Nav (5 items max)
├── Home          → Mission Control dashboard
├── Session       → Session setup + active session management
├── Roster        → Attendance + player management
├── Reports       → Summary stats + charts
└── More          → Raffle, Settings, Help (overflow menu)
```

---

## 4. Layout Hierarchy & Wireframes

### 4a. Desktop Layout (1280px+)

```
┌─────────────────────────────────────────────────────────────────────┐
│  GLOBAL SESSION STATUS BAR                                          │
│  ● LIVE PRACTICE  ·  0:47 elapsed  ·  14/18 checked in  [Manage →] │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  TOPBAR: [≡ Kaizen] [BISHOP BLANCHET FC]  [Search]  [Alerts🔴2] [👤] │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────┐ ┌────────────────────────────────────┐ ┌─────────────┐
│              │ │                                    │ │             │
│  LEFT NAV    │ │  MISSION CONTROL HERO              │ │  RIGHT      │
│              │ │  ┌──────────────────────────────┐  │ │  RAIL       │
│  ● Home      │ │  │  TODAY'S SESSION              │  │ │             │
│    Session   │ │  │  Practice · Thu May 21        │  │ │  ALERTS     │
│    Roster    │ │  │  4:00 PM → 5:30 PM            │  │ │  ─────────  │
│    Reports   │ │  │                               │  │ │  ⚠ 4 absent │
│    More      │ │  │  [▶ START SESSION]             │  │ │  ⚠ Raffle   │
│              │ │  └──────────────────────────────┘  │ │    closes   │
│  ─────────   │ │                                    │ │    Friday   │
│              │ │  ATTENDANCE SNAPSHOT               │ │             │
│  QUICK       │ │  ┌──────┐  ┌──────┐  ┌──────┐     │ │  UPCOMING   │
│  ACTIONS     │ │  │  14  │  │   4  │  │   0  │     │ │  EVENTS     │
│  ─────────   │ │  │  ✓   │  │  ✗   │  │  ⏱   │     │ │  ─────────  │
│  + Add Guest │ │  │Present│ │Absent│  │ Late │     │ │  Fri 5/22   │
│  ✓ Checklist │ │  └──────┘  └──────┘  └──────┘     │ │  Optional   │
│  🎁 Raffle   │ │                                    │ │  Training   │
│              │ │  ─────────────────────────────     │ │  4:30 PM    │
│              │ │                                    │ │             │
│              │ │  TODAY'S CHECKLIST                 │ │  Mon 5/25   │
│              │ │  ┌─────────────────────────────┐  │ │  Practice   │
│              │ │  │ ☑ Set up cones              │  │ │  4:00 PM    │
│              │ │  │ ☑ Take attendance           │  │ │             │
│              │ │  │ ☐ Run passing drills 20min  │  │ │  LEADERBD   │
│              │ │  │ ☐ End session               │  │ │  ─────────  │
│              │ │  └─────────────────────────────┘  │ │  1. Chen    │
│              │ │                                    │ │     42.5h   │
│              │ │  ─────────────────────────────     │ │  2. Torres  │
│              │ │                                    │ │     38.0h   │
│              │ │  TRAINING SUMMARIES                │ │  3. Patel   │
│              │ │  ┌────────────────────────────┐   │ │     35.5h   │
│              │ │  │ This Week ████████░░ 6/8h  │   │ │             │
│              │ │  │ Practice  ████░░░░░░ 4h    │   │ │  REWARDS    │
│              │ │  │ Optional  ████░░░░░░ 2h    │   │ │  ─────────  │
│              │ │  │ [sparkline trend ↗]         │   │ │  🎁 9 elig. │
│              │ │  └────────────────────────────┘   │ │  Next spin  │
│              │ │                                    │ │  available  │
│              │ │  RECENT ACTIVITY                   │ │             │
│              │ │  ┌────────────────────────────┐   │ │             │
│              │ │  │ ✓ Session saved · Tue 5/19 │   │ │             │
│              │ │  │ ✓ Chen — milestone 40h     │   │ │             │
│              │ │  │ + Torres — added to roster  │   │ │             │
│              │ │  └────────────────────────────┘   │ │             │
│              │ │                                    │ │             │
└──────────────┘ └────────────────────────────────────┘ └─────────────┘
```

**Column proportions (desktop 1280px):**
- Left nav: 220px fixed
- Main content: flex-1 (min 580px)
- Right rail: 280px fixed

---

### 4b. Dashboard States — Hero Panel

The Hero panel changes based on session state. This is the single most important section.

**State A — No Active Session (Idle)**
```
┌─────────────────────────────────────────────────────────────┐
│  Thursday, May 21, 2026                                      │
│                                                              │
│  NEXT EVENT: Practice · Today at 4:00 PM  [in 2h 15min]    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │   Ready to run today's practice?                   │    │
│  │   18 players · 1:30 duration                       │    │
│  │                                                     │    │
│  │         [▶  START PRACTICE — TODAY]                 │    │
│  │                                                     │    │
│  │         Configure ▾ (change date/time/type)        │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**State B — Session In Progress (Active)**
```
┌─────────────────────────────────────────────────────────────┐
│  ● LIVE  ·  PRACTICE                            ⏱ 0:47:23   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  14 / 18 players checked in                          │   │
│  │  ████████████████░░░░  78%                           │   │
│  │                                                      │   │
│  │  ⚠ Still absent: Torres, Chen, Kim, Patel           │   │
│  │                                                      │   │
│  │  [✓ Mark Attendance]  [⏹ End Session]               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**State C — Session Ended, Unsaved**
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠ SESSION ENDED — NOT YET SAVED                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Practice · 1h 30min · 16/18 attended               │    │
│  │                                                      │    │
│  │  Review attendance before saving?                   │    │
│  │                                                      │    │
│  │     [Review & Save]        [Save Now]                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

### 4c. Tablet Layout (768px – 1279px)

Two-column layout. Left nav collapses to icon-only rail (48px wide). Right rail stacks below main content.

```
┌──────┐ ┌──────────────────────────────────────────────────┐
│      │ │  SESSION STATUS BAR (full width)                  │
│ ICON │ ├───────────────────────┬──────────────────────────┤
│ NAV  │ │  HERO PANEL           │  ALERTS + UPCOMING        │
│      │ │  (session state)      │  (right rail, stacked)   │
│  ●   │ ├───────────────────────┴──────────────────────────┤
│  □   │ │  ATTENDANCE SNAPSHOT  [3 stat tiles]              │
│  □   │ ├───────────────────────────────────────────────────┤
│  □   │ │  CHECKLIST            TRAINING SUMMARY            │
│  □   │ ├───────────────────────────────────────────────────┤
│      │ │  RECENT ACTIVITY      LEADERBOARD / REWARDS        │
└──────┘ └───────────────────────────────────────────────────┘
```

---

### 4d. Mobile Layout (< 768px)

Single-column. Fixed bottom navigation bar. Session status bar at top.

```
┌────────────────────────────────┐
│  ● LIVE · Practice · 0:47      │  ← Sticky session status bar
├────────────────────────────────┤
│  Kaizen Tracker        🔔(2)   │  ← Topbar (compact)
├────────────────────────────────┤
│                                │
│  ┌──────────────────────────┐  │
│  │  HERO PANEL              │  │  ← Full width, state-driven
│  │  (session CTA or active  │  │
│  │   session progress)      │  │
│  └──────────────────────────┘  │
│                                │
│  ┌────┐  ┌────┐  ┌────┐       │
│  │ 14 │  │  4 │  │  0 │       │  ← Attendance tiles (3-col)
│  │ ✓  │  │ ✗  │  │ ⏱ │       │
│  └────┘  └────┘  └────┘       │
│                                │
│  [ALERTS — 2 warnings ▾]       │  ← Collapsible
│                                │
│  TODAY'S CHECKLIST             │
│  ┌──────────────────────────┐  │
│  │ ☑ Take attendance        │  │
│  │ ☐ Run drills 20min       │  │
│  │ ☐ End session            │  │
│  └──────────────────────────┘  │
│                                │
│  UPCOMING EVENTS               │
│  [timeline strip ─────────]    │
│                                │
│  TRAINING SUMMARY  [sparkline] │
│                                │
│  RECENT ACTIVITY               │
│  · Session saved · Tue 5/19   │
│  · Chen milestone 40h          │
│                                │
│  REWARDS                       │
│  🎁 9 eligible · Next Fri      │
│                                │
├────────────────────────────────┤
│  [🏠]   [📋]   [👥]   [📊]  [⋯] │  ← Bottom nav (5 items)
└────────────────────────────────┘
```

---

## 5. Component Inventory

### 5a. Core Dashboard Components

#### `SessionStatusBar`
**Purpose:** Persistent, always-visible session state indicator. Pinned top of viewport.
**Props:**
```typescript
interface SessionStatusBarProps {
  session: ActiveSession | null
  attendanceCount: number
  rosterSize: number
  elapsedTime: number  // seconds
  onManage: () => void
}
```
**Visual states:**
- `idle`: Subtle dark bar, dim text. "No active session"
- `active`: Accent green left-border, animated pulse dot, elapsed timer
- `unsaved`: Amber background, warning icon. "Session unsaved"

**UX rationale:** The status bar solves the #1 problem — coaches losing track of whether a session is active. It uses minimal vertical space (36px) and is hidden when truly idle (no session today) to avoid visual noise.

---

#### `MissionControlHero`
**Purpose:** The command center. Renders differently based on session state. Always the first thing a coach looks at.
**States:** `idle` | `session-active` | `session-unsaved` | `post-session`
**Subcomponents:**
- `SmartStartButton` — single CTA with pre-filled defaults
- `SessionProgressBar` — attendance fill bar during active session
- `AbsentPlayerChips` — shows names of unchecked players
- `SessionActions` — contextual action buttons
- `ConfigureSessionDisclosure` — disclosure panel for advanced session setup

**UX rationale:** By making the CTA state-aware, we eliminate the cognitive friction of "which tab do I go to?". The coach always opens the app and sees exactly what action is needed.

---

#### `AttendanceSnapshot`
**Purpose:** At-a-glance count of present / absent / late players. No navigation required.
**Props:**
```typescript
interface AttendanceSnapshotProps {
  present: number
  absent: number
  late: number
  rosterSize: number
  onExpand: () => void  // opens AttendancePage
}
```
**Layout:** 3 tiles in a row. Large number, status icon, label. Tappable — links to full AttendancePage.

**Visual treatment:**
- Present: `--color-success` (green) background tint
- Absent: `--color-warning` (amber) when > 0 absent, else muted
- Late: `--color-caution` (orange) tint

---

#### `AlertSurface`
**Purpose:** Proactively surfaces actionable warnings. Maximum 3 alerts shown (rest collapsed).
**Alert types:**
```typescript
type AlertType =
  | "players-absent"       // N players not checked in
  | "raffle-deadline"      // Raffle closes in N days
  | "milestone-pending"    // Player approaching hour milestone
  | "session-unsaved"      // Active session not saved
  | "streak-at-risk"       // Player perfect attendance at risk
  | "roster-incomplete"    // Roster changes needed
```
**Visual treatment:** Compact 48px rows. Icon + short message + dismiss button + action link.
**Priority ordering:** session-unsaved > players-absent > streak-at-risk > others.

**UX rationale:** Alerts are ordered by operational urgency. During a session, "4 players absent" is tier-1 info. Post-session, "unsaved" is tier-1. The system automatically promotes the most important alert to the top.

---

#### `WorkflowChecklist`
**Purpose:** A lightweight, session-scoped to-do list that resets each session.
**Items (default, configurable):**
- Pre-session: Set up equipment, confirm roster, open attendance
- During session: Take attendance, run drills, note performance
- Post-session: End session, review stats, save session

**Props:**
```typescript
interface WorkflowChecklistProps {
  phase: "pre" | "active" | "post"
  items: ChecklistItem[]
  onToggle: (id: string) => void
  onAddItem: (text: string) => void
}
```
**UX rationale:** Coaches running multiple practices a week can develop repeatable workflows. By persisting the checklist structure (but resetting checks) between sessions, this reduces cognitive overhead. Phase-gating hides post-session tasks until a session is active.

---

#### `UpcomingEventsTimeline`
**Purpose:** Shows the next 3–5 events as a horizontal timeline on desktop, vertical list on mobile.
**Data:** Derived from `events` array in TeamState, filtered to future dates.
**Visual:** Each event is a pill/chip with:
- Day label (TODAY / Tomorrow / Day name)
- Event type badge (Practice: blue / Optional: purple)
- Start time
- Relative time ("in 2h 15min", "Tomorrow")

---

#### `TrainingSummaryCard`
**Purpose:** Shows weekly practice vs. optional training hours with a mini trend line.
**Metrics:**
- This week: X hours (bar fill against weekly target)
- Practice: X hours / Optional: X hours
- Week-over-week trend sparkline (6 weeks)

**UX rationale:** Replaces the need to navigate to ChartsPage for a quick read. A coach should be able to tell in 2 seconds "are we on track this week?"

---

#### `RecentActivityFeed`
**Purpose:** Condensed version of the admin activity feed, showing coach-relevant events only.
**Event types shown:**
- Session saved
- Player milestone (X hours reached)
- Player added/removed from roster
- Archive created
- Raffle held

**Visual:** Compact list, 40px row height. Icon + description + relative timestamp. Max 7 items, "View all" link.

---

#### `RewardsCard`
**Purpose:** Shows raffle/reward status and provides entry point to the Raffle Theater.
**Displays:**
- Number of eligible players (optional training sessions attended)
- Next spin availability
- "Spin the Wheel" CTA button (opens RaffleModal)
- Last winner chip

**Visual:** Amber/gold accent. Subtle animated shimmer on the "Spin" button if a spin is available.

---

#### `LeaderboardStrip`
**Purpose:** Inline leaderboard, replaces the persistent ticker. Shown only when there's data.
**Displays:** Top 5 players by total hours, rank, name, hours, sparkline per player.

---

### 5b. Navigation Components

#### `GlobalNav` (desktop)
- Fixed left sidebar, 220px
- Logo + team name at top
- 5 primary nav items with icons + labels
- Quick actions section below nav items
- Collapsible to icon-only at 220→48px (tablet breakpoint)

#### `TopBar`
- Team name (centered or left)
- Global search (opens command palette)
- Alert bell with badge count
- Profile/logout menu

#### `BottomNav` (mobile only)
- 5 items: Home, Session, Roster, Reports, More
- Icons + labels
- Active indicator: filled icon + accent underline
- Badge on Session item when session is active

#### `SessionStatusBar`
- Full-width, 36px height
- Pinned below TopBar
- Hidden when no active session and no unsaved session

---

### 5c. Modal/Overlay Components

#### `ConfigureSessionModal`
Replaces the current LaunchPage form. Opened from the SmartStartButton "Configure" link.
- Full-screen on mobile, centered modal (600px) on desktop
- Pre-filled with sensible defaults
- Sections: date/time, event type, duration, roster preview

#### `RaffleTheaterModal`
Full-screen modal for the raffle wheel experience.
- Canvas spinning wheel (existing)
- Dramatic countdown + reveal
- Confetti on win
- Winner announcement card
- Share/screenshot button

#### `AlertDetailDrawer`
Slide-in drawer from right (desktop) or bottom sheet (mobile).
- Full list of all alerts
- Each alert has: severity icon, description, affected player(s), action button
- Dismiss all / dismiss individual

---

## 6. Navigation System

### Navigation Map

```
Home (Mission Control)
  ↓ CTA
Session Setup → [Start Session] → Attendance Manager → [End Session] → Save Confirmation
                                                                         ↓
                                                               Mission Control (updated state)

Reports → Summary Stats
        → Charts & Trends

Roster  → Player List
        → Add/Remove Player
        → Guest Management

More    → Raffle Theater
        → Settings (Team, Logo, Archive)
        → Help
```

### Keyboard Navigation (desktop)

| Shortcut | Action |
|---|---|
| `S` | Jump to Session Setup |
| `A` | Jump to Attendance |
| `H` | Go Home (Mission Control) |
| `R` | Open Reports |
| `Space` | Toggle checklist item when checklist focused |
| `Esc` | Close any modal/drawer |
| `Cmd+K` | Open command palette (search + quick actions) |

### Command Palette
Triggered via search input or Cmd+K. Provides:
- Start today's session (default settings)
- Mark [player name] as present/absent
- Navigate to any page
- Open last session
- Start raffle spin

---

## 7. Design Tokens & Spacing

### Color System

#### Semantic Color Roles
Do not use raw hex values in components. Use semantic tokens only.

```css
/* --- Backgrounds --- */
--color-bg-base:       #0a0f1a   /* Page background (dark navy) */
--color-bg-elevated:   #111827   /* Card background */
--color-bg-raised:     #1f2937   /* Elevated card / hover state */
--color-bg-overlay:    rgba(17, 24, 39, 0.85)  /* Modal/drawer backdrops */
--color-bg-glass:      rgba(31, 41, 55, 0.6)   /* Glassmorphism panels */

/* --- Text --- */
--color-text-primary:  #f9fafb   /* Primary text (nearly white) */
--color-text-secondary:#9ca3af   /* Secondary/muted text (gray-400) */
--color-text-tertiary: #6b7280   /* Disabled / very muted (gray-500) */
--color-text-inverse:  #111827   /* Text on light backgrounds */

/* --- Status (RESERVED — use ONLY for status indicators) --- */
--color-success:       #22c55e   /* Active, present, healthy */
--color-success-muted: rgba(34, 197, 94, 0.12)  /* Success bg tint */
--color-warning:       #f59e0b   /* Absent, warning, near-miss */
--color-warning-muted: rgba(245, 158, 11, 0.12) /* Warning bg tint */
--color-danger:        #ef4444   /* Error, critical, urgent */
--color-danger-muted:  rgba(239, 68, 68, 0.12)  /* Danger bg tint */
--color-caution:       #f97316   /* Late, borderline, minor issue */

/* --- Brand Accents --- */
--color-accent-primary:   #0ea5e9  /* Electric blue (action, active nav) */
--color-accent-secondary: #8b5cf6  /* Violet (optional training, raffle) */
--color-accent-gold:      #f59e0b  /* Amber/gold (rewards, raffle, trophies) */

/* --- Practice vs Optional Training (chart colors) --- */
--color-practice:  #3b82f6   /* Blue-500 (consistent with existing) */
--color-optional:  #8b5cf6   /* Violet-500 (consistent with existing) */

/* --- Borders --- */
--color-border-subtle:  rgba(255, 255, 255, 0.06)  /* Subtle dividers */
--color-border-default: rgba(255, 255, 255, 0.10)  /* Card borders */
--color-border-strong:  rgba(255, 255, 255, 0.20)  /* Focused states */
--color-border-accent:  #0ea5e9  /* Accent borders (active session bar) */
```

#### Glassmorphism Tokens
Used sparingly on the Hero panel and right rail.

```css
--glass-bg:     rgba(255, 255, 255, 0.04)
--glass-border: rgba(255, 255, 255, 0.08)
--glass-blur:   backdrop-filter: blur(12px)
--glass-shadow: 0 4px 24px rgba(0, 0, 0, 0.3)
```

**Rule:** Glassmorphism is applied to cards that sit on top of content (Hero panel, modals, right rail cards). Never apply to the page background itself.

---

### Typography Scale

```css
/* Display */
--text-display:  clamp(2rem, 4vw, 3rem)    /* Hero numbers: 14/18 */
--text-hero:     clamp(1.5rem, 3vw, 2rem)  /* Section titles */

/* Content */
--text-xl:       1.25rem  /* 20px — Card titles */
--text-lg:       1.125rem /* 18px — Section headers */
--text-base:     1rem     /* 16px — Body text */
--text-sm:       0.875rem /* 14px — Secondary text */
--text-xs:       0.75rem  /* 12px — Labels, timestamps, chips */

/* Weights */
--weight-bold:   700   /* Display numbers, primary CTAs */
--weight-semibold: 600 /* Section headers, card titles */
--weight-medium: 500   /* Nav items, labels */
--weight-normal: 400   /* Body text */

/* Line heights */
--leading-tight: 1.1   /* Headlines */
--leading-normal: 1.5  /* Body text */
--leading-relaxed: 1.7 /* Readable paragraphs */

/* Font family */
--font-sans: 'Inter', system-ui, sans-serif  /* Body, UI */
--font-mono: 'JetBrains Mono', monospace     /* Timers, numbers, codes */
```

**Timer display:** The elapsed session timer (`0:47:23`) should use `--font-mono` and `--weight-bold` for instant readability. Monospace prevents layout shift as digits change.

---

### Spacing Scale

Based on a 4px grid. Component-level spacing uses these named tokens.

```css
--space-1:  4px    /* Tight: icon padding, badge gaps */
--space-2:  8px    /* Compact: within-chip padding */
--space-3:  12px   /* Modest: label-to-icon gaps */
--space-4:  16px   /* Default: intra-card padding */
--space-5:  20px   /* Comfortable: button padding horizontal */
--space-6:  24px   /* Section: card padding */
--space-8:  32px   /* Generous: between major sections */
--space-10: 40px   /* Spacious: section headers */
--space-12: 48px   /* Large: hero section padding */
--space-16: 64px   /* XL: page vertical margins */
```

**Card padding:** `--space-6` (24px) on desktop, `--space-4` (16px) on mobile.
**Grid gaps:** `--space-4` (16px) between cards, `--space-8` (32px) between sections.

---

### Border Radius

```css
--radius-sm:   4px   /* Chips, badges, small buttons */
--radius-md:   8px   /* Inline elements, inputs */
--radius-lg:   12px  /* Cards, panels */
--radius-xl:   16px  /* Hero panels, modals */
--radius-2xl:  24px  /* Large cards */
--radius-full: 9999px /* Pills, toggles, avatars */
```

---

### Elevation / Shadow Scale

```css
--shadow-sm:  0 1px 2px rgba(0,0,0,0.3)
--shadow-md:  0 4px 12px rgba(0,0,0,0.35)
--shadow-lg:  0 8px 24px rgba(0,0,0,0.4)
--shadow-xl:  0 16px 48px rgba(0,0,0,0.5)
--shadow-glow-accent: 0 0 20px rgba(14, 165, 233, 0.3)  /* Active session */
--shadow-glow-warn:   0 0 20px rgba(245, 158, 11, 0.3)  /* Unsaved session */
```

---

### Animation Tokens

```css
--duration-fast:   150ms   /* Hover states, toggles */
--duration-normal: 250ms   /* Transitions, reveals */
--duration-slow:   400ms   /* Page transitions, modals */
--duration-xslow:  600ms   /* Hero entrance, celebration */

--easing-out:   cubic-bezier(0.0, 0.0, 0.2, 1.0)  /* Elements entering */
--easing-in:    cubic-bezier(0.4, 0.0, 1.0, 1.0)  /* Elements leaving */
--easing-inout: cubic-bezier(0.4, 0.0, 0.2, 1.0)  /* Layout shifts */
--easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1) /* Playful bounces */
```

---

## 8. Figma Auto-Layout Structure

### Frame Hierarchy in Figma

```
📁 Kaizen Tracker — Mission Control
│
├── 📁 Design Tokens
│   ├── 🎨 Colors (styles: semantic tokens above)
│   ├── 📝 Typography (styles: text styles)
│   ├── 📐 Spacing (component set: spacer)
│   └── 🔲 Shadows (styles: elevation tokens)
│
├── 📁 Components
│   ├── 📁 Atoms
│   │   ├── Badge (variant: success/warning/danger/caution/neutral)
│   │   ├── Chip (variant: event-type, player, status)
│   │   ├── StatusDot (variant: active/idle/warning)
│   │   ├── Avatar (size: sm/md/lg, state: present/absent/late)
│   │   ├── Button (variant: primary/secondary/ghost/danger, size: sm/md/lg)
│   │   └── ProgressBar (variant: attendance/hours/weekly)
│   │
│   ├── 📁 Molecules
│   │   ├── AlertRow (type: players-absent/raffle-deadline/etc.)
│   │   ├── ChecklistItem (state: unchecked/checked/disabled)
│   │   ├── EventChip (type: practice/optional)
│   │   ├── ActivityEntry (type: session-saved/milestone/etc.)
│   │   ├── LeaderboardRow (rank, name, hours, sparkline)
│   │   └── StatTile (label, number, icon, color-variant)
│   │
│   ├── 📁 Organisms
│   │   ├── SessionStatusBar (state: idle/active/unsaved)
│   │   ├── MissionControlHero (state: idle/active/unsaved/post)
│   │   ├── AttendanceSnapshot (3-tile row)
│   │   ├── AlertSurface (stack of AlertRows)
│   │   ├── WorkflowChecklist (phase-aware)
│   │   ├── UpcomingEventsTimeline (horizontal/vertical variant)
│   │   ├── TrainingSummaryCard (weekly progress + sparkline)
│   │   ├── RecentActivityFeed (condensed list)
│   │   ├── RewardsCard (raffle status)
│   │   └── LeaderboardStrip (top 5)
│   │
│   └── 📁 Layouts
│       ├── DashboardGrid — Desktop (3-column: 220 / flex / 280)
│       ├── DashboardGrid — Tablet (2-column: 48px icon rail / flex)
│       ├── DashboardGrid — Mobile (1-column with bottom nav)
│       ├── GlobalNav — Expanded (220px)
│       ├── GlobalNav — Collapsed (48px)
│       ├── TopBar
│       └── BottomNav (mobile)
│
├── 📁 Screens
│   ├── Mission Control — Desktop — Idle
│   ├── Mission Control — Desktop — Active Session
│   ├── Mission Control — Desktop — Post Session
│   ├── Mission Control — Mobile — Idle
│   ├── Mission Control — Mobile — Active Session
│   ├── Session Setup — Desktop
│   ├── Session Setup — Mobile
│   ├── Attendance Manager — Desktop
│   ├── Attendance Manager — Mobile
│   ├── Reports — Desktop
│   └── Raffle Theater — Full Screen
│
└── 📁 Prototype Flows
    ├── Flow 1: Start Session (Idle → Active)
    ├── Flow 2: Mark Attendance (Active → Attendance Page)
    ├── Flow 3: End + Save Session (Active → Post → Saved)
    └── Flow 4: Spin Raffle (Dashboard → Raffle Theater → Winner)
```

---

### Auto-Layout Specifications

#### `DashboardGrid` (Desktop)
```
Frame: Fill container width
Direction: Horizontal
Gap: 0 (gaps are handled by child padding)
Children:
  - GlobalNav: Fixed 220px, Fill height
  - MainContent: Fill, min-width 580px, padding: 32px 24px
  - RightRail: Fixed 280px, padding: 24px 16px, gap: 16px vertical
```

#### `MissionControlHero` Card
```
Frame: Fill width of MainContent
Direction: Vertical
Padding: 32px
Gap: 16px
Corner radius: 16px
Background: --glass-bg
Border: 1px solid --glass-border
Backdrop filter: blur(12px)
```

#### `AttendanceSnapshot` (3 tiles)
```
Frame: Fill width
Direction: Horizontal
Gap: 12px
Each tile:
  Direction: Vertical
  Padding: 16px 12px
  Gap: 8px
  Corner radius: 12px
  Fill: 1 (equal thirds)
```

#### `WorkflowChecklist` Card
```
Frame: Fill width
Direction: Vertical
Padding: 20px 24px
Gap: 0 (items are separated by 1px borders)
Each ChecklistItem:
  Direction: Horizontal
  Padding: 12px 0
  Gap: 12px
  Align items: Center
  Height: 44px (minimum touch target)
```

#### `AlertSurface` (Right rail)
```
Frame: Fill width (280px)
Direction: Vertical
Gap: 8px
Each AlertRow:
  Direction: Horizontal
  Padding: 10px 12px
  Gap: 10px
  Corner radius: 8px
  Min height: 48px
  Background: semantic tint per alert type
```

---

## 9. Mobile Responsive Strategy

### Breakpoints
```
xs:  < 480px   (small phones — iPhone SE)
sm:  480–767px (standard phones)
md:  768–1023px (tablets)
lg:  1024–1279px (small laptops)
xl:  1280px+   (desktop)
```

### Layout Transformations by Breakpoint

| Component | Desktop (xl) | Tablet (md) | Mobile (sm) |
|---|---|---|---|
| GlobalNav | Left sidebar 220px | Icon rail 48px | Hidden → BottomNav |
| RightRail | Fixed right 280px | Stacks below main | Inline, collapsed |
| Hero Panel | 2-column (text + CTA) | 1-column | 1-column, full width |
| AttendanceSnapshot | 3-col tiles | 3-col tiles | 3-col tiles (compact) |
| AlertSurface | Right rail | Right rail | Collapsible strip |
| Checklist | Card in main | Card in main | Card, full width |
| UpcomingEvents | Horizontal timeline | Horizontal timeline | Vertical list |
| TrainingSummary | Card with sparkline | Card with sparkline | Card, sparkline only |
| LeaderboardStrip | Right rail | Below main content | Horizontal scroll strip |
| RewardsCard | Right rail | Below main content | Card, inline |
| BottomNav | Hidden | Hidden | Fixed bottom 64px |
| TopBar | Full (search visible) | Full (search icon) | Compact (title + bell) |
| SessionStatusBar | Full (all details) | Full (all details) | Compact (status + count) |

### Touch Target Guidelines (Mobile)
- All interactive elements: minimum 44×44px
- Bottom nav items: 64px height, full-width tap zone
- Checklist items: 44px min height (current card padding is sufficient)
- Alert dismiss buttons: 44×44px, positioned for right-thumb reach
- Primary CTA (Start Session): 56px height, full width on mobile

### Mobile-First Performance
- Checklist and activity feed are rendered server-side or statically — no loading states
- TrainingSummary sparkline uses SVG (no canvas) for GPU-efficient animation
- RaffleTheaterModal uses `lazy()` import — only loads when coach opens it
- LeaderboardStrip uses `IntersectionObserver` to pause animation off-screen

---

## 10. Accessibility Guidelines

### Color Contrast Requirements
All text must meet WCAG 2.1 AA (4.5:1 body text, 3:1 large text).

| Token | On Background | Contrast Ratio | Status |
|---|---|---|---|
| `--color-text-primary` (#f9fafb) | `--color-bg-elevated` (#111827) | 14.7:1 | ✅ AAA |
| `--color-text-secondary` (#9ca3af) | `--color-bg-elevated` (#111827) | 5.1:1 | ✅ AA |
| `--color-success` (#22c55e) | `--color-bg-elevated` (#111827) | 5.8:1 | ✅ AA |
| `--color-warning` (#f59e0b) | `--color-bg-elevated` (#111827) | 8.2:1 | ✅ AAA |
| `--color-danger` (#ef4444) | `--color-bg-elevated` (#111827) | 5.2:1 | ✅ AA |
| `--color-accent-primary` (#0ea5e9) | `--color-bg-elevated` (#111827) | 6.9:1 | ✅ AA |

**Important:** Never use color alone to convey status. Each status color is always paired with:
- An icon (StatusDot, warning triangle, checkmark)
- A text label
- A shape/pattern change (filled vs. outlined)

### Focus Management
- Keyboard focus ring: `outline: 2px solid var(--color-accent-primary); outline-offset: 2px`
- Modal/drawer open: focus moves to first interactive element inside
- Modal/drawer close: focus returns to triggering element
- Use `aria-live="polite"` on SessionStatusBar and AlertSurface for screen reader announcements
- Session timer uses `aria-label="Session elapsed time"` updated every minute (not every second — reduces screen reader noise)

### Semantic HTML Requirements
- `<nav>` for GlobalNav and BottomNav with `aria-label="Main navigation"`
- `<main>` wraps MissionControlHero and content area
- `<aside>` wraps RightRail
- Alert badges use `role="status"` and `aria-live="polite"`
- Checklist uses `<ul>` with `role="list"`, each item `role="listitem"` with checkbox
- Session status bar uses `role="banner"` equivalent context

---

## 11. UX Rationale — Every Major Decision

### Decision 1: Three-Column Desktop Layout
**Alternatives considered:** Full-width single column (Notion-style), two-column (sidebar + main).
**Chosen:** Three-column with fixed sidebars.
**Why:** Coaches need three categories of information simultaneously: (1) navigation/context [left], (2) primary operational content [center], (3) ambient awareness/alerts [right]. Forcing these into one or two columns requires scrolling to see all three simultaneously, breaking the 3-second rule. The right rail pattern is proven in pro tools (Linear, Figma, Notion when sidebar is open).

### Decision 2: State-Driven Hero Panel (Not Static Form)
**Alternatives considered:** Keep the current LaunchPage form as the first screen; use tabs to separate idle/active states.
**Chosen:** Single Hero component with distinct state-driven renders.
**Why:** A form as the first thing a coach sees forces them to fill it out before understanding context. A state-driven hero says "here is what is happening right now, and here is what you should do next." This matches how coaches think — they arrive at practice and need situational awareness before taking action. The form still exists but is secondary (behind "Configure" disclosure).

### Decision 3: Persistent Session Status Bar (36px, Always Present When Active)
**Alternatives considered:** Session state only on LaunchPage; toast notification when session starts.
**Chosen:** Sticky bar at top of every screen when session is active or unsaved.
**Why:** Coaches frequently context-switch during practice (checking charts, adjusting roster). Without a persistent status indicator, they can forget a session is running. The bar is minimal (36px) and visually distinct (colored left border, animated dot) without being distracting when things are going well.

### Decision 4: Maximum 3 Visible Alerts
**Alternatives considered:** Show all alerts in a list; show alerts only as a badge count.
**Chosen:** Max 3 alerts visible, remainder in a drawer.
**Why:** More than 3 alerts causes scan fatigue — coaches start ignoring them (the "Boy Who Cried Wolf" effect). Fewer than 3 means critical info might be hidden. Three is the cognitive sweet spot. Alerts are priority-sorted so the top 3 are always the most operationally urgent.

### Decision 5: Smart Start Button with Pre-filled Defaults
**Alternatives considered:** Keep the multi-field form (current LaunchPage); separate "Quick Start" and "Advanced" buttons.
**Chosen:** Single "Start Practice — Today" button with "Configure ▾" disclosure.
**Why:** >90% of the time, a coach runs the same session type (Practice) at roughly the same time with the same roster. Making them fill out a form every time is friction. By defaulting to today's date, current time, last-used type/duration, and full roster, the common case becomes zero-click. The edge case (different date, type, or duration) is still fully supported via the disclosure.

### Decision 6: Attendance Snapshot Tiles (Not a Table)
**Alternatives considered:** Mini table showing player names; just a number badge; color-coded roster grid.
**Chosen:** Three stat tiles (Present / Absent / Late) with tappable expand.
**Why:** During an active session, a coach needs to know "how many are here" not "who specifically is here" — that's one level deeper. The three tiles answer the first question instantly. Tapping any tile opens the full AttendancePage (which answers the second question). This matches the natural mental flow of a coach: "How many? → Who specifically? → Mark them."

### Decision 7: Workflow Checklist (Not Just Navigation)
**Alternatives considered:** Just have nav links to each page; show a "session progress" stepper.
**Chosen:** Editable checklist with pre-defined phases.
**Why:** Coaches have consistent protocols but they vary by coach. A rigid stepper implies one correct order. A checklist allows coaches to work in their preferred sequence while still providing the completion satisfaction and accountability of checking things off. It also externalizes memory (frees cognitive load) — especially valuable during high-stress live sessions.

### Decision 8: Replacing Leaderboard Ticker with Inline Strip
**Alternatives considered:** Keep the ticker; remove the leaderboard from the main view entirely.
**Chosen:** Inline top-5 leaderboard in the right rail (desktop) or a horizontal scroll strip (mobile).
**Why:** The ticker is visually noisy and occupies persistent viewport real estate. Its content (player rankings) is not operationally critical during a session. As a right-rail card, the leaderboard can be seen when relevant (after saving a session) without demanding attention during active practice management.

### Decision 9: Raffle as Modal Theater, Not Page
**Alternatives considered:** Keep as a separate page; show as a card on the dashboard.
**Chosen:** Full-screen modal with dramatic presentation.
**Why:** The raffle wheel is an engagement mechanic — it should feel special and theatrical. A tab buried in the nav reduces its impact. A full-screen modal triggered from the dashboard "Spin the Wheel" button creates an event, a moment. This also means the raffle spin doesn't require leaving the dashboard, so the coach can immediately return to session management after the winner is announced.

### Decision 10: Dark Mode as Default (Not Light)
**Alternatives considered:** Light mode default (current); let system preference decide.
**Chosen:** Dark mode as primary theme, light mode as opt-in.
**Why:** Sports coaching happens outdoors, in gyms, on fields — often in bright sunlight where dark UIs with high-contrast text are more legible. Dark mode also reduces eye strain during early-morning or evening practices. The existing codebase already has dark mode variables defined. By promoting dark to primary, we align the design with actual usage conditions.

### Decision 11: Font Mono for All Timers and Key Numbers
**Alternatives considered:** Use the default Inter font for timers; use tabular numbers variant.
**Chosen:** `JetBrains Mono` (or system monospace fallback) for timers, elapsed time, and statistic hero numbers.
**Why:** Proportional fonts cause layout shift when digits change (e.g., "0:59" → "1:00" causes a width change). Monospace prevents this jitter. More importantly, monospace digits are faster to read in a quick glance because all digits occupy the same width — your eye knows exactly where the tens digit will be.

---

## Appendix A — Current vs. Redesigned Feature Mapping

| Current Feature | Current Location | Redesigned Location |
|---|---|---|
| Start session (form) | LaunchPage (tab 1) | Mission Control Hero → Smart Start |
| Active session warning | LaunchPage (conditional alert) | Persistent SessionStatusBar |
| Attendance check-in | AttendancePage (tab 2) | Attendance Manager (from Hero CTA / nav) |
| Attendance headcount | AttendancePage | AttendanceSnapshot tiles on dashboard |
| Player totals table | SummaryPage (tab 3) | Reports page (full) + LeaderboardStrip (preview) |
| Practice/optional hours stats | SummaryPage | TrainingSummaryCard on dashboard |
| Charts | ChartsPage (tab 4) | Reports → Charts (from Reports page) + sparklines inline |
| Raffle wheel | RafflePage (tab 5) | RewardsCard CTA → RaffleTheaterModal |
| Team settings | SettingsPage (tab 6) | More → Settings |
| Leaderboard ticker | Persistent ticker (all pages) | LeaderboardStrip (right rail, dashboard only) |
| — | No equivalent | AlertSurface (proactive warnings) |
| — | No equivalent | WorkflowChecklist |
| — | No equivalent | UpcomingEventsTimeline |
| — | No equivalent | RecentActivityFeed (coach-facing) |

---

## Appendix B — Implementation Priority

### Phase 1 — Foundation (Ship first)
1. Design tokens migration (CSS variables to new semantic system)
2. SessionStatusBar component (most impactful single addition)
3. MissionControlHero with state machine (idle / active / unsaved)
4. AttendanceSnapshot tiles
5. Global navigation restructure (new nav items, BottomNav on mobile)

### Phase 2 — Operational Layer
6. AlertSurface with alert types + priority sorting
7. WorkflowChecklist with phase gating
8. SmartStartButton (replace LaunchPage form as primary entry point)
9. UpcomingEventsTimeline

### Phase 3 — Intelligence Layer
10. TrainingSummaryCard with sparklines
11. RecentActivityFeed (coach-facing events)
12. LeaderboardStrip (replaces ticker)
13. RewardsCard + RaffleTheaterModal (upgrade current RafflePage)

### Phase 4 — Polish
14. Command palette (Cmd+K)
15. Keyboard shortcuts
16. Transition animations (session state changes)
17. Mobile gesture support (swipe between session states)
18. Light mode variant

---

*End of specification.*
*Next step: Translate Phase 1 tokens and SessionStatusBar into code using the existing Radix UI + Tailwind 4 stack.*
