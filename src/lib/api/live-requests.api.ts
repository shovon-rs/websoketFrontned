import { apiRequest } from "../api-client";
import type { LiveStreamRequest } from "../types";

// Paths point at /announcements/requests/... — live-stream requests are tightly coupled to
// the Announcement they produce on approval, so the backend groups them under that resource
// rather than a separate top-level one, despite this file's own name.

export async function createLiveStreamRequest(input: { title: string; description: string; proposedAt: string | null }) {
  return apiRequest<LiveStreamRequest>("/announcements/requests", { method: "POST", body: input });
}

export async function listMyLiveStreamRequests() {
  const data = await apiRequest<{ requests: LiveStreamRequest[] }>("/announcements/requests/mine");
  return data.requests;
}

export async function listPendingLiveStreamRequests() {
  const data = await apiRequest<{ requests: LiveStreamRequest[] }>("/announcements/requests");
  return data.requests;
}

export async function approveLiveStreamRequest(id: string, scheduledAt: string) {
  return apiRequest<LiveStreamRequest>(`/announcements/requests/${id}/approve`, {
    method: "POST",
    body: { scheduledAt },
  });
}

export async function rejectLiveStreamRequest(id: string, reason?: string) {
  return apiRequest<LiveStreamRequest>(`/announcements/requests/${id}/reject`, {
    method: "POST",
    body: { reason },
  });
}
