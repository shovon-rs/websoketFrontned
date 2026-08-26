# Real-Time Communication Platform — Frontend Guide

**Stack:** Next.js App Router (React 18) · TypeScript · WebSocket · WebRTC  
**Related:** [project-overview.md](./project-overview.md) · [backend.md](./backend.md)

---

## 1. Technology Choices

| Area | Technology | Reason |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | Server/client component split, file-based routing, production-ready |
| UI Foundation | React 18 | Component model, hooks, concurrent features |
| Language | TypeScript | Type safety across the full stack |
| State Management | Zustand / Redux Toolkit | Lightweight global state for auth, notifications, calls |
| WebSocket Client | Native WebSocket + custom service | Full control over reconnection and event routing |
| WebRTC | Browser RTCPeerConnection API | Peer-to-peer audio/video media |
| Maps | Mapbox GL JS / Leaflet + OpenStreetMap | Live tracking visualization |
| Styling | Tailwind CSS | Utility-first, consistent design system |
| Forms | React Hook Form + Zod | Validation mirroring the backend contract |
| HTTP Client | Axios / fetch with interceptors | REST API calls with token refresh |
| Push Notifications | Web Push API / Firebase SDK | Offline notification delivery |
| Testing | Vitest + React Testing Library | Unit and integration tests |
| E2E | Playwright | End-to-end flows |

---

## 2. Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── dashboard/page.tsx
│   ├── chat/
│   │   ├── page.tsx              # Conversation list
│   │   └── [id]/page.tsx         # Individual conversation
│   ├── notifications/page.tsx
│   ├── tracking/page.tsx
│   ├── collab/
│   │   └── [docId]/page.tsx
│   └── call/
│       └── [callId]/page.tsx
│
├── components/
│   ├── ui/                       # Generic design-system components
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Toast.tsx
│   │   └── ConnectionStatus.tsx
│   ├── chat/
│   │   ├── ConversationList.tsx
│   │   ├── MessageThread.tsx
│   │   ├── MessageInput.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── ReadReceipt.tsx
│   ├── notifications/
│   │   ├── NotificationBell.tsx
│   │   └── NotificationPanel.tsx
│   ├── dashboard/
│   │   ├── MetricCard.tsx
│   │   ├── ActivityFeed.tsx
│   │   └── LiveChart.tsx
│   ├── tracking/
│   │   ├── TrackingMap.tsx
│   │   └── TrackingControls.tsx
│   ├── collab/
│   │   ├── CollabEditor.tsx
│   │   └── CursorOverlay.tsx
│   └── calling/
│       ├── IncomingCall.tsx
│       ├── AudioCall.tsx
│       ├── VideoCall.tsx
│       ├── CallControls.tsx
│       └── ParticipantVideo.tsx
│
├── services/
│   ├── api/
│   │   ├── auth.api.ts
│   │   ├── chat.api.ts
│   │   ├── notifications.api.ts
│   │   ├── tracking.api.ts
│   │   └── calls.api.ts
│   ├── websocket/
│   │   ├── websocket.service.ts   # Core WS client with reconnection
│   │   └── event.bus.ts           # In-process event bus for components
│   ├── webrtc/
│   │   ├── webrtc.service.ts      # RTCPeerConnection management
│   │   └── call-state.ts          # Call FSM (idle → ringing → active → ended)
│   └── push/
│       └── push.service.ts        # Web Push registration
│
├── hooks/
│   ├── useWebSocket.ts
│   ├── useAuth.ts
│   ├── useMessages.ts
│   ├── usePresence.ts
│   ├── useNotifications.ts
│   ├── useTracking.ts
│   ├── useWebRTC.ts
│   └── useCallState.ts
│
├── store/
│   ├── auth.store.ts
│   ├── notification.store.ts
│   └── call.store.ts
│
├── types/
│   ├── events.ts                  # Mirrors backend WebSocket event contract
│   ├── api.ts
│   └── webrtc.ts
│
└── lib/
    ├── api-client.ts              # Axios instance with refresh interceptor
    └── constants.ts
