export function Avatar({ initials, color = "green", online, size = "md" }: { initials: string; color?: string; online?: boolean; size?: "sm" | "md" | "lg" }) {
  return <span className={`avatar avatar-${color} avatar-${size}`}><span>{initials}</span>{online !== undefined && <i className={online ? "online" : "offline"} />}</span>;
}
