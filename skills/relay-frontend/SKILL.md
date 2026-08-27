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

## Integration Layer (already built — reuse it)

The app is wired to a real backend (see `../websoketBackend`, its `realtime-backend`
skill documents the server side). Don't create parallel API/WS clients — these exist:

- `src/lib/config.ts` — `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- `src/lib/api-client.ts` — low-level `apiRequest()`: in-memory access token, `credentials: "include"`
  for the HttpOnly refresh cookie, auto-refresh-and-retry once on a 401. `src/lib/api/*.api.ts`
  has one thin resource module per backend module (`auth`, `chat`, `notifications`, `dashboard`,
  `tracking`, `calls`, `documents`, `users`, `push`) — add new endpoints there, not inline in pages.
- `src/lib/auth-context.tsx` — `useAuth()`: `status` (`loading`/`authenticated`/`unauthenticated`),
  `user`, `login`/`register`/`logout`. Does a silent refresh on first load to restore the session
  from the cookie. `AppShell` already redirects to `/login` when unauthenticated — protected pages
  get this for free by rendering inside `AppShell`.
- `src/lib/ws-client.ts` + `src/lib/ws-context.tsx` — `useWs()`: `{ status, send, subscribe }`.
  One socket for the whole app, exponential-backoff reconnect (capped 30s), eventId dedup built in.
  **Room membership lives on the connection, not the client** — any page that joins a WS room
  (`chat:join`, `dashboard:join`, `tracking:join`, `document:join`) must re-send that join whenever
  `status` transitions to `"connected"`, not just once on mount, or it silently stops receiving
  broadcasts after a reconnect. See `chat/[id]/page.tsx` or `dashboard/page.tsx` for the pattern.
- `src/lib/use-webrtc.ts` — `useWebRTCCall({ callId, isCaller, callType })` owns the
  `RTCPeerConnection`, local/remote `MediaStream`, mute/camera/screen-share, and the full
  offer/answer/ICE signaling exchange (including buffering ICE candidates that arrive before
  the remote description is set). `components/IncomingCallBanner.tsx` (mounted globally in
  `Providers.tsx`) is what surfaces `call:ringing` while the user is anywhere else in the app —
  don't add a second listener for it.
- `src/lib/push.ts` — Web Push subscribe/unsubscribe against `public/sw.js`.
- File uploads (e.g. avatar) go through `apiRequest`'s `formData` option (a `FormData`
  instead of `body` — it's sent as-is with no `Content-Type` set so the browser adds the
  multipart boundary itself; see `users.api.ts`'s `uploadAvatar`). The response is a
  presigned, time-limited URL — don't cache it beyond the current session/reload, always use
  whatever the API just returned (or a fresh `GET /auth/me`).
- `src/components/TrackingMap.tsx` — real Leaflet + OpenStreetMap map (no API key needed).
  Imperative wrapper (`import("leaflet")` inside `useEffect`, never a static top-level import —
  Leaflet touches `window` at load time and breaks SSR otherwise). Takes a flat `markers` array
  and diffs add/update/remove itself; don't reach into the Leaflet instance from outside it.
- `src/components/UserSearchDropdown.tsx` — debounced user search combobox (name/email, keyboard
  nav, click-outside-to-close). This is the reusable building block for "pick a teammate" flows —
  used by chat's new-conversation flow, the call picker, and tracking's share-with flow. Reach for
  this instead of a raw email `<input>` any time a feature needs to target another user.
- `src/lib/time.ts` — `formatOnlineDuration`/`formatLastSeen`, the Messenger-style "Online for
  12m" / "Active 3h ago" strings. Backed by real data: `GET /api/users/presence`
  (`users.api.ts`'s `getPresence()`) returns every other user with `online`, `onlineSince`
  (set once per session, not reset on heartbeat — trust it), and `lastSeenAt` (only populated
  once someone's *last* socket disconnects). The `/people` page is the reference consumer —
  online first (most-recent first), then offline (most-recently-seen first); the backend
  already sorts it that way, don't re-sort client-side.
- Dashboard metrics that look like they need a WS event usually don't — `GET /dashboard/summary`
  (`conversationCount`, `activeConnections`) and `GET /dashboard/message-activity` (real daily
  message counts, last 7 days, scoped to the caller's own conversations) are plain REST polls on
  mount; only `activeConnections`'s live tick comes over WS (`dashboard:metrics`, already wired).
  Don't invent a new WS event for a number that's fine fetched once per page load.

Live tracking is a real multi-user feature, not a solo demo: a session owner can share their
live location with specific teammates (`tracking.api.ts`'s `addViewer`/`removeViewer`, picked via
`UserSearchDropdown`), and viewers see it appear automatically — sharing fires a persisted
notification with `data.kind === "tracking:shared"`, and the tracking page listens for exactly
that marker to know when to refetch `GET /tracking/sessions` and auto-`tracking:join` the new
session. `GET /tracking/sessions` returns `{ owned, shared }`; both need the same reconnect-rejoin
treatment as chat rooms (see above) — the tracking page rejoins every session in both lists,
not just its own, whenever `useWs().status` becomes `"connected"`.

Backend contract notes that don't match `backend.md`'s illustrative snippets:
refresh tokens are an HttpOnly cookie (not a JSON field — see the backend skill's
"cookie-based refresh tokens" section), and starting a call must go through the WS
`call:initiate` event, not `POST /api/calls` (that REST endpoint creates a call row but
does not notify the callee — only the WS path does).

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
- Tracking: authorized sessions, consent, active indicators, throttled map updates, privacy controls, and explicit per-user sharing (see `TrackingMap`/`UserSearchDropdown` above) on a real map — not a static placeholder.
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
