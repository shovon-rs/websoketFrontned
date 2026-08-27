import { apiRequest } from "../api-client";

export async function getSummary() {
  return apiRequest<{ activeConnections: number; conversationCount: number; callsThisWeek: number; generatedAt: string }>("/dashboard/summary");
}

export async function getMessageActivity() {
  const data = await apiRequest<{ days: { date: string; count: number }[] }>("/dashboard/message-activity");
  return data.days;
}
