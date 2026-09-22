"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { PageShimmer } from "@/components/Shimmer";
import { UserMultiSelect } from "@/components/UserMultiSelect";
import { UserSearchDropdown } from "@/components/UserSearchDropdown";
import { ApiError } from "@/lib/api-client";
import * as projectsApi from "@/lib/api/projects.api";
import * as tasksApi from "@/lib/api/tasks.api";
import { useAuth } from "@/lib/auth-context";
import { dialogBackdrop, dialogPanel, staggerContainer, staggerItem } from "@/lib/motion";
import { isManager } from "@/lib/roles";
import { formatDueDate } from "@/lib/time";
import type { Project, ProjectRole, Task, TaskPriority, User } from "@/lib/types";
import { useWs } from "@/lib/ws-context";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const AVATAR_PALETTE = ["coral", "blue", "violet", "gold", "green"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

const TASK_NOTIFICATION_KINDS = new Set(["task:assigned", "task:status-changed", "task:comment-new"]);

export default function ProjectBoardPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { subscribe } = useWs();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [newTaskSection, setNewTaskSection] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

  const loadProject = useCallback(() => {
    projectsApi
      .getProject(params.id)
      .then(setProject)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) setNotFound(true);
        else setError(err instanceof ApiError ? err.message : "Could not load this project.");
      });
  }, [params.id]);

  const loadTasks = useCallback(() => {
    tasksApi
      .listTasks({ projectId: params.id })
      .then(setTasks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load tasks."));
  }, [params.id]);

  useEffect(loadProject, [loadProject]);
  useEffect(loadTasks, [loadTasks]);

  useEffect(() => {
    return subscribe("notification:new", (event) => {
      const payload = event.payload as { data?: { kind?: string } };
      if (!payload.data?.kind || !TASK_NOTIFICATION_KINDS.has(payload.data.kind)) return;
      loadTasks();
    });
  }, [subscribe, loadTasks]);

  const canManage = useMemo(() => {
    if (!project || !user) return false;
    if (isManager(user.role)) return true;
    return project.members.some((m) => m.id === user.id && m.role === "admin");
  }, [project, user]);

  const tasksBySection = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (!project || !tasks) return map;
    for (const section of project.sections) map.set(section.id, []);
    for (const task of tasks) {
      if (!task.sectionId) continue;
      const list = map.get(task.sectionId);
      if (list) list.push(task);
    }
    Array.from(map.values()).forEach((list) => list.sort((a, b) => a.order - b.order));
    return map;
  }, [project, tasks]);

  function insertOrder(destTasks: Task[], destIndex: number): number {
    if (destTasks.length === 0) return 0;
    if (destIndex <= 0) return destTasks[0].order - 1;
    if (destIndex >= destTasks.length) return destTasks[destTasks.length - 1].order + 1;
    return (destTasks[destIndex - 1].order + destTasks[destIndex].order) / 2;
  }

  async function moveTask(taskId: string, destSectionId: string, destIndex: number) {
    if (!tasks) return;
    const previous = tasks;
    const destTasks = (tasksBySection.get(destSectionId) ?? []).filter((t) => t.id !== taskId);
    const newOrder = insertOrder(destTasks, destIndex);

    const optimistic = tasks.map((t) =>
      t.id === taskId ? { ...t, sectionId: destSectionId, order: newOrder } : t,
    );
    setTasks(optimistic);
    setDragTaskId(null);
    setDragOverSectionId(null);

    try {
      const updated = await tasksApi.updateTaskOrder(taskId, { sectionId: destSectionId, order: newOrder });
      setTasks((current) => (current ?? previous).map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setTasks(previous);
      setError(err instanceof ApiError ? err.message : "Could not move that task. Please try again.");
    }
  }

  async function onAddSection(name: string) {
    if (!project) return;
    try {
      const section = await projectsApi.createSection(project.id, name);
      setProject({ ...project, sections: [...project.sections, section] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that section.");
    } finally {
      setAddingSection(false);
    }
  }

  async function onDeleteSection(sectionId: string) {
    if (!project) return;
    if (!window.confirm("Delete this section? Tasks inside it will be left without a section.")) return;
    try {
      await projectsApi.deleteSection(sectionId);
      setProject({ ...project, sections: project.sections.filter((s) => s.id !== sectionId) });
      setTasks((prev) => prev?.map((t) => (t.sectionId === sectionId ? { ...t, sectionId: null } : t)) ?? prev);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that section.");
    }
  }

  if (notFound) {
    return (
      <AppShell title="Project not found">
        <div className="page narrow">
          <section className="card">
            <p className="quiet">This project doesn&rsquo;t exist, or you don&rsquo;t have access to it.</p>
          </section>
        </div>
      </AppShell>
    );
  }

  if (!project || !tasks) {
    return (
      <AppShell title="Project">
        <PageShimmer variant="board" />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={project.name}
      subtitle={project.description || "Project board"}
      actions={
        <button className="plain" onClick={() => setMembersOpen(true)}>
          <Users size={14} /> Members ({project.members.length})
        </button>
      }
    >
      <div className="page">
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <motion.div className="board" variants={staggerContainer} initial="hidden" animate="visible">
          {project.sections
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((section) => {
              const sectionTasks = tasksBySection.get(section.id) ?? [];
              return (
                <motion.div
                  className={`board-column${dragOverSectionId === section.id ? " drag-over" : ""}`}
                  key={section.id}
                  variants={staggerItem}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (dragTaskId) setDragOverSectionId(section.id);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget === e.target) setDragOverSectionId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverSectionId(null);
                    if (dragTaskId) moveTask(dragTaskId, section.id, sectionTasks.length);
                  }}
                >
                  <div className="board-column-head">
                    <strong>{section.name}</strong>
                    <span className="quiet">{sectionTasks.length}</span>
                    {canManage && (
                      <button
                        className="plain"
                        aria-label={`Delete ${section.name}`}
                        onClick={() => onDeleteSection(section.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  <motion.div className="board-column-body" variants={staggerContainer} initial="hidden" animate="visible">
                    <AnimatePresence initial={false}>
                      {sectionTasks.map((task, index) => (
                        <motion.div
                          className={`board-card${dragTaskId === task.id ? " dragging" : ""}`}
                          key={task.id}
                          layout
                          layoutId={task.id}
                          variants={staggerItem}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ layout: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }}
                          draggable
                          onDragStart={() => setDragTaskId(task.id)}
                          onDragEnd={() => {
                            setDragTaskId(null);
                            setDragOverSectionId(null);
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDragOverSectionId(null);
                            if (dragTaskId) moveTask(dragTaskId, section.id, index);
                          }}
                        >
                          <Link href={`/tasks/${task.id}`} className="board-card-link">
                            <strong>{task.title}</strong>
                          </Link>
                          <div className="board-card-meta">
                            <span className={`priority-badge ${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
                            {task.dueDate && <span className="quiet">{formatDueDate(task.dueDate)}</span>}
                          </div>
                          {task.assignees.length > 0 && (
                            <div className="board-card-avatars">
                              {task.assignees.slice(0, 4).map((a) => (
                                <Avatar key={a.id} initials={initialsOf(a.displayName)} color={colorFor(a.id)} size="sm" />
                              ))}
                              {task.assignees.length > 4 && (
                                <span className="avatar-more">+{task.assignees.length - 4}</span>
                              )}
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>

                  <button className="plain board-add-task" onClick={() => setNewTaskSection(section.id)}>
                    <Plus size={14} /> New task
                  </button>
                </motion.div>
              );
            })}

          {canManage && (
            <div className="board-column board-add-column">
              {addingSection ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const name = String(form.get("name") ?? "").trim();
                    if (name) onAddSection(name);
                  }}
                >
                  <input name="name" placeholder="Section name" autoFocus maxLength={80} required />
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="primary small" type="submit">
                      Add
                    </button>
                    <button className="plain" type="button" onClick={() => setAddingSection(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button className="plain" onClick={() => setAddingSection(true)}>
                  <Plus size={14} /> Add section
                </button>
              )}
            </div>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {membersOpen && (
          <ManageMembersDialog
            project={project}
            canManage={canManage}
            onClose={() => setMembersOpen(false)}
            onUpdated={setProject}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {newTaskSection && (
          <CreateBoardTaskDialog
            projectId={project.id}
            sectionId={newTaskSection}
            onClose={() => setNewTaskSection(null)}
            onCreated={(task) => {
              setTasks((prev) => (prev ? [...prev, task] : prev));
              setNewTaskSection(null);
            }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function ManageMembersDialog({
  project,
  canManage,
  onClose,
  onUpdated,
}: {
  project: Project;
  canManage: boolean;
  onClose: () => void;
  onUpdated: (project: Project) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function onAdd(user: User) {
    if (project.members.some((m) => m.id === user.id)) return;
    setError(null);
    setPendingId(user.id);
    try {
      await projectsApi.addMember(project.id, user.id, "member");
      onUpdated({
        ...project,
        members: [...project.members, { id: user.id, displayName: user.displayName, email: user.email, role: "member" }],
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that member.");
    } finally {
      setPendingId(null);
    }
  }

  async function onRoleChange(memberId: string, role: ProjectRole) {
    setError(null);
    setPendingId(memberId);
    try {
      await projectsApi.updateMemberRole(project.id, memberId, role);
      onUpdated({
        ...project,
        members: project.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change that member's role.");
    } finally {
      setPendingId(null);
    }
  }

  async function onRemove(memberId: string) {
    setError(null);
    setPendingId(memberId);
    try {
      await projectsApi.removeMember(project.id, memberId);
      onUpdated({ ...project, members: project.members.filter((m) => m.id !== memberId) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that member.");
    } finally {
      setPendingId(null);
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
        aria-labelledby="project-members-title"
        variants={dialogPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header>
          <div>
            <h2 id="project-members-title">Project members</h2>
            <p>{project.members.length} members</p>
          </div>
          <button onClick={onClose} aria-label="Close members dialog">
            <X size={18} />
          </button>
        </header>

        {error && (
          <p className="share-error" role="alert">
            {error}
          </p>
        )}

        <div style={{ marginTop: 8 }}>
          {project.members.map((m) => (
            <div className="activity-row" key={m.id}>
              <Avatar initials={initialsOf(m.displayName)} color={colorFor(m.id)} size="sm" />
              <div>
                <strong>{m.displayName}</strong>
                <small>{m.email}</small>
              </div>
              {canManage ? (
                <>
                  <select
                    className="role-select"
                    value={m.role}
                    disabled={pendingId === m.id}
                    onChange={(e) => onRoleChange(m.id, e.target.value as ProjectRole)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button className="danger small" disabled={pendingId === m.id} onClick={() => onRemove(m.id)}>
                    Remove
                  </button>
                </>
              ) : (
                <span className="quiet">{m.role === "admin" ? "Admin" : "Member"}</span>
              )}
            </div>
          ))}
        </div>

        {canManage && (
          <div style={{ marginTop: 16 }}>
            <label>
              Add a member
              <div style={{ marginTop: 7 }}>
                <UserSearchDropdown onSelect={onAdd} placeholder="Search by name or email…" />
              </div>
            </label>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}

function CreateBoardTaskDialog({
  projectId,
  sectionId,
  onClose,
  onCreated,
}: {
  projectId: string;
  sectionId: string;
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const [assignees, setAssignees] = useState<User[]>([]);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const dueDateRaw = String(form.get("dueDate") ?? "").trim();

    if (!title) {
      setError("Give the task a title.");
      return;
    }

    setSubmitting(true);
    try {
      const task = await tasksApi.createTask({
        title,
        description,
        assigneeIds: assignees.map((a) => a.id),
        projectId,
        sectionId,
        priority,
        dueDate: dueDateRaw ? new Date(dueDateRaw).toISOString() : undefined,
      });
      onCreated(task);
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
        aria-labelledby="create-board-task-title"
        variants={dialogPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header>
          <div>
            <h2 id="create-board-task-title">New task</h2>
            <p>Added to this section.</p>
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
              <UserMultiSelect selected={assignees} onChange={setAssignees} placeholder="Search by name or email…" />
            </div>
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
          {error && (
            <p className="share-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary wide" disabled={submitting}>
            {submitting ? "Creating…" : "Create task"}
          </button>
        </form>
      </motion.section>
    </motion.div>
  );
}
