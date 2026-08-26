# Relay Frontend — Project Overview

## What this project is

Relay is a responsive frontend prototype for a real-time communication workspace. It brings messaging, notifications, live tracking, collaborative documents, calls, and workspace activity into one consistent interface.

The application was created from the requirements in:

- [`projectoverview.md`](./projectoverview.md) — the full platform vision and backend architecture
- [`frontend.md`](./frontend.md) — the frontend structure, feature behavior, and integration guidance

This repository currently contains the **frontend experience only**. It is designed to demonstrate the product and provide a foundation for backend integration. Data is currently mocked in the browser; real authentication, REST APIs, WebSockets, WebRTC media, push notifications, and map services are not connected yet.

---

## Technology used

| Area | Implementation |
| --- | --- |
| Framework | Next.js 14 using the App Router |
| UI library | React 18 |
| Language | TypeScript 5 in strict mode |
| Icons | Lucide React |
| Styling | Custom responsive CSS |
| Fonts | DM Sans and Manrope from Google Fonts |
| Package manager | npm |

The project is intentionally lightweight. It does not yet include a state-management library, HTTP client, form library, map SDK, test framework, or WebSocket/WebRTC service because those integrations have not been implemented.

---

## What was built

### 1. Project foundation

The original workspace contained only planning documents. The following Next.js foundation was created:

- `package.json` with development, production, type-checking, and lint scripts
- `next.config.mjs` with React strict mode enabled
- `tsconfig.json` with strict TypeScript and the `@/*` source alias
- `next-env.d.ts` for Next.js types
- `.gitignore` for dependencies, builds, local environment files, and npm logs
- `src/app/layout.tsx` with application metadata and global styling
- `src/app/page.tsx`, which redirects the root URL to the dashboard

### 2. Shared application shell

The reusable `AppShell` component provides the authenticated workspace layout:

- Fixed deep-green desktop sidebar
- Relay branding and logo treatment
- Navigation for Overview, Messages, Notifications, Live Tracking, Documents, and Calls
- Unread badges for messages and notifications
- Invite, settings, and current-user controls
- Page title and subtitle area
- Search control with a keyboard-shortcut hint
- Notification shortcut
- Responsive mobile navigation treatment

The active navigation item is derived from the current route.

### 3. Dashboard

The dashboard at `/dashboard` includes:

- Personalized welcome area
- Workspace message summary
- Message, online-team, call, and connection metric cards
- Seven-day message activity chart
- Online teammate avatar group
- Recent workspace activity feed
- Quick links to messages, calls, documents, and tracking

The chart is a reusable inline SVG component, so it does not require an additional charting dependency.

### 4. Messaging

The messaging experience is available at `/chat/[id]`. `/chat` redirects to the sample Design Team conversation.

Implemented UI and behavior:

- Searchable-looking conversation sidebar
- Selected-conversation state based on the route
- Presence dots and unread counters
- Conversation header with search, audio call, video call, and information actions
- Incoming and outgoing message bubbles
- Sender avatars, timestamps, and delivery text
- Typing indicator
- Message composer with attachment, emoji, and send controls
- Sending a local message by clicking Send or pressing Enter
- Shift + Enter support for a new line
- Responsive single-column mobile conversation view

Messages are stored in local React component state for the current page session. They are not persisted and are not transmitted over a WebSocket yet.

### 5. Notifications

The notifications page at `/notifications` provides:

- Read and unread visual states
- Notification type icons
- Descriptive notification text and timestamps
- Individual click-to-mark-read behavior
- “Mark all as read” behavior
- Live unread count derived from local state

Browser push and service-worker integration remain future work.

### 6. Live tracking

The tracking page at `/tracking` includes:

- A custom illustrative map surface built with CSS
- Road, water, route, and location-marker treatments
- Live/paused tracking indicator
- Current participant and privacy status
- Distance and duration metrics
- Stop and resume sharing interaction
- Privacy notice explaining authorized access and 30-day retention

This screen does not yet request browser geolocation or render a real Mapbox, Google Maps, or Leaflet map.

### 7. Collaborative document editor

The document route at `/collab/[docId]` includes:

- Editable document title
- Saved/unsaved status indicator
- Active collaborator avatars
- Formatting toolbar
- Browser-editable document content using `contentEditable`
- Product strategy sample document
- Collaborator comment preview
- Share action in the global page header

Editing currently changes only the local DOM and unsaved indicator. Document operations are not synchronized, versioned, or protected by OT/CRDT conflict resolution.

### 8. Audio/video call interface

The call route at `/call/[callId]` includes:

- Live call status and elapsed-time display
- Four-participant video grid
- Participant labels and visual placeholders
- Local mute toggle
- Local camera toggle
- Screen-sharing control
- Participant control
- Hang-up control
- Responsive call layout

The current tiles are visual placeholders. Camera/microphone capture, signaling, peer connections, remote media, and screen sharing are not connected yet.

### 9. Authentication screens

The following public screens were added:

- `/login`
- `/register`

Both provide:

- Relay-branded split-screen layout
- Responsive mobile form layout
- Native browser form validation
- Email and password fields
- Login/register navigation
- Google sign-in visual placeholder
- Demo form submission that navigates to the dashboard

These screens do not yet call authentication APIs, issue tokens, create sessions, or protect application routes.

### 10. Design system and responsiveness

The visual system is implemented in `src/app/globals.css` and includes:

