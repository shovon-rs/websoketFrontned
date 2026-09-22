"use client";
import { AppShell } from "@/components/AppShell";
import { ListShimmer, PageShimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as projectsApi from "@/lib/api/projects.api";
import * as tasksApi from "@/lib/api/tasks.api";
import { dialogBackdrop, dialogPanel, staggerContainer, staggerItem, tapScale } from "@/lib/motion";
import { formatDueDate } from "@/lib/time";
import type { Project, ProjectSummary, Task, TaskStatus } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, FolderKanban, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const MotionLink = motion(Link);

const COLOR_PRESETS = ["#ff6f4f", "#2f7d5a", "#3a6fd8", "#a75fd1", "#d4a017", "#d94f42", "#17231e"];

const STATUS_LABEL: Record<TaskStatus, string> = {
  new: "New",
  in_progress: "In progress",
  ready_for_qa: "Ready for QA",
  testing: "Testing",
  done: "Done",
};

// The pipeline's natural order, so sorting "by progress" reads as earliest-stage-first rather
// than an arbitrary string sort.
const STATUS_ORDER: Record<TaskStatus, number> = {
  new: 0,
  in_progress: 1,
  ready_for_qa: 2,
  testing: 3,
  done: 4,
};

type TaskRow = { task: Task; projectName: string; projectColor: string };
type SortKey = "project" | "time" | "progress";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "time", label: "Time" },
  { value: "project", label: "Project name" },
  { value: "progress", label: "Progress" },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [taskRows, setTaskRows] = useState<TaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("time");

  function load() {
    projectsApi
      .listProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load projects."));
  }

  useEffect(load, []);

  // The task list on the right spans every project the sidebar shows on the left, so it's
  // loaded from the same project list once that's in — one board fetch per project.
  useEffect(() => {
    if (!projects) return;
    if (projects.length === 0) {
      setTaskRows([]);
      return;
    }
    Promise.all(
      projects.map((project) =>
        tasksApi
          .listTasks({ projectId: project.id })
          .then((tasks) => tasks.map((task) => ({ task, projectName: project.name, projectColor: project.color || "#ff6f4f" }))),
      ),
    )
      .then((groups) => setTaskRows(groups.flat()))
      .catch(() => setTaskRows([]));
  }, [projects]);

  const sortedTaskRows = useMemo(() => {
    if (!taskRows) return null;
    const rows = [...taskRows];
    rows.sort((a, b) => {
      if (sortKey === "project") return a.projectName.localeCompare(b.projectName) || a.task.title.localeCompare(b.task.title);
      if (sortKey === "progress") return STATUS_ORDER[a.task.status] - STATUS_ORDER[b.task.status];
      // "time": tasks with a due date first (soonest first), undated tasks trail at the end.
      if (!a.task.dueDate && !b.task.dueDate) return 0;
      if (!a.task.dueDate) return 1;
      if (!b.task.dueDate) return -1;
      return new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime();
    });
    return rows;
  }, [taskRows, sortKey]);

  return (
    <AppShell
      title="Projects"
      subtitle="Organize work into boards your team can track together."
      actions={
        <button className="primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> New project
        </button>
      }
    >
      <div className="page projects-grid-layout">
        <div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {!projects && !error && <PageShimmer />}
          {projects && projects.length === 0 && (
            <section className="card">
              <div className="empty-state">
                <FolderKanban size={26} />
                <h3 style={{ margin: 0 }}>No projects yet.</h3>
                <p className="quiet">Create one to start organizing tasks into a board.</p>
              </div>
            </section>
          )}
          {projects && projects.length > 0 && (
            <motion.div className="project-grid" variants={staggerContainer} initial="hidden" animate="visible">
              {projects.map((project) => (
                <MotionLink
                  href={`/projects/${project.id}`}
                  className="project-card"
                  key={project.id}
                  variants={staggerItem}
                  whileTap={tapScale}
                >
                  <div className="project-card-head">
                    <span className="color-dot" style={{ background: project.color || "#ff6f4f" }} />
                    <strong>{project.name}</strong>
                  </div>
                  {project.description && <p className="quiet">{project.description}</p>}
                  <div className="project-card-stats">
                    <span>
                      <FolderKanban size={13} /> {project.sectionCount} section{project.sectionCount === 1 ? "" : "s"}
                    </span>
                    <span>
                      <ClipboardList size={13} /> {project.taskCount} task{project.taskCount === 1 ? "" : "s"}
                    </span>
                    <span>
                      <Users size={13} /> {project.memberCount} member{project.memberCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </MotionLink>
              ))}
            </motion.div>
          )}
        </div>

        <aside className="card project-tasks-card">
          <div className="card-head">
            <div>
              <h3>All tasks {sortedTaskRows ? `— ${sortedTaskRows.length}` : ""}</h3>
              <p>Across every project you can see</p>
            </div>
          </div>
          <div className="admin-tabs project-tasks-sort" role="tablist" aria-label="Sort tasks by">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                role="tab"
                aria-selected={sortKey === option.value}
                className={sortKey === option.value ? "active" : ""}
                onClick={() => setSortKey(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="project-tasks-list">
            {!sortedTaskRows && <ListShimmer rows={4} />}
            {sortedTaskRows && sortedTaskRows.length === 0 && <p className="quiet project-tasks-empty">No tasks yet.</p>}
            {sortedTaskRows && sortedTaskRows.length > 0 && (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {sortedTaskRows.map(({ task, projectName, projectColor }) => (
                    <motion.div key={task.id} variants={staggerItem} layout>
                      <Link href={`/tasks/${task.id}`} className="project-task-row">
                        <span className="color-dot" style={{ background: projectColor }} />
                        <span className="project-task-row-main">
                          <strong>{task.title}</strong>
                          <small>{projectName}</small>
                        </span>
                        <span className={`task-status ${task.status}`}>{STATUS_LABEL[task.status]}</span>
                        <small className="project-task-row-time">
                          {task.dueDate ? formatDueDate(task.dueDate) : "No due date"}
                        </small>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {createOpen && (
          <CreateProjectDialog
            onClose={() => setCreateOpen(false)}
            onCreated={(project) => {
              setProjects((prev) =>
                prev
                  ? [
                      {
                        id: project.id,
                        name: project.name,
                        description: project.description,
                        color: project.color,
                        memberCount: project.members.length,
                        sectionCount: project.sections.length,
                        taskCount: project.taskCount ?? 0,
                        createdAt: project.createdAt,
                      },
                      ...prev,
                    ]
                  : prev,
              );
              setCreateOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function CreateProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (project: Project) => void }) {
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();

    if (!name) {
      setError("Give the project a name.");
      return;
    }

    setSubmitting(true);
    try {
      const project = await projectsApi.createProject({ name, description, color });
      onCreated(project);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the project. Please try again.");
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
        aria-labelledby="create-project-title"
        variants={dialogPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header>
          <div>
            <h2 id="create-project-title">New project</h2>
            <p>Set up a board to organize tasks into sections.</p>
          </div>
          <button onClick={onClose} aria-label="Close create project dialog">
            <X size={18} />
          </button>
        </header>
        <form onSubmit={onSubmit}>
          <label>
            Name
            <input name="name" placeholder="e.g. Website relaunch" required maxLength={120} />
          </label>
          <label>
            Description
            <textarea name="description" placeholder="What is this project about?" maxLength={2000} />
          </label>
          <label>
            Color
            <div className="color-swatch-row">
              {COLOR_PRESETS.map((preset) => (
                <motion.button
                  type="button"
                  key={preset}
                  className={`color-swatch${color === preset ? " selected" : ""}`}
                  style={{ background: preset }}
                  aria-label={`Use color ${preset}`}
                  aria-pressed={color === preset}
                  onClick={() => setColor(preset)}
                  whileTap={tapScale}
                  animate={{ scale: color === preset ? 1.08 : 1 }}
                  transition={{ duration: 0.16 }}
                />
              ))}
            </div>
          </label>
          {error && (
            <p className="share-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary wide" disabled={submitting}>
            {submitting ? "Creating…" : "Create project"}
          </button>
        </form>
      </motion.section>
    </motion.div>
  );
}
