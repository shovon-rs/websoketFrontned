import { apiRequest } from "../api-client";
import type { Call, CallType, IceServer } from "../types";

export async function createCall(calleeId: string, callType: CallType) {
  return apiRequest<Call>("/calls", { method: "POST", body: { calleeId, callType } });
}

export async function getCall(id: string) {
  return apiRequest<Call>(`/calls/${id}`);
}

export async function getIceServers() {
  const data = await apiRequest<{ iceServers: IceServer[] }>("/calls/ice-servers");
  return data.iceServers;
}
