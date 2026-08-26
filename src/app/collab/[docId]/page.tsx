"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Bold, Italic, Link as LinkIcon, List, MessageSquare, Redo, Share2, Undo } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";
import * as documentsApi from "@/lib/api/documents.api";
import { ApiError } from "@/lib/api-client";

const SAVE_DEBOUNCE_MS = 800;

export default function Collab({ params }: { params: { docId: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const { status: wsStatus, send, subscribe } = useWs();
  const docId = params.docId === "new" ? null : params.docId;
  const [title, setTitle] = useState("Untitled document");
  const [saved, setSaved] = useState(true);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const articleRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteRef = useRef(false);

  // Creating a fresh document from the dashboard's "Create document" quick action.
  useEffect(() => {
    if (params.docId !== "new") return;
    documentsApi.createDocument("Untitled document").then((doc) => router.replace(`/collab/${doc.id}`));
  }, [params.docId, router]);

  useEffect(() => {
    if (!docId) return;
    documentsApi.getDocument(docId).then(
      (doc) => {
        setTitle(doc.title);
        if (articleRef.current) articleRef.current.innerHTML = doc.content || "<p>Start writing…</p>";
      },
      (err) => {
        // Stale/invalid document link (e.g. the sidebar's placeholder) — start a fresh one instead.
        if (err instanceof ApiError && err.status === 404) router.replace("/collab/new");
      },
    );
  }, [docId]);

  useEffect(() => {
    if (wsStatus === "connected" && docId) send("document:join", { documentId: docId });
  }, [wsStatus, docId, send]);

  useEffect(() => {
    if (!docId) return undefined;

    const offState = subscribe("document:state", (event) => {
      const payload = event.payload as { content: string };
      if (articleRef.current) articleRef.current.innerHTML = payload.content || "<p>Start writing…</p>";
    });

    const offUpdate = subscribe("document:update", (event) => {
      const payload = event.payload as { documentId: string; content: string; authorId: string };
      if (payload.documentId !== docId || payload.authorId === user?.id) return;
      applyingRemoteRef.current = true;
      if (articleRef.current) articleRef.current.innerHTML = payload.content;
      applyingRemoteRef.current = false;
      setSaved(true);
    });

    const offCursor = subscribe("document:cursor", (event) => {
      const payload = event.payload as { documentId: string; userId: string };
      if (payload.documentId !== docId || payload.userId === user?.id) return;
      setCollaborators((prev) => (prev.includes(payload.userId) ? prev : [...prev, payload.userId]));
    });

    return () => {
      offState();
      offUpdate();
      offCursor();
      send("document:leave", { documentId: docId });
    };
  }, [docId, subscribe, send, user]);

  function onEdit() {
    if (applyingRemoteRef.current || !docId) return;
    setSaved(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      send("document:update", { documentId: docId, content: articleRef.current?.innerHTML ?? "" });
      setSaved(true);
    }, SAVE_DEBOUNCE_MS);
  }

  if (!docId) return <AppShell title="Documents"><div className="page">Creating your document…</div></AppShell>;

  return <AppShell title="Documents" actions={<button className="primary small"><Share2/> Share</button>}>
    <div className="editor-shell">
      <div className="editor-top">
        <div><input value={title} onChange={(e) => { setTitle(e.target.value); onEdit(); }}/><small><i/> {saved ? "Saved" : "Saving…"}</small></div>
        <div className="editor-people">{collaborators.slice(0, 3).map((id) => <Avatar key={id} initials="•" color="coral" size="sm"/>)}{collaborators.length > 3 && <span>+{collaborators.length - 3}</span>}</div>
      </div>
      <div className="toolbar"><button><Undo/></button><button><Redo/></button><i/><button><Bold/></button><button><Italic/></button><button><LinkIcon/></button><button><List/></button><span>Normal text⌄</span></div>
      <article className="document" ref={articleRef} contentEditable suppressContentEditableWarning onInput={onEdit}>
        <p>Start writing…</p>
      </article>
      <aside className="comment-bubble"><MessageSquare/><span><strong>Tip</strong><small>Edits sync live to everyone viewing this document.</small></span></aside>
    </div>
  </AppShell>;
}
