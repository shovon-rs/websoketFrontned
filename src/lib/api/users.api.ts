import { apiRequest } from "../api-client";
import type { User } from "../types";

export async function searchUsers(search: string) {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const data = await apiRequest<{ users: User[] }>(`/users${query}`);
  return data.users;
}
