export function Avatar({ initials, color = "green", online, size = "md", src }: { initials: string; color?: string; online?: boolean; size?: "sm" | "md" | "lg"; src?: string | null }) {
  return <span className={`avatar avatar-${color} avatar-${size}`}>
    {src ? <img src={src} alt="" className="avatar-img" /> : <span>{initials}</span>}
    {online !== undefined && <i className={online ? "online" : "offline"} />}
  </span>;
}
