---
name: relay-frontend
description: Build, extend, or review the Relay real-time communication frontend in this repository. Use for work on its Next.js pages, components, responsive UI, chat, notifications, tracking, collaboration, calling, authentication, or realtime client integration.
---

# Relay Frontend

Work on the Relay frontend as a cohesive real-time workspace rather than a collection of unrelated screens.

## Establish Context

Before making architectural or feature changes:

1. Read `projectoverview.md` for the platform contract, security model, reliability requirements, and feature scope.
2. Read the relevant sections of `frontend.md` for frontend behavior and integration guidance.
3. Inspect the current implementation before editing. Treat the source code as authoritative when it intentionally differs from an illustrative snippet in the guides.

For a narrow visual or copy change, inspect the affected source and consult the guides only when the change depends on product behavior.

## Project Conventions

- Use the Next.js App Router and TypeScript strict mode.
- Keep routes in `src/app`, reusable UI in `src/components`, and shared data or utilities in `src/lib`.
- Reuse `AppShell`, `Avatar`, the CSS design tokens, and existing component patterns before creating parallel abstractions.
- Preserve the visual language: deep green navigation, warm coral actions, neutral off-white surfaces, compact typography, subtle borders, and rounded cards.
- Maintain responsive behavior at the existing breakpoints. Check desktop and mobile layouts when changing structure or navigation.
- Use semantic elements, accessible labels, keyboard-operable controls, visible focus behavior, and ARIA live regions for incoming realtime updates where appropriate.
- Keep browser-dependent code in Client Components. Do not access `window`, storage, media, notification, geolocation, or WebSocket APIs during server rendering.
- Prefer typed domain models over untyped objects. Do not introduce `any` when a stable event or API shape can be described.

## Realtime Integration

When connecting the UI to the backend, preserve the standard event envelope:

```ts
type WsEvent<T = unknown> = {
  type: string;
  eventId: string;
  timestamp: string;
  payload: T;
  error?: { code: string; message: string };
};
```

- Keep a single WebSocket service with event routing, heartbeat handling, exponential-backoff reconnects capped at 30 seconds, and explicit disconnect behavior.
- Deduplicate events by `eventId`, acknowledge delivered messages, and perform REST catch-up after reconnect using each conversation's last seen event ID.
- Add optimistic chat messages with sending, delivered, and failed states; reconcile them using event IDs.
- Keep access tokens in memory. Use an HttpOnly refresh cookie and retry a failed request only once after refresh.
- Show persistent connection state whenever live updates are reconnecting or unavailable.
- Request explicit consent before location tracking and provide an immediate stop action.
- Fetch TURN credentials from the backend at call setup; never place TURN secrets in public environment variables.
- Treat push notifications as offline fallback, not a replacement for the open WebSocket connection.

Mock data is acceptable for a UI-only task. Keep it easy to replace and do not imply that mocked realtime behavior provides delivery guarantees.

## Feature Boundaries

- Chat: conversations, optimistic messages, typing, presence, receipts, acknowledgements, and reconnect catch-up.
- Notifications: in-app toasts, history, read state, and browser push registration.
- Dashboard: fetch the initial REST snapshot, then apply incremental realtime updates.
- Tracking: authorized sessions, consent, active indicators, throttled map updates, and privacy controls.
- Collaboration: broadcast simple document operations initially; do not claim conflict safety without OT or CRDT integration.
- Calls: use WebSocket only for signaling and WebRTC for media. Keep mute, camera, screen sharing, and hang-up controls accessible.

Do not add backend, database, Redis, deployment, or infrastructure implementation unless the user explicitly expands the task beyond this frontend repository.

## Verification

After meaningful code changes, run:

```bash
npm run typecheck
npm run build
```

Also exercise the affected interaction in the browser when runtime behavior, browser permissions, responsive layout, WebSocket, WebRTC, or geolocation is involved. Report any check that could not run and the concrete reason.
