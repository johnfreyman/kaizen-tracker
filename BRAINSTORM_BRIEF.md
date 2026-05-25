# Kaizen Tracker — Product Brainstorming Brief

Use this document to get an AI chatbot up to speed quickly. After reading it, ask the AI to brainstorm on the specific topic areas listed at the bottom.

---

## What is this?

**Kaizen Tracker** is a web app built for a sports coach (basketball) to track player attendance across practices and optional training sessions. It's used under the **Kaizen Warriors** brand, which has multiple sub-teams (e.g., Blue team, Gray team) that all fall under the same organization.

The app is currently a **single-coach, single-team** product. One coach logs in, manages one roster, and runs sessions. The goal is to make attendance effortless and to gamify participation so players actually show up to optional training.

---

## Current Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Radix UI components
- **Backend:** Supabase (PostgreSQL, auth, storage)
- **Charts:** Recharts
- **Auth:** Email/password, magic link (OTP), password reset — all via Supabase
- **Deployment:** Web app (no native mobile app yet)
- **Theme:** Full light/dark mode with a custom CSS variable theme system

---

## What it currently does (feature inventory)

### Core Session Flow
1. **Coach launches a session** — picks event type (Practice or Optional Training), sets date/time and duration
2. **Takes attendance** — marks players present from the roster; shows a live count
3. **Saves the session** — atomically commits to Supabase; session data includes: date, type, duration, and array of attending player names

### Dashboard (Mission Control)
- "Ready for today's session?" hero card with Quick Start button
- Leaderboard Podium — top 3 players ranked by **total season hours** (Practice + Optional Training combined), with medal styling (gold/silver/bronze). Ranks 4–10 shown in a horizontal strip.
- Inbox card — actionable tasks (e.g., "Confirm roster is up to date")
- Stat tiles — total events, practice hours, optional hours
- Collapsible recent activity feed

### Reports Page
- KPI strip: total events, practice hours, optional hours, avg attendance %, guest appearances
- Insight cards: top attendee, longest streak, player who "needs follow-up"
- Charts: attendance trend over time (area chart), practice by day of week (bar chart)
- Sortable player table with attendance %, practice hours, optional hours, current streak
- Expandable session log (last 10 sessions)
- CSV export

### Prize Wheel (Raffle)
- Opt-in feature (toggleable in Settings)
- Players earn wheel entries by attending Optional Training
- Coach spins the wheel; winner displayed with celebration animation
- Recent winners tracked in localStorage; coach can exclude last N winners
- Canvas-based spinning wheel with confetti

### Settings
- Team name and logo upload (resized to 512px, stored in Supabase storage)
- Roster management — add/remove players; players flagged as either "Roster" or "Guest"
- Appearance (light/dark/system theme toggle)
- Enable/disable Prize Wheel
- **Season archiving** — archive all current events to start a fresh season; restore archives with conflict resolution (overwrite, skip, or abort)

### Other
- PDF export drawer (coach can export a formatted report)
- Super Admin dashboard (separate access level for admin oversight)
- Guest players — tracked separately from roster, appear on wheel and leaderboard
- Light/dark mode — full theme support throughout

---

## Data Model (simplified)

```
Event {
  id: UUID
  date: ISO date string
  type: "Practice" | "Optional Training"
  duration: number (hours, e.g. 1.5)
  players: string[]   // names of who attended
  savedAt: ISO timestamp
}

Player {
  name: string
  is_guest: boolean
  coach_id: UUID      // ties player to team owner
}

TeamSettings {
  teamName: string
  teamLogo: string | null   // Supabase storage URL
  raffleEnabled: boolean
}

ArchivedEventSet {
  id: UUID
  archivedAt: ISO timestamp
  events: Event[]
}
```

Season Total = sum of all event durations for a player across all unarchived events.

---

## What does NOT exist yet

- No parent/guardian access of any kind
- No sub-team or group splitting within a roster
- No self-check-in / kiosk mode
- No mobile app (iOS or Android)
- No multi-team support (one coach = one team)
- No push notifications or scheduling
- No player accounts or player-facing views
- No payment / subscription system
- No sharing or social features
- No integration with external calendars (Google Calendar, etc.)

---

## Context & Constraints

- The coach (user) is likely on a tablet or laptop at the gym
- Sessions happen in real-time — speed of attendance-taking matters
- The Kaizen Warriors brand has multiple sub-teams under one umbrella organization
- Player names are stored as plain strings (no player accounts/logins)
- The app currently assumes one authenticated coach manages everything

---

## Brainstorming Topics — Please explore all of these

Work through each topic below. For each one, give concrete feature proposals, flag tradeoffs, and note anything the product owner might be overlooking.

### 1. Parent / Guardian Invite Link
Should a coach be able to send a shareable link to a parent who is physically at practice so they can take attendance on their own phone — with limited access (no settings, no data, no raffle)? How would this work technically and UX-wise? What are the risks?

### 2. Sub-Team / Group Splitting
The coach runs multiple teams under the Kaizen Warriors brand (e.g., Blue team, Gray team). Should the app support grouping players within one account, or separate team accounts, or something else? How should the leaderboard, reports, and raffle interact with groups?

### 3. Kiosk Mode
A tablet placed at the gym door where players tap their own name to mark themselves present — no access to settings, reports, or anything else. How should it work? How do you prevent abuse (players checking in friends)? Should it require a PIN to exit? Time-lock after session ends?

### 4. Other Feature Ideas
What features would make the biggest impact for a coach running a youth/club sports program? Think about: scheduling, reminders, parent communication, player progress sharing, streak notifications, seasonal awards, practice plan tracking, equipment check-out, player notes/injury flags, etc.

### 5. Monetization
The app is currently free. What are viable monetization models for a sports coaching tool? Consider: freemium (what's free vs paid?), per-team pricing, per-coach pricing, org/club licensing, one-time purchase, sponsored prizes for the raffle wheel, white-labeling for clubs/associations, etc. What price points make sense for this audience?

### 6. Go-to-Market Strategy
Who is the buyer — individual coach, club director, school athletic director? What's the acquisition channel — social media, coach forums, word of mouth, partnerships with leagues? What would a launch look like? What's the beachhead market?

### 7. iOS App
What would a native iPhone app unlock that the web app can't do? Push notifications, home screen widget showing today's session, Face ID to unlock kiosk mode, offline support, camera for scanning QR codes on player cards? What's the build path — React Native, Swift, PWA?

### 8. Android App
Same questions as iOS. Is there a meaningful difference in audience (budget coaching programs may skew Android)?

### 9. What am I overlooking?
What important product, business, legal, or technical considerations has the product owner not thought to ask about yet? Think about: data privacy (storing minors' names and attendance), COPPA/FERPA implications, data portability, competitor landscape, coach burnout/adoption risk, onboarding friction, etc.
