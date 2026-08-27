export function formatOnlineDuration(sinceIso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(sinceIso).getTime()) / 60000));
  if (minutes < 1) return "Online just now";
  if (minutes < 60) return `Online for ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Online for ${hours}h ${minutes % 60}m`;
  return `Online for ${Math.floor(hours / 24)}d`;
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
