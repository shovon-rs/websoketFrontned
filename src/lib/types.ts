export type WsEvent<T = unknown> = {
  type: string;
  eventId: string;
  timestamp: string;
  payload: T;
  error?: { code: string; message: string };
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  role?: string;
  createdAt?: string;
  avatarUrl?: string | null;
};

export type PresenceUser = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  online: boolean;
  onlineSince: string | null;
  lastSeenAt: string | null;
};

export type ConversationMember = {
  id: string;
  userId: string;
  user: { id: string; displayName: string; email: string };
};

export type Conversation = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  createdAt: string;
  members: ConversationMember[];
  messages?: Message[];
};

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type Message = {
  id: string;
  eventId: string;
  conversationId: string;
  senderId: string;
  content: string;
  status: MessageStatus;
  createdAt: string;
};

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export type AppNotification = {
  id: string;
  type: NotificationSeverity;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type DashboardMetrics = {
  activeConnections: number;
  onlineUsers: number;
  generatedAt: string;
};

export type TrackingSession = {
  id: string;
  userId: string;
  consentAt: string;
  startedAt: string;
  endedAt: string | null;
};

export type TrackingLocation = {
  sessionId: string;
  lat: number;
  lng: number;
  recordedAt: string;
};

export type OwnedTrackingSession = TrackingSession & {
  viewers: { userId: string; user: User }[];
  locations: TrackingLocation[];
};

export type SharedTrackingSession = TrackingSession & {
  user: User;
  locations: TrackingLocation[];
};

export type DocumentRecord = {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  updatedAt: string;
};

export type CallType = "audio" | "video";
export type CallStatus = "ringing" | "active" | "ended" | "missed" | "rejected";

export type CallParticipant = {
  userId: string;
  role: "caller" | "callee";
};

export type Call = {
  id: string;
  type: CallType;
  status: CallStatus;
  initiatorId: string;
  participants: CallParticipant[];
};

export type CallHistoryParticipant = {
  userId: string;
  role: "caller" | "callee";
  joinedAt: string | null;
  leftAt: string | null;
  user: User;
};

export type CallHistoryEntry = {
  id: string;
  type: CallType;
  status: CallStatus;
  initiatorId: string;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  participants: CallHistoryParticipant[];
};

export type IceServer = {
  urls: string;
  username?: string;
  credential?: string;
};

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
