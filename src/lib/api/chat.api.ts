import { apiRequest } from "../api-client";
import type { Conversation, Message } from "../types";

export async function listConversations() {
  const data = await apiRequest<{ conversations: Conversation[] }>("/conversations");
  return data.conversations;
}

export async function createConversation(input: { memberIds: string[]; type?: "direct" | "group"; name?: string }) {
  return apiRequest<Conversation>("/conversations", { method: "POST", body: input });
}

export async function getMessages(conversationId: string, after?: string) {
  const query = after ? `?after=${encodeURIComponent(after)}` : "";
  const data = await apiRequest<{ messages: Message[] }>(`/conversations/${conversationId}/messages${query}`);
  return data.messages;
}
