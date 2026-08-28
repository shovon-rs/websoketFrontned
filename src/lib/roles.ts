import type { Role } from "./types";

const ROLE_RANK: Record<Role, number> = { user: 0, admin: 1, super_admin: 2 };

export function hasRole(role: Role | undefined, min: Role): boolean {
  return ROLE_RANK[role ?? "user"] >= ROLE_RANK[min];
}

export function isAdmin(role: Role | undefined): boolean {
  return hasRole(role, "admin");
}

export function isSuperAdmin(role: Role | undefined): boolean {
  return hasRole(role, "super_admin");
}
