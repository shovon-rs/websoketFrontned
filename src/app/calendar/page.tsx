"use client";
import { AppShell } from "@/components/AppShell";
import { PageShimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as projectsApi from "@/lib/api/projects.api";
import * as tasksApi from "@/lib/api/tasks.api";
import type { ProjectSummary, Task } from "@/lib/types";
import { formatTimeShort } from "@/lib/time";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS_PER_DAY = 3;

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function buildGrid(monthCursor: Date): Date[] {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(firstOfMonth);
  start.setDate(start.getDate() - start.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function CalendarPage() {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  const days = useMemo(() => buildGrid(monthCursor), [monthCursor]);
  const today = useMemo(() => toDateKey(new Date()), []);

  useEffect(() => {
    projectsApi.listProjects().then(setProjects).catch(() => undefined);
  }, []);

  useEffect(() => {
    setError(null);
    // Send full local-day boundaries (not date-only strings): the backend parses `from`/`to` as
    // absolute instants (`new Date(...)`), and a bare "YYYY-MM-DD" parses as UTC midnight, which
    // would cut off the last visible day's tasks except those due at exactly 00:00 UTC.
    const firstDay = days[0];
    const lastDay = days[days.length - 1];
    const from = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate(), 0, 0, 0, 0).toISOString();
    const to = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate(), 23, 59, 59, 999).toISOString();
    tasksApi
      .listTasks({ from, to })
      .then(setTasks)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load tasks for this month."));
  }, [days]);

  const projectColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of projects) map.set(p.id, p.color);
    return map;
  }, [projects]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (!tasks) return map;
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = toDateKey(new Date(task.dueDate));
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const selectedTasks = selectedDayKey ? tasksByDay.get(selectedDayKey) ?? [] : [];

  return (
    <AppShell title="Calendar" subtitle="Tasks by due date.">
      <div className="page">
        <div className="calendar-toolbar">
          <button className="plain" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <strong>{monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
          <button className="plain" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
          <button className="plain" onClick={() => setMonthCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Today
          </button>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {!tasks && !error && <PageShimmer />}

        {tasks && (
          <div className="calendar-grid">
            {WEEKDAY_LABELS.map((label) => (
              <div className="calendar-weekday" key={label}>
                {label}
              </div>
            ))}
            {days.map((day) => {
              const key = toDateKey(day);
              const inMonth = day.getMonth() === monthCursor.getMonth();
              const dayTasks = tasksByDay.get(key) ?? [];
              const visible = dayTasks.slice(0, MAX_CHIPS_PER_DAY);
              const overflow = dayTasks.length - visible.length;
              return (
                <div
                  className={`calendar-cell${inMonth ? "" : " outside"}${key === today ? " today" : ""}`}
                  key={key}
                >
                  <span className="calendar-cell-date">{day.getDate()}</span>
                  <div className="calendar-chip-list">
                    {visible.map((task) => (
                      <Link
                        href={`/tasks/${task.id}`}
                        key={task.id}
                        className="calendar-chip"
                        style={{ borderLeftColor: (task.projectId && projectColor.get(task.projectId)) || "var(--line)" }}
                        title={formatTimeShort(task.dueDate!) ? `${formatTimeShort(task.dueDate!)} · ${task.title}` : task.title}
                      >
                        {formatTimeShort(task.dueDate!) && (
                          <span className="calendar-chip-time">{formatTimeShort(task.dueDate!)}</span>
                        )}
                        {task.title}
                      </Link>
                    ))}
                    {overflow > 0 && (
                      <button className="calendar-chip-more" onClick={() => setSelectedDayKey(key)}>
                        +{overflow} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedDayKey && (
        <div className="share-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDayKey(null); }}>
          <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-day-title">
            <header>
              <div>
                <h2 id="calendar-day-title">
                  {parseDateKey(selectedDayKey).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                </h2>
                <p>{selectedTasks.length} task{selectedTasks.length === 1 ? "" : "s"} due</p>
              </div>
              <button onClick={() => setSelectedDayKey(null)} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div>
              {selectedTasks.map((task) => (
                <Link
                  href={`/tasks/${task.id}`}
                  className="activity-row"
                  key={task.id}
                  onClick={() => setSelectedDayKey(null)}
                >
                  <span
                    className="color-dot"
                    style={{ background: (task.projectId && projectColor.get(task.projectId)) || "var(--line)" }}
                  />
                  <div>
                    <strong>{task.title}</strong>
                    <small>{task.priority}</small>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
