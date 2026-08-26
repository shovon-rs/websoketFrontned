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

export type IceServer = {
  urls: string;
  username?: string;
  credential?: string;
};

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
