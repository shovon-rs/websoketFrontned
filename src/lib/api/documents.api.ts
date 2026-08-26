import { apiRequest } from "../api-client";
import type { DocumentRecord } from "../types";

export async function createDocument(title: string) {
  return apiRequest<DocumentRecord>("/documents", { method: "POST", body: { title } });
}

export async function getDocument(id: string) {
  return apiRequest<DocumentRecord>(`/documents/${id}`);
}
