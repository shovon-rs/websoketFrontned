import { apiRequest } from "../api-client";
import type { Task, TaskAttachment, TaskComment, TaskPriority, TaskStatus } from "../types";

export type TaskListFilters = {
  status?: TaskStatus;
  projectId?: string;
  /** ISO date string — inclusive lower bound on dueDate. */
  from?: string;
  /** ISO date string — inclusive upper bound on dueDate. */
  to?: string;
};

export async function listTasks(filters?: TaskListFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  const query = params.toString();
  const data = await apiRequest<{ tasks: Task[] }>(`/tasks${query ? `?${query}` : ""}`);
  return data.tasks;
}

export async function getTask(id: string) {
  return apiRequest<Task>(`/tasks/${id}`);
}

export type CreateTaskInput = {
  title: string;
  description?: string;
  assigneeIds: string[];
  status?: TaskStatus;
  projectId?: string;
  sectionId?: string;
  dueDate?: string;
  startDate?: string;
  priority?: TaskPriority;
};

export async function createTask(input: CreateTaskInput) {
  return apiRequest<Task>("/tasks", { method: "POST", body: input });
}

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  assigneeIds?: string[];
  projectId?: string;
  sectionId?: string;
  dueDate?: string;
  startDate?: string;
  priority?: TaskPriority;
};

export async function updateTask(id: string, input: UpdateTaskInput) {
  return apiRequest<Task>(`/tasks/${id}`, { method: "PATCH", body: input });
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  return apiRequest<Task>(`/tasks/${id}/status`, { method: "PATCH", body: { status } });
}

export async function updateTaskOrder(id: string, input: { sectionId: string; order: number }) {
  return apiRequest<Task>(`/tasks/${id}/order`, { method: "PATCH", body: input });
}

export async function deleteTask(id: string) {
  return apiRequest(`/tasks/${id}`, { method: "DELETE" });
}

export async function addComment(id: string, body: string) {
  return apiRequest<TaskComment>(`/tasks/${id}/comments`, { method: "POST", body: { body } });
}

export async function uploadAttachments(id: string, files: File[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  return apiRequest<{ attachments: TaskAttachment[] }>(`/tasks/${id}/attachments`, { method: "POST", formData });
}

export async function deleteAttachment(id: string, attachmentId: string) {
  return apiRequest(`/tasks/${id}/attachments/${attachmentId}`, { method: "DELETE" });
}
