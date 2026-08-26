import { apiRequest } from "../api-client";

export async function getSummary() {
  return apiRequest<{ activeConnections: number; generatedAt: string }>("/dashboard/summary");
}