```

---

## 3. WebSocket Service

The WebSocket service is a singleton that manages the connection lifecycle for the entire app.

```typescript
// services/websocket/websocket.service.ts
export class WebSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectDelay = 30_000; // ms

	connect(token: string): void {
		this.ws = new WebSocket(`wss://api.example.com/ws?token=${token}`);
		this.ws.onopen = () => {
			this.reconnectAttempts = 0;
		};
		this.ws.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
		this.ws.onclose = () => this.scheduleReconnect();
	}

	private scheduleReconnect(): void {
		const delay = Math.min(
			1000 * 2 ** this.reconnectAttempts,
			this.maxReconnectDelay,
		);
		this.reconnectAttempts++;
		setTimeout(() => this.connect(getStoredToken()), delay);
	}

	private handleMessage(event: WsEvent): void {
		eventBus.emit(event.type, event);
	}

	send(type: string, payload: unknown): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(
				JSON.stringify({
					type,
					eventId: uuid(),
					timestamp: new Date().toISOString(),
					payload,
				}),
			);
		}
	}

	disconnect(): void {
		this.reconnectAttempts = Infinity; // prevent auto-reconnect
		this.ws?.close();
	}
}
```

**Key behaviours:**

- Exponential backoff reconnection (1 s → 2 s → 4 s … capped at 30 s)
- Token passed in query string on upgrade (use a short-lived WS token from the REST API for better security)
- On reconnect, trigger REST catch-up for missed messages (see §4)

---

## 4. Offline Catch-Up on Reconnect

When the WebSocket reconnects after a gap, the client must fetch messages it missed:

```typescript
// hooks/useMessages.ts
async function onWebSocketReconnect(conversationId: string) {
	const lastSeenId = getLastSeenEventId(conversationId); // from localStorage
	if (!lastSeenId) return;

	const missed = await chatApi.getMessages(conversationId, {
		after: lastSeenId,
	});
	appendMessages(missed); // add to local state without duplicates
}
```

This pairs with the backend's `GET /api/conversations/:id/messages?after=<eventId>` endpoint.

---

## 5. Authentication Flow

- On login, store `accessToken` in memory (React state / Zustand) and `refreshToken` in an `HttpOnly` cookie.
- Axios interceptor catches `401` responses, calls `POST /api/auth/refresh`, and retries the original request.
- On page load, attempt a silent token refresh before rendering protected routes.
- Connect the WebSocket service after a valid access token is available.
- On logout, disconnect the WebSocket, clear tokens, and unregister the push subscription.

```typescript
// lib/api-client.ts (interceptor sketch)
axiosInstance.interceptors.response.use(
	(res) => res,
	async (error) => {
		if (error.response?.status === 401 && !error.config._retry) {
			error.config._retry = true;
			const { accessToken } = await authApi.refresh();
			setAccessToken(accessToken);
			error.config.headers["Authorization"] = `Bearer ${accessToken}`;
			return axiosInstance(error.config);
		}
		return Promise.reject(error);
	},
);
```

---

## 6. Connection Status UI

Show a persistent banner or icon indicating the WebSocket connection state. Users should never be left guessing whether they are receiving live updates.

```typescript
// components/ui/ConnectionStatus.tsx
export function ConnectionStatus() {
  const status = useWebSocketStatus(); // 'connected' | 'reconnecting' | 'disconnected'
  if (status === 'connected') return null;
  return (
    <div className={`banner banner--${status}`}>
      {status === 'reconnecting' ? 'Reconnecting…' : 'Connection lost. Some features may be unavailable.'}
    </div>
  );
}
```

---

## 7. Notification System

### In-App Toasts

Use a global toast manager triggered by WebSocket `notification:new` events:

```typescript
eventBus.on("notification:new", (event) => {
	toastManager.show({
		message: event.payload.message,
		severity: event.payload.severity,
	});
	notificationStore.add(event.payload);
});
```

### Offline / Push Notifications

Register a Web Push subscription when the user grants permission. Send the subscription object to `POST /api/push/register`. The backend will use it to deliver `notification:new` and `call:ringing` events when the WebSocket is not open.

```typescript
// services/push/push.service.ts
async function registerPush(userId: string): Promise<void> {
	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.subscribe({
		userVisibleOnly: true,
		applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
	});
	await pushApi.register(subscription);
}
```

A `service-worker.ts` file handles the `push` event and calls `self.registration.showNotification(...)`.

---

## 8. Chat Module

### Message Thread with Optimistic UI

1. User submits a message.
2. Add it to local state immediately with `status: 'sending'`.
3. Send `message:send` over WebSocket.
4. On receiving `message:new` with a matching `eventId`, mark it `status: 'delivered'`.
5. On timeout or error event, mark it `status: 'failed'` and offer a retry.

### Read Receipts

Send `message:read` when the message scrolls into view (use `IntersectionObserver`).

### Typing Indicators

Debounce `typing:start` — send at most once every 2 s while the user is typing. Send `typing:stop` on blur or after a 3 s idle period.

---

## 9. Live Dashboard

Dashboard components subscribe to WebSocket events and update React state:

```typescript
function useDashboardMetrics() {
	const [metrics, setMetrics] = useState<Metrics>(initialSnapshot);

	useEffect(() => {
		const unsub = eventBus.on("dashboard:metrics", (e) =>
			setMetrics(e.payload),
		);
		return unsub;
	}, []);

	return metrics;
}
```

Fetch the initial snapshot via `GET /api/dashboard/summary` on mount, then apply incremental WebSocket updates. This avoids a blank screen on first load.

---

## 10. Live Tracking Map

```typescript
// components/tracking/TrackingMap.tsx
function TrackingMap({ sessionId }: { sessionId: string }) {
  const mapRef = useRef<mapboxgl.Map>(null);

  useEffect(() => {
    const unsub = eventBus.on('location:update', (e) => {
      if (e.payload.sessionId !== sessionId) return;
      mapRef.current?.easeTo({ center: [e.payload.lng, e.payload.lat] });
    });
    return unsub;
  }, [sessionId]);

  return <div id="map" className="w-full h-full" />;
}
```

Request consent before calling `tracking:start`. Display a clear "tracking active" indicator and provide a one-tap stop button.

---

## 11. Collaborative Editor

For Phase 1, broadcast raw operations:

```typescript
editor.on("change", (delta) => {
	wsService.send("document:update", { docId, delta });
});

