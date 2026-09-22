import type { AppNotification } from "./types";

/** Where clicking a notification (in-app row or an OS-level desktop/push notification) should
 * navigate to. Shared between the notifications page and the global desktop-notification
 * trigger in AppShell so both agree on the same routing rules. */
export function notificationDestination(notification: AppNotification): string | null {
  const data = notification.data;
  if (!data) return null;
  if (typeof data.conversationId === "string") return `/chat/${data.conversationId}`;
  if (typeof data.callId === "string") return `/call/${data.callId}`;
  if (typeof data.documentId === "string") return `/collab/${data.documentId}`;
  if (data.kind === "tracking:shared" || typeof data.sessionId === "string") return "/tracking";
  if (typeof data.announcementId === "string") return `/live/${data.announcementId}`;
  if (data.kind === "livestream-request") return "/live";
  if (typeof data.taskId === "string") return `/tasks/${data.taskId}`;
  return null;
}
