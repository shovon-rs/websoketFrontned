import { apiRequest } from "../api-client";
import type {
  DocumentRecord,
  DocumentSummary,
  DocumentVersionFull,
  DocumentVersionSummary,
} from "../types";

export async function listDocuments() {
  const data = await apiRequest<{ documents: DocumentSummary[] }>("/documents");
  return data.documents;
}

export async function createDocument(title: string) {
  return apiRequest<DocumentRecord>("/documents", { method: "POST", body: { title } });
}

export async function getDocument(id: string) {
  return apiRequest<DocumentRecord>(`/documents/${id}`);
}

export async function updateTitle(id: string, title: string) {
  return apiRequest<DocumentRecord>(`/documents/${id}`, { method: "PATCH", body: { title } });
}

export async function deleteDocument(id: string) {
  return apiRequest<void>(`/documents/${id}`, { method: "DELETE" });
}

export async function updateVisibility(id: string, visibility: "private" | "public") {
  return apiRequest<DocumentRecord>(`/documents/${id}/visibility`, { method: "PATCH", body: { visibility } });
}

export async function addCollaborator(id: string, userId: string, role?: "editor" | "viewer") {
  return apiRequest<void>(`/documents/${id}/collaborators`, { method: "POST", body: { userId, role } });
}

export async function updateCollaboratorRole(id: string, userId: string, role: "editor" | "viewer") {
  return apiRequest<void>(`/documents/${id}/collaborators/${userId}`, { method: "PATCH", body: { role } });
}

export async function removeCollaborator(id: string, userId: string) {
  return apiRequest<void>(`/documents/${id}/collaborators/${userId}`, { method: "DELETE" });
}

export async function listVersions(id: string) {
  const data = await apiRequest<{ versions: DocumentVersionSummary[] }>(`/documents/${id}/versions`);
  return data.versions;
}

export async function getVersion(id: string, versionId: string) {
  return apiRequest<DocumentVersionFull>(`/documents/${id}/versions/${versionId}`);
}

export async function saveVersion(id: string, title: string, html: string, state: string) {
  return apiRequest<void>(`/documents/${id}/versions`, { method: "POST", body: { title, html, state } });
}

export async function restoreVersion(id: string, versionId: string) {
  return apiRequest<DocumentRecord>(`/documents/${id}/versions/${versionId}/restore`, { method: "POST" });
}