eventBus.on("document:update", (e) => {
	if (e.payload.senderId !== currentUserId) {
		editor.applyDelta(e.payload.delta);
	}
});
```

For conflict resolution, evaluate OT (Yjs) or CRDT (Automerge) in a later phase. Both have WebSocket provider adapters that plug into the existing connection.

---

## 12. Audio & Video Calling

### Call Flow

```
Caller                             Signaling Server                     Callee
  |── call:initiate ─────────────────────────────────────────────────────> |
  |                                                                   call:ringing
  |                                                         (push if offline)
  |                              <── call:accept ────────────────────────── |
  |── call:sdp-offer ────────────────────────────────────────────────────> |
  |                              <── call:sdp-answer ─────────────────────── |
  |─ call:ice-candidate ────────────────────────────────────────────────> |
  |                              <── call:ice-candidate ───────────────────── |
  |════════════ WebRTC Media (audio/video) ═════════════════════════════ |
```

### useWebRTC Hook (Outline)

```typescript
export function useWebRTC(callId: string) {
	const [pc, setPc] = useState<RTCPeerConnection | null>(null);
	const [localStream, setLocalStream] = useState<MediaStream | null>(null);
	const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

	async function startCall(withVideo: boolean) {
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: true,
			video: withVideo,
		});
		setLocalStream(stream);
		const peerConn = new RTCPeerConnection({ iceServers: getIceServers() }); // from env/config
		stream.getTracks().forEach((t) => peerConn.addTrack(t, stream));
		peerConn.ontrack = (e) => setRemoteStream(e.streams[0]);
		peerConn.onicecandidate = (e) => {
			if (e.candidate)
				wsService.send("call:ice-candidate", {
					callId,
					candidate: e.candidate,
				});
		};
		const offer = await peerConn.createOffer();
		await peerConn.setLocalDescription(offer);
		wsService.send("call:sdp-offer", { callId, sdp: offer });
		setPc(peerConn);
	}

	// ... accept, ice, hangup handlers
	return { startCall, localStream, remoteStream };
}
```

### Call Controls Component

Provide mute (audio), camera on/off, screen share, and hang-up buttons. Show remote participant video in a full-size tile and local video in a picture-in-picture overlay.

---

## 13. Performance Considerations

| Concern | Approach |
| --- | --- |
| Re-renders from WebSocket events | Update only the relevant slice of state; use `useMemo` / `useCallback` |
| Large message lists | Virtualise with `react-virtual` or `@tanstack/react-virtual` |
| Map location updates | Throttle incoming `location:update` events to max 1 per second in the UI |
| Bundle size | Code-split heavy modules (MapboxGL, collaboration editor) with `next/dynamic` |
| Image/video thumbnails | Lazy load; use pre-signed S3 URLs with short TTL |

---

## 14. Accessibility

- Announce new messages and notifications via ARIA live regions (`aria-live="polite"`)
- Ensure call controls are keyboard-accessible and have visible focus states
- Provide captions or transcripts for recorded calls (future)
- Test with a screen reader (NVDA / VoiceOver) before each release

---

## 15. Environment Variables

```env
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=wss://api.example.com/ws
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<web-push-public-key>
NEXT_PUBLIC_MAPBOX_TOKEN=<mapbox-token>
NEXT_PUBLIC_STUN_URL=stun:stun.l.google.com:19302
```

Do **not** expose TURN credentials as `NEXT_PUBLIC_*`. Fetch them from the API at call setup time.

---

## 16. Testing

| Layer | Tool | What to test |
| --- | --- | --- |
| Unit | Vitest + RTL | Hooks (useMessages, useWebRTC), utility functions |
| Component | RTL | Chat thread renders, call controls toggle state |
| Integration | MSW (Mock Service Worker) | REST API flows, WebSocket event handling |
| E2E | Playwright | Login → send message → receive message, initiate call |
| Accessibility | axe-playwright | Automated a11y scan on key pages |

---

## 17. Key Dependencies

```json
{
	"next": "^14",
	"react": "^18",
	"typescript": "^5",
	"zustand": "^4",
	"axios": "^1",
	"react-hook-form": "^7",
	"zod": "^3",
	"mapbox-gl": "^3",
	"@tanstack/react-virtual": "^3",
	"firebase": "^10",
	"vitest": "^1",
	"@testing-library/react": "^14",
	"playwright": "^1"
}
```
