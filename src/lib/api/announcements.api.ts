import { apiRequest } from "../api-client";
import type { Announcement, AnnouncementAudience } from "../types";

export async function listAnnouncements() {
  const data = await apiRequest<{ announcements: Announcement[] }>("/announcements");
  return data.announcements;
}

export async function getUpcomingAnnouncement() {
  return apiRequest<Announcement | null>("/announcements/upcoming");
}

export async function getAnnouncement(id: string) {
  return apiRequest<Announcement>(`/announcements/${id}`);
}

export async function createAnnouncement(input: {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  inviteUserIds?: string[];
}) {
  return apiRequest<Announcement>("/announcements", { method: "POST", body: input });
}

export async function cancelAnnouncement(id: string) {
  return apiRequest<Announcement>(`/announcements/${id}/cancel`, { method: "PATCH" });
}
