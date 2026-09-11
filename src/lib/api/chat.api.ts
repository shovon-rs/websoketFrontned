import { apiRequest } from "../api-client";
import type { Conversation, ConversationRole, Message } from "../types";

export async function listConversations() {
  const data = await apiRequest<{ conversations: Conversation[] }>("/conversations");
  return data.conversations;
}

export async function createConversation(input: { memberIds: string[]; type?: "direct" | "group"; name?: string }) {
  return apiRequest<Conversation>("/conversations", { method: "POST", body: input });
}

export async function getConversation(id: string) {
  return apiRequest<Conversation>(`/conversations/${id}`);
}

export async function renameConversation(id: string, name: string) {
  return apiRequest<Conversation>(`/conversations/${id}`, { method: "PATCH", body: { name } });
}

export async function addMembers(id: string, memberIds: string[]) {
  return apiRequest<Conversation>(`/conversations/${id}/members`, { method: "POST", body: { memberIds } });
}

export async function removeMember(id: string, userId: string) {
  return apiRequest<{ promotedAdminId: string | null }>(`/conversations/${id}/members/${userId}`, { method: "DELETE" });
}

export async function updateMemberRole(id: string, userId: string, role: ConversationRole) {
  return apiRequest(`/conversations/${id}/members/${userId}/role`, { method: "PATCH", body: { role } });
}

export async function getMessages(conversationId: string, after?: string) {
  const query = after ? `?after=${encodeURIComponent(after)}` : "";
  const data = await apiRequest<{ messages: Message[] }>(`/conversations/${conversationId}/messages${query}`);
  return data.messages;
}

export async function uploadAttachment(conversationId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest<{ attachmentId: string; url: string; mimeType: string; size: number; fileName: string }>(
    `/conversations/${conversationId}/attachments`,
    { method: "POST", formData },
  );
}
