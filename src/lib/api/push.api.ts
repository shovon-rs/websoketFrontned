import { apiRequest } from "../api-client";

export async function getVapidPublicKey() {
  const data = await apiRequest<{ publicKey: string | null }>("/push/vapid-public-key");
  return data.publicKey;
}

export async function registerToken(input: { platform: "web"; token: string; subscription: unknown }) {
  return apiRequest("/push/register", { method: "POST", body: input });
}

export async function unregisterToken(token: string) {
  return apiRequest("/push/register", { method: "DELETE", body: { token } });
}
