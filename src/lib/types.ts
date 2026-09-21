export type WsEvent<T = unknown> = {
  type: string;
  eventId: string;
  timestamp: string;
  payload: T;
  error?: { code: string; message: string };
};

export type Role = "user" | "manager" | "admin" | "super_admin";

export type User = {
  id: string;
  email: string;
  displayName: string;
  role?: Role;
  createdAt?: string;
  avatarUrl?: string | null;
  mustChangePassword?: boolean;
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

export type ConversationRole = "admin" | "member";

export type ConversationMember = {
  id: string;
  userId: string;
  role: ConversationRole;
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

export type MessageAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

export type Message = {
  id: string;
  eventId: string;
  conversationId: string;
  senderId: string;
  content: string;
  status: MessageStatus;
  createdAt: string;
  attachment?: MessageAttachment | null;
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

export type AdminTrackingSession = TrackingSession & {
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

export type AnnouncementAudience = "everyone" | "invited";
export type AnnouncementStatus = "published" | "scheduled" | "live" | "ended" | "cancelled";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  broadcasterId: string | null;
  audience: AnnouncementAudience;
  invitedUsers?: { id: string; displayName: string; email: string }[];
  scheduledAt: string | null;
  status: AnnouncementStatus;
  createdAt: string;
};

export type LiveStreamRequestStatus = "pending" | "approved" | "rejected";

export type LiveStreamRequest = {
  id: string;
  requesterId: string;
  requester?: { id: string; displayName: string; email: string };
  title: string;
  description: string;
  proposedAt: string | null;
  status: LiveStreamRequestStatus;
  announcementId: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export type IceServer = {
  urls: string;
  username?: string;
  credential?: string;
};

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskPerson = { id: string; displayName: string; email: string };

export type TaskAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

export type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  author: TaskPerson;
};

export type TaskAssignmentAction = "assigned" | "unassigned";

export type TaskAssignmentEvent = {
  id: string;
  action: TaskAssignmentAction;
  createdAt: string;
  user: TaskPerson;
  actor: TaskPerson;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  creatorId: string;
  creator: TaskPerson;
  assignees: TaskPerson[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  assignmentEvents: TaskAssignmentEvent[];
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
  sectionId: string | null;
  dueDate: string | null;
  startDate: string | null;
  priority: TaskPriority;
  order: number;
};

export type ProjectRole = "admin" | "member";

export type ProjectMember = { id: string; displayName: string; email: string; role: ProjectRole };

export type Section = { id: string; projectId: string; name: string; order: number };

export type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  members: ProjectMember[];
  sections: Section[];
  taskCount?: number;
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string;
  color: string;
  memberCount: number;
  sectionCount: number;
  taskCount: number;
  createdAt: string;
};
