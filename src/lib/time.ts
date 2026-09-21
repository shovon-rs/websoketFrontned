export function formatOnlineDuration(sinceIso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 60000));
  if (minutes < 1) return "Online just now";
  if (minutes < 60) return `Online for ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Online for ${hours}h ${minutes % 60}m`;
  return `Online for ${Math.floor(hours / 24)}d`;
}

export function formatDueDate(iso: string): string {
  const date = new Date(iso);
  const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  return hasTime
    ? date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString(undefined, { dateStyle: "medium" } as Intl.DateTimeFormatOptions);
}

/** Short local time (e.g. "3:30 PM"), or "" when the timestamp falls exactly at local midnight
 * (treated as a date-only due date with no meaningful time component). */
export function formatTimeShort(iso: string): string {
  const date = new Date(iso);
  if (date.getHours() === 0 && date.getMinutes() === 0) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** For a `<input type="datetime-local">`'s `value`/`defaultValue`: local "YYYY-MM-DDTHH:mm". */
export function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatLastSeen(iso: string | null): string {
  if (!iso) return "Never active";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Active just now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Active ${days}d ago`;
  return `Active on ${new Date(iso).toLocaleDateString()}`;
}
