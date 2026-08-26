"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import * as chatApi from "@/lib/api/chat.api";

export default function Chat() {
  const router = useRouter();
  const [empty, setEmpty] = useState(false);

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

  if (!empty) return <AppShell title="Messages"><div className="page">Loading conversations…</div></AppShell>;

  return <AppShell title="Messages"><div className="page narrow"><section className="card">
    <h3>No conversations yet</h3>
    <p className="quiet">Start a conversation from the workspace overview to see it here.</p>
  </section></div></AppShell>;
}
