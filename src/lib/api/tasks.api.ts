import { apiRequest } from "../api-client";
import type { Task, TaskAttachment, TaskComment, TaskStatus } from "../types";

export async function listTasks(status?: TaskStatus) {
  const query = status ? `?status=${status}` : "";
  const data = await apiRequest<{ tasks: Task[] }>(`/tasks${query}`);
  return data.tasks;
}

export async function getTask(id: string) {
  return apiRequest<Task>(`/tasks/${id}`);
}

export async function createTask(input: { title: string; description?: string; assigneeIds: string[]; status?: TaskStatus }) {
  return apiRequest<Task>("/tasks", { method: "POST", body: input });
}

export async function updateTask(id: string, input: { title?: string; description?: string; assigneeIds?: string[] }) {
  return apiRequest<Task>(`/tasks/${id}`, { method: "PATCH", body: input });
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  return apiRequest<Task>(`/tasks/${id}/status`, { method: "PATCH", body: { status } });
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
