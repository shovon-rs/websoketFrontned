import { apiRequest } from "../api-client";
import type { TrackingSession } from "../types";

export async function createSession() {
  return apiRequest<TrackingSession>("/tracking/sessions", { method: "POST" });
}

export async function getSession(id: string) {
  return apiRequest<TrackingSession & { locations: { lat: number; lng: number; recordedAt: string }[] }>(
    `/tracking/sessions/${id}`,
  );
}

export async function deleteLocations(id: string) {
  return apiRequest(`/tracking/sessions/${id}/locations`, { method: "DELETE" });
}
