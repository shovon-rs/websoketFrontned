import { apiRequest } from "../api-client";
import type { PresenceUser, User } from "../types";

export async function searchUsers(search: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const data = await apiRequest<{ users: User[] }>(`/users${query}`);
  return data.users;
}

export async function getPresence() {
  const data = await apiRequest<{ users: PresenceUser[] }>("/users/presence");
  return data.users;
}

export async function uploadAvatar(file: File) {
  const formData = new FormData();
  formData.append("avatar", file);
  const data = await apiRequest<{ avatarUrl: string }>("/users/me/avatar", { method: "POST", formData });
  return data.avatarUrl;
}

export async function removeAvatar() {
  return apiRequest("/users/me/avatar", { method: "DELETE" });
}
