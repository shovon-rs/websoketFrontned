"use client";
import { AppShell } from "@/components/AppShell";
import { PageShimmer } from "@/components/Shimmer";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { ApiError } from "@/lib/api-client";
import * as tasksApi from "@/lib/api/tasks.api";
import { useAuth } from "@/lib/auth-context";
import { isManager } from "@/lib/roles";
import type { Task, TaskStatus, User } from "@/lib/types";
import { useWs } from "@/lib/ws-context";
import { FileText, Paperclip, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const TASK_NOTIFICATION_KINDS = new Set(["task:assigned", "task:status-changed", "task:comment-new"]);

export default function TaskDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const { subscribe } = useWs();
  const [task, setTask] = useState<Task | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commentBody, setCommentBody] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function load() {
    tasksApi.getTask(params.id).then(setTask).catch((err) => {
      if (err instanceof ApiError && (err.status === 403 || err.status === 404)) setNotFound(true);
      else setError(err instanceof ApiError ? err.message : "Could not load this task.");
    });
  }

  useEffect(load, [params.id]);

  useEffect(() => {
    return subscribe("notification:new", (event) => {
      const payload = event.payload as { data?: { kind?: string; taskId?: string } };
      if (!payload.data?.kind || !TASK_NOTIFICATION_KINDS.has(payload.data.kind)) return;
      if (payload.data.taskId !== params.id) return;
      load();
    });
  }, [subscribe, params.id]);

  const canManage = isManager(user?.role);

  async function onStatusChange(status: TaskStatus) {
    if (!task) return;
    setError(null);
    try {
      const updated = await tasksApi.updateTaskStatus(task.id, status);
      setTask(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    }
  }

  async function onAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !commentBody.trim()) return;
    setCommentSubmitting(true);
    try {
      const comment = await tasksApi.addComment(task.id, commentBody.trim());
      setTask({ ...task, comments: [...task.comments, comment] });
      setCommentBody("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add your comment.");
    } finally {
      setCommentSubmitting(false);
    }
  }

  async function onDeleteTask() {
    if (!task) return;
    if (!window.confirm("Delete this task? This can't be undone.")) return;
    try {
      await tasksApi.deleteTask(task.id);
      router.push("/tasks");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this task.");
    }
  }

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!task || files.length === 0) return;

    setUploadError(null);
    setUploading(true);
    try {
      const { attachments } = await tasksApi.uploadAttachments(task.id, files);
      setTask({ ...task, attachments: [...task.attachments, ...attachments] });
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Could not upload the file(s).");
    } finally {
      setUploading(false);
    }
  }

  async function onDeleteAttachment(attachmentId: string) {
    if (!task) return;
    try {
      await tasksApi.deleteAttachment(task.id, attachmentId);
      setTask({ ...task, attachments: task.attachments.filter((a) => a.id !== attachmentId) });
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Could not remove that attachment.");
    }
  }

  if (notFound) {
    return (
      <AppShell title="Task not found">
        <div className="page narrow">
          <section className="card">
            <p className="quiet">This task doesn&rsquo;t exist, or you don&rsquo;t have access to it.</p>
          </section>
        </div>
      </AppShell>
    );
  }

  if (!task) {
    return (
      <AppShell title="Task">
        <PageShimmer />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={task.title}
      subtitle={`Created by ${task.creator.displayName}`}
      actions={
        canManage && (
          <button className="danger small" onClick={onDeleteTask}>
            <Trash2 size={14} /> Delete
          </button>
        )
      }
    >
      <div className="page narrow">
        <section className="card">
          <div className="card-head">
            <div>
              <h3>{task.title}</h3>
              {task.description && <p>{task.description}</p>}
            </div>
            {canManage && (
              <button className="plain" onClick={() => setEditOpen(true)}>
                Edit
              </button>
            )}
          </div>

          <div className="task-meta">
            <span>
              Assigned to{" "}
              <strong>{task.assignees.map((a) => a.displayName).join(", ")}</strong>
            </span>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              Status
              <select
                className="role-select"
                value={task.status}
                onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
              >
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h3>Attachments — {task.attachments.length}</h3>
            </div>
            {canManage && (
              <>
                <button className="plain" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Paperclip size={14} /> {uploading ? "Uploading…" : "Add files"}
                </button>
                <input ref={fileInputRef} type="file" multiple hidden onChange={onFilesSelected} />
              </>
            )}
          </div>
          {uploadError && (
            <p className="auth-error" role="alert">
              {uploadError}
            </p>
          )}
          {task.attachments.length === 0 && <p className="quiet">No attachments yet.</p>}
          {task.attachments.map((a) => (
            <div className="task-attachment-row" key={a.id}>
              <FileText size={18} />
              <a href={a.url} target="_blank" rel="noreferrer">
                <strong>{a.fileName}</strong>
                <small>{Math.ceil(a.size / 1024)} KB</small>
              </a>
              {canManage && (
                <button onClick={() => onDeleteAttachment(a.id)} aria-label={`Remove ${a.fileName}`}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h3>Comments — {task.comments.length}</h3>
            </div>
          </div>
          {task.comments.map((c) => (
            <div className="task-comment" key={c.id}>
              <div className="task-comment-head">
                <strong>{c.author.displayName}</strong>
                <time>{new Date(c.createdAt).toLocaleString()}</time>
              </div>
              <p>{c.body}</p>
            </div>
          ))}
          <form className="settings-form" onSubmit={onAddComment} style={{ marginTop: 14 }}>
            <label>
              Add a comment
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                maxLength={2000}
                required
              />
            </label>
            <div className="actions">
              <button className="primary" disabled={commentSubmitting || !commentBody.trim()}>
                {commentSubmitting ? "Posting…" : "Post comment"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {editOpen && (
        <EditTaskDialog
          task={task}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setTask(updated);
            setEditOpen(false);
          }}
        />
      )}
    </AppShell>
  );
}

function EditTaskDialog({
  task,
  onClose,
  onSaved,
}: {
  task: Task;
  onClose: () => void;
  onSaved: (task: Task) => void;
}) {
  const [assignees, setAssignees] = useState<User[]>(task.assignees);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (assignees.length === 0) {
      setError("Choose at least one person to assign this task to.");
      return;
    }

    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    setSubmitting(true);
    try {
      const updated = await tasksApi.updateTask(task.id, {
        title,
        description,
        assigneeIds: assignees.map((a) => a.id),
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="share-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-task-title">
        <header>
          <div>
            <h2 id="edit-task-title">Edit task</h2>
          </div>
          <button onClick={onClose} aria-label="Close edit task dialog">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <label>
            Title
            <input name="title" defaultValue={task.title} required maxLength={200} />
          </label>
          <label>
            Description
            <textarea name="description" defaultValue={task.description} maxLength={5000} />
          </label>
          <label>
            Assigned to
            <div style={{ marginTop: 7 }}>
              <UserMultiSelect selected={assignees} onChange={setAssignees} placeholder="Search by name or email…" />
            </div>
          </label>
          {error && (
            <p className="share-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary wide" disabled={submitting}>
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
    </div>
  );
}
