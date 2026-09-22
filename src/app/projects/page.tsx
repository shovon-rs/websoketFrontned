"use client";
import { AppShell } from "@/components/AppShell";
import { PageShimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as projectsApi from "@/lib/api/projects.api";
import { dialogBackdrop, dialogPanel, staggerContainer, staggerItem, tapScale } from "@/lib/motion";
import type { Project, ProjectSummary } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardList, FolderKanban, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const MotionLink = motion(Link);

const COLOR_PRESETS = ["#ff6f4f", "#2f7d5a", "#3a6fd8", "#a75fd1", "#d4a017", "#d94f42", "#17231e"];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  function load() {
    projectsApi
      .listProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load projects."));
  }

  useEffect(load, []);

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
      <div className="page narrow">
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
