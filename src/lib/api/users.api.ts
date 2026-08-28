import { apiRequest } from "../api-client";
import type { PresenceUser, Role, User } from "../types";

export async function searchUsers(search: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const data = await apiRequest<{ users: User[] }>(`/users${query}`);
  return data.users;
}

// Full, uncapped roster with roles — deliberately a separate endpoint from searchUsers above,
// which stays the capped, self-excluding picker used by UserSearchDropdown elsewhere.
export async function listUsersForAdmin() {
  const data = await apiRequest<{ users: User[] }>("/users/admin");
  return data.users;
}

export async function updateUserRole(userId: string, role: Role) {
  return apiRequest<User>(`/users/${userId}/role`, { method: "PATCH", body: { role } });
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
