"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { PageShimmer } from "@/components/Shimmer";
import { Bold, Check, Copy, Italic, Link as LinkIcon, List, MessageSquare, Redo, Share2, Undo, X } from "lucide-react";
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
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
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

  async function copyShareLink() {
    setShareError(null);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError("Could not copy the link. Select it and copy it manually.");
    }
  }

  async function shareDocument() {
    if (!navigator.share) {
      await copyShareLink();
      return;
    }
    try {
      await navigator.share({ title, text: `Collaborate with me on “${title}”`, url: window.location.href });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setShareError("This device could not open the share menu. You can copy the link instead.");
    }
  }

  if (!docId) return <AppShell title="Documents"><PageShimmer variant="document" /></AppShell>;

  return <AppShell title="Documents" actions={<button className="primary small" onClick={() => { setShareOpen(true); setCopied(false); setShareError(null); }}><Share2/> Share</button>}>
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
    {shareOpen && <div className="share-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false); }}>
      <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <header><div><h2 id="share-title">Share document</h2><p>Anyone signed in with this link can view and edit this document.</p></div><button onClick={() => setShareOpen(false)} aria-label="Close share dialog"><X size={18}/></button></header>
        <label>Document link<div><input value={typeof window === "undefined" ? "" : window.location.href} readOnly onFocus={(event) => event.currentTarget.select()}/><button onClick={copyShareLink}>{copied ? <Check size={16}/> : <Copy size={16}/>} {copied ? "Copied" : "Copy"}</button></div></label>
        {shareError && <p className="share-error" role="alert">{shareError}</p>}
        {typeof navigator !== "undefined" && typeof navigator.share === "function" && <button className="primary wide" onClick={shareDocument}><Share2 size={16}/> Share via another app</button>}
      </section>
    </div>}
  </AppShell>;
}
