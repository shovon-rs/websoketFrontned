import type { Role } from "./types";

const ROLE_RANK: Record<Role, number> = { user: 0, manager: 1, admin: 2, super_admin: 3 };

export function hasRole(role: Role | undefined, min: Role): boolean {
  return ROLE_RANK[role ?? "user"] >= ROLE_RANK[min];
}

export function isManager(role: Role | undefined): boolean {
  return hasRole(role, "manager");
}

export function isAdmin(role: Role | undefined): boolean {
  return hasRole(role, "admin");
}

export function isSuperAdmin(role: Role | undefined): boolean {
  return hasRole(role, "super_admin");
}
