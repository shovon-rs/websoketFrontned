import { apiRequest } from "../api-client";
import type { AppNotification } from "../types";

export async function listNotifications() {
  const data = await apiRequest<{ notifications: AppNotification[] }>("/notifications");
  return data.notifications;
}