- Deep green workspace navigation
- Coral primary actions and live accents
- Off-white application background
- White cards with subtle borders
- Reusable color treatments for avatars and icons
- Compact dashboard typography
- Button, form, card, toolbar, message, editor, call, and map styling
- Layout adjustments below 1000 px
- Mobile application changes below 760 px

Shared visual components include:

- `AppShell` — workspace navigation and page header
- `Avatar` — initials, color variants, sizes, and presence indicator
- `Chart` — dashboard message-activity graph

### 11. Mock content

`src/lib/data.ts` contains the reusable sample data for:

- Conversations
- Chat messages
- Notifications

Keeping mock data separate makes it easier to replace with API responses later.

### 12. Project-specific Codex skill

A reusable project skill was created at:

```text
skills/relay-frontend/SKILL.md
```

It documents the frontend’s architectural boundaries, design conventions, realtime event contract, feature expectations, security considerations, and verification commands. It is intended to help future Codex sessions make changes that remain consistent with the project.

---

## Current routes

| Route | Purpose | Rendering |
| --- | --- | --- |
| `/` | Redirects to the dashboard | Static |
| `/dashboard` | Workspace overview and activity | Static |
| `/chat` | Redirects to a sample conversation | Static |
| `/chat/[id]` | Individual conversation | Dynamic |
| `/notifications` | Notification history and read state | Static |
| `/tracking` | Live-tracking interface | Static |
| `/collab/[docId]` | Collaborative document interface | Dynamic |
| `/call/[callId]` | Audio/video call interface | Dynamic |
| `/login` | Sign-in screen | Static |
| `/register` | Account-creation screen | Static |

---

## Project structure

```text
.
├── PROJECT_OVERVIEW.md
├── frontend.md
├── projectoverview.md
├── package.json
├── next.config.mjs
├── tsconfig.json
├── skills/
│   └── relay-frontend/
│       └── SKILL.md
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   ├── call/[callId]/page.tsx
    │   ├── chat/
    │   │   ├── [id]/page.tsx
    │   │   └── page.tsx
    │   ├── collab/[docId]/page.tsx
    │   ├── dashboard/page.tsx
    │   ├── notifications/page.tsx
    │   ├── tracking/page.tsx
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── AppShell.tsx
    │   ├── Avatar.tsx
    │   └── Chart.tsx
    └── lib/
        └── data.ts
```

Generated folders such as `node_modules` and `.next` are intentionally omitted.

---

## How to run the project

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Create and run an optimized production build:

```bash
npm run build
npm start
```

Run the TypeScript check without emitting files:

```bash
npm run typecheck
```

---

## Verification already completed

The initial implementation was verified with:

```bash
npm run typecheck
npm run build
```

Results:

- TypeScript strict-mode check passed with no errors.
- The optimized Next.js production compilation completed successfully.
- Next.js generated all 10 application routes.
- Shared first-load JavaScript was approximately 87.3 kB at the time of the verified build.

The first production-build attempt was blocked by a Windows sandbox worker-process permission (`spawn EPERM`). The identical build was rerun with permission to spawn the Next.js compiler worker and completed successfully. This was an environment restriction, not an application source error.

During dependency installation, npm reported two high-severity audit findings in the resolved dependency tree. No forced audit fix was applied because `npm audit fix --force` can introduce breaking dependency upgrades. Dependencies should be reviewed and upgraded deliberately before production deployment.

The project-specific skill was structurally checked for valid frontmatter, matching name, and unfinished placeholders. The official skill validation script could not run because Python and the Windows `py` launcher were not installed in the environment.

---

## Important current limitations

This project is a working UI prototype, not yet a production-connected realtime client.

The following remain to be implemented:

- REST API client and environment-based API URL
- Access-token memory store and HttpOnly refresh-cookie flow
- Route protection and silent session refresh
- Native WebSocket singleton and typed event bus
- Connection-status banner, heartbeat, reconnect backoff, and explicit disconnect
- Event acknowledgement, deduplication, retry, and missed-message catch-up
- Persistent conversation and notification state
- Zustand or another global-state solution if cross-page state requires it
- Toast system and browser push/service worker registration
- Real map provider and browser geolocation
- WebRTC peer connection, signaling, media capture, TURN credential retrieval, and screen sharing
- Collaborative operation synchronization and later OT/CRDT conflict handling
- Form schemas and server error handling
- Unit, component, integration, accessibility, and end-to-end tests
- Loading, empty, offline, permission-denied, and error states for backend-driven features
- Production security headers and deployment configuration

The mock behaviors should therefore not be treated as proof of authentication security, message delivery guarantees, realtime synchronization, privacy enforcement, or media connectivity.

---

## Recommended next steps

1. Define shared TypeScript models for REST responses and the WebSocket event envelope.
2. Add environment variables for the API, WebSocket, VAPID, map, and public STUN configuration.
3. Implement authentication refresh and protected application routes.
4. Create the singleton WebSocket service and in-process event bus.
5. Replace chat mock data first, including optimistic send, acknowledgement, deduplication, and reconnect catch-up.
6. Connect notifications and add the persistent connection-status experience.
7. Integrate the dashboard snapshot and incremental metric events.
8. Add a real map and consent-driven geolocation tracking.
9. Implement one-to-one WebRTC calling and signaling.
10. Add automated tests for each connected feature before production deployment.

This order follows the platform plan: establish authentication and reliable realtime infrastructure before layering on the more sensitive tracking, calling, and collaboration features.
