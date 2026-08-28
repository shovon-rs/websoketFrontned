"use client";
import { X } from "lucide-react";
import { Avatar } from "./Avatar";
import { UserSearchDropdown } from "./UserSearchDropdown";
import type { User } from "@/lib/types";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface UserMultiSelectProps {
  selected: User[];
  onChange: (users: User[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function UserMultiSelect({ selected, onChange, placeholder, disabled }: UserMultiSelectProps) {
  function handlePick(user: User) {
    if (selected.some((u) => u.id === user.id)) return;
    onChange([...selected, user]);
  }

  function remove(userId: string) {
    onChange(selected.filter((u) => u.id !== userId));
  }

  return (
    <div className="user-multiselect">
      <UserSearchDropdown onSelect={handlePick} placeholder={placeholder} disabled={disabled} />
      {selected.length === 0 ? (
        <p className="quiet" style={{ marginTop: 8 }}>No one invited yet — search above to add people.</p>
      ) : (
        <div className="chip-list">
          {selected.map((user) => (
            <span className="chip" key={user.id}>
              <Avatar initials={initialsOf(user.displayName)} color="blue" size="sm" src={user.avatarUrl} />
              {user.displayName}
              <button type="button" aria-label={`Remove ${user.displayName}`} onClick={() => remove(user.id)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
