import { apiRequest, setAccessToken } from "../api-client";
import type { User } from "../types";

export async function register(input: { email: string; password: string; displayName: string }) {
  const data = await apiRequest<{ user: User; accessToken: string }>("/auth/register", {
    method: "POST",
    body: input,
  });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function login(input: { email: string; password: string }) {
  const data = await apiRequest<{ user: User; accessToken: string }>("/auth/login", {
    method: "POST",
    body: input,
  });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function me() {
  return apiRequest<User>("/auth/me");
}

export async function logout() {
  await apiRequest("/auth/logout", { method: "POST" });
  setAccessToken(null);
}
