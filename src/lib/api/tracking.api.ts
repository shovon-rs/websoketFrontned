import { apiRequest } from "../api-client";
import type { AdminTrackingSession, OwnedTrackingSession, SharedTrackingSession, TrackingSession, User } from "../types";

export async function createSession() {
  return apiRequest<TrackingSession>("/tracking/sessions", { method: "POST" });
}

export async function listSessions() {
  return apiRequest<{ owned: OwnedTrackingSession[]; shared: SharedTrackingSession[] }>("/tracking/sessions");
}

// super_admin only — every currently active session across all users.
export async function listAllActiveSessions() {
  return apiRequest<{ sessions: AdminTrackingSession[] }>("/tracking/sessions/admin");
}

export async function getSession(id: string) {
  return apiRequest<TrackingSession & { locations: { lat: number; lng: number; recordedAt: string }[] }>(
    `/tracking/sessions/${id}`,
  );
}

export async function deleteLocations(id: string) {
  return apiRequest(`/tracking/sessions/${id}/locations`, { method: "DELETE" });
}

export async function addViewer(sessionId: string, userId: string) {
  return apiRequest<User>(`/tracking/sessions/${sessionId}/viewers`, { method: "POST", body: { userId } });
}

export async function removeViewer(sessionId: string, userId: string) {
  return apiRequest(`/tracking/sessions/${sessionId}/viewers/${userId}`, { method: "DELETE" });
}
