"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { ListShimmer } from "@/components/Shimmer";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { ApiError } from "@/lib/api-client";
import * as tasksApi from "@/lib/api/tasks.api";
import { useAuth } from "@/lib/auth-context";
import { dialogBackdrop, dialogPanel, staggerContainer, staggerItem } from "@/lib/motion";
import { isManager } from "@/lib/roles";
import { formatDueDate } from "@/lib/time";
import type { Task, TaskPerson, TaskPriority, TaskStatus, User } from "@/lib/types";
import { useWs } from "@/lib/ws-context";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, FileText, Paperclip, MessageSquare, Plus, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const STATUS_LABEL: Record<TaskStatus, string> = {
  new: "New",
  in_progress: "In progress",
  ready_for_qa: "Ready for QA",
  testing: "Testing",
  done: "Done",
};

const FILTERS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "ready_for_qa", label: "Ready for QA" },
  { value: "testing", label: "Testing" },
  { value: "done", label: "Done" },
];

function initialsOf(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function assigneeSummary(people: TaskPerson[]): string {
  if (people.length === 0) return "no one";
  if (people.length === 1) return people[0].displayName;
  if (people.length === 2) return `${people[0].displayName} and ${people[1].displayName}`;
  return `${people[0].displayName} +${people.length - 1} more`;
}

const TASK_NOTIFICATION_KINDS = new Set(["task:assigned", "task:status-changed", "task:comment-new"]);

const STATUS_DOT_COLOR: Record<TaskStatus, string> = {
  new: "#7a83c4",
  in_progress: "#e3a23c",
  ready_for_qa: "#a95fd1",
  testing: "#3a8fd8",
  done: "#2f9663",
};

export default function TasksPage() {
  const { user } = useAuth();
  const { subscribe } = useWs();
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [taskCounts, setTaskCounts] = useState<Record<TaskStatus, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback((status: TaskStatus | "all") => {
    tasksApi
      .listTasks(status === "all" ? undefined : { status })
      .then(setTasks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load tasks."));
  }, []);

  // Independent of the filtered list above — the overview sidebar always needs the full
  // breakdown by status, even while the visible list is narrowed to a single one.
  const loadCounts = useCallback(() => {
    tasksApi
      .listTasks()
      .then((all) => {
        setTaskCounts({
          new: all.filter((t) => t.status === "new").length,
          in_progress: all.filter((t) => t.status === "in_progress").length,
          ready_for_qa: all.filter((t) => t.status === "ready_for_qa").length,
          testing: all.filter((t) => t.status === "testing").length,
          done: all.filter((t) => t.status === "done").length,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => load(filter), [filter, load]);
  useEffect(() => loadCounts(), [loadCounts]);

  useEffect(() => {
    return subscribe("notification:new", (event) => {
      const payload = event.payload as { data?: { kind?: string } };
      if (!payload.data?.kind || !TASK_NOTIFICATION_KINDS.has(payload.data.kind)) return;
      load(filter);
      loadCounts();
    });
  }, [subscribe, load, filter, loadCounts]);

  const canCreate = isManager(user?.role);

  return (
    <AppShell title="Tasks" subtitle="Track work assigned across the team.">
      <div className="page tasks-grid">
        <div>
          <div className="task-filters">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                className={filter === f.value ? "primary" : "plain"}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
            {canCreate && (
              <button className="primary" style={{ marginLeft: "auto" }} onClick={() => setCreateOpen(true)}>
                <Plus size={16} /> New task
              </button>
            )}
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}
          {!tasks && !error && <ListShimmer rows={5} />}

          {tasks && tasks.length === 0 && (
            <section className="card">
              <div className="empty-state">
                <ClipboardList size={26} />
                <h3 style={{ margin: 0 }}>No tasks here yet.</h3>
                <p className="quiet">{canCreate ? "Create one to start tracking work." : "Nothing assigned to the team yet."}</p>
              </div>
            </section>
          )}

          {tasks && tasks.length > 0 && (
            <motion.section
              className="card"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {tasks.map((task) => (
                <motion.div variants={staggerItem} key={task.id}>
                  <Link href={`/tasks/${task.id}`} className="activity-row task-row">
                    <Avatar initials={initialsOf(task.assignees[0]?.displayName ?? "?")} color="blue" size="sm" />
                    <div>
                      <strong>{task.title}</strong>
                      <small>Assigned to {assigneeSummary(task.assignees)}</small>
                    </div>
                    <span className={`task-status ${task.status}`}>{STATUS_LABEL[task.status]}</span>
                    <span className="quiet" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {task.dueDate && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          Due {formatDueDate(task.dueDate)}
                        </span>
                      )}
                      {task.attachments.length > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Paperclip size={13} /> {task.attachments.length}
                        </span>
                      )}
                      {task.comments.length > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <MessageSquare size={13} /> {task.comments.length}
                        </span>
                      )}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </motion.section>
          )}
        </div>

        <aside className="card admin-roles-card">
          <h3>Overview</h3>
          <p>Status breakdown across the team.</p>
          {taskCounts ? (
            FILTERS.filter((f) => f.value !== "all").map((f) => (
              <div className="admin-role-row" key={f.value}>
                <span className="admin-role-name">
                  <span className="admin-role-dot" style={{ background: STATUS_DOT_COLOR[f.value as TaskStatus] }} />
                  {f.label}
                </span>
                <span className="admin-role-count">{taskCounts[f.value as TaskStatus]}</span>
              </div>
            ))
          ) : (
            <ListShimmer rows={3} />
          )}
        </aside>
      </div>

      <AnimatePresence>
        {createOpen && (
          <CreateTaskDialog
            onClose={() => setCreateOpen(false)}
            onCreated={(task) => {
              setTasks((prev) => (prev ? [task, ...prev] : prev));
              setCreateOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

const MAX_ATTACHMENTS = 10;

function CreateTaskDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (task: Task) => void }) {
  const [assignees, setAssignees] = useState<User[]>([]);
  const [status, setStatus] = useState<TaskStatus>("new");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_ATTACHMENTS));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

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
    const dueDateRaw = String(form.get("dueDate") ?? "").trim();

    setSubmitting(true);
    try {
      const task = await tasksApi.createTask({
        title,
        description,
        assigneeIds: assignees.map((a) => a.id),
        status,
        priority,
        dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : undefined,
      });

      if (files.length === 0) {
        onCreated(task);
        return;
      }

      try {
        const { attachments } = await tasksApi.uploadAttachments(task.id, files);
        onCreated({ ...task, attachments });
      } catch (uploadErr) {
        // The task itself was created fine — leave the dialog open so this error is actually
        // seen, instead of closing over it. The task already exists and will show up in the
        // list on the next reload; attachments can be added from its detail page.
        setError(
          uploadErr instanceof ApiError
            ? `Task created, but attachments failed: ${uploadErr.message}`
            : "Task created, but the attachments could not be uploaded.",
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the task. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      className="share-backdrop"
      variants={dialogBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-task-title"
        variants={dialogPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header>
          <div>
            <h2 id="create-task-title">New task</h2>
            <p>Assign work to someone on the team.</p>
          </div>
          <button onClick={onClose} aria-label="Close create task dialog">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <label>
            Title
            <input name="title" placeholder="What needs to get done?" required maxLength={200} />
          </label>
          <label>
            Description
            <textarea name="description" placeholder="Add any details…" maxLength={5000} />
          </label>
          <label>
            Assigned to
            <div style={{ marginTop: 7 }}>
              <UserMultiSelect
                selected={assignees}
                onChange={setAssignees}
                placeholder="Search by name or email…"
              />
            </div>
          </label>
          <label>
            Status
            <select className="role-select" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="new">New</option>
              <option value="in_progress">In progress</option>
              <option value="ready_for_qa">Ready for QA</option>
              <option value="testing">Testing</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            Priority
            <select className="role-select" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label>
            Due date
            <input name="dueDate" type="datetime-local" />
          </label>
          <label>
            Attachments
            <div style={{ marginTop: 7 }}>
              <button type="button" className="plain" onClick={() => fileInputRef.current?.click()} disabled={files.length >= MAX_ATTACHMENTS}>
                <Paperclip size={14} /> Add files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={onFilesSelected}
              />
            </div>
            {files.map((file, i) => (
              <div className="task-attachment-row" key={`${file.name}-${i}`}>
                <FileText size={18} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{file.name}</strong>
                  <small>{Math.ceil(file.size / 1024)} KB</small>
                </div>
                <button type="button" onClick={() => removeFile(i)} aria-label={`Remove ${file.name}`}>
                  <X size={14} />
                </button>
              </div>
            ))}
          </label>
          {error && <p className="share-error" role="alert">{error}</p>}
          <button className="primary wide" disabled={submitting}>
            {submitting ? "Creating…" : "Create task"}
          </button>
        </form>
      </motion.section>
    </motion.div>
  );
}
