"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { UserSearchDropdown } from "@/components/UserSearchDropdown";
import { ApiError } from "@/lib/api-client";
import * as chatApi from "@/lib/api/chat.api";
import type { User } from "@/lib/types";

export default function Chat() {
  const router = useRouter();
  const [empty, setEmpty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    chatApi.listConversations().then((conversations) => {
      if (cancelled) return;
      if (conversations.length > 0) router.replace(`/chat/${conversations[0].id}`);
      else setEmpty(true);
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function startConversation(recipient: User) {
    setError(null);
    setCreating(true);
    try {
      const conversation = await chatApi.createConversation({ memberIds: [recipient.id], type: "direct" });
      router.push(`/chat/${conversation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the conversation. Please try again.");
      setCreating(false);
    }
  }

  if (!empty) return <AppShell title="Messages"><div className="page">Loading conversations…</div></AppShell>;

  return <AppShell title="Messages"><div className="page narrow"><section className="card">
    <h3>No conversations yet</h3>
    <p className="quiet">Search for a teammate to start your first conversation.</p>
    <div style={{ margin: "16px 0" }}>
      <UserSearchDropdown onSelect={startConversation} placeholder="Search people by name or email…" autoFocus disabled={creating} />
    </div>
    {error && <p className="auth-error">{error}</p>}
  </section></div></AppShell>;
}
