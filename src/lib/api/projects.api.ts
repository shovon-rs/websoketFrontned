import { apiRequest } from "../api-client";
import type { Project, ProjectRole, ProjectSummary, Section } from "../types";

export async function listProjects() {
  const data = await apiRequest<{ projects: ProjectSummary[] }>("/projects");
  return data.projects;
}

export async function createProject(input: { name: string; description?: string; color?: string }) {
  return apiRequest<Project>("/projects", { method: "POST", body: input });
}

export async function getProject(id: string) {
  return apiRequest<Project>(`/projects/${id}`);
}

export async function updateProject(id: string, input: { name?: string; description?: string; color?: string }) {
  return apiRequest<Project>(`/projects/${id}`, { method: "PATCH", body: input });
}

export async function deleteProject(id: string) {
  return apiRequest(`/projects/${id}`, { method: "DELETE" });
}

export async function addMember(projectId: string, userId: string, role?: ProjectRole) {
  return apiRequest<void>(`/projects/${projectId}/members`, { method: "POST", body: { userId, role } });
}

export async function updateMemberRole(projectId: string, userId: string, role: ProjectRole) {
  return apiRequest<void>(`/projects/${projectId}/members/${userId}`, { method: "PATCH", body: { role } });
}

export async function removeMember(projectId: string, userId: string) {
  return apiRequest(`/projects/${projectId}/members/${userId}`, { method: "DELETE" });
}

export async function createSection(projectId: string, name: string) {
  return apiRequest<Section>(`/projects/${projectId}/sections`, { method: "POST", body: { name } });
}

export async function updateSection(sectionId: string, input: { name?: string; order?: number }) {
  return apiRequest<Section>(`/projects/sections/${sectionId}`, { method: "PATCH", body: input });
}

export async function deleteSection(sectionId: string) {
  return apiRequest(`/projects/sections/${sectionId}`, { method: "DELETE" });
}
