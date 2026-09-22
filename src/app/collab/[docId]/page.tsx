"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { PageShimmer } from "@/components/Shimmer";
import { UserSearchDropdown } from "@/components/UserSearchDropdown";
import { ApiError } from "@/lib/api-client";
import * as documentsApi from "@/lib/api/documents.api";
import { useAuth } from "@/lib/auth-context";
import { isManager } from "@/lib/roles";
import { EASE_OUT, dialogBackdrop, dialogPanel, staggerContainer, staggerItem, tapScale } from "@/lib/motion";
import type { DocumentCollaborator, DocumentRecord, DocumentVersionFull, DocumentVersionSummary, DocumentVisibility, User } from "@/lib/types";
import { bytesToBase64, useDocumentSync } from "@/lib/yjs-ws-binding";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bold,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileDown,
  FileText,
  Globe2,
  History,
  Italic,
  Lock,
  List,
  ListOrdered,
  Redo,
  Save,
  Share2,
  Trash2,
  Undo,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";

const CHECKPOINT_INTERVAL_MS = 30_000;
const TITLE_DEBOUNCE_MS = 800;

const AVATAR_PALETTE = ["coral", "blue", "violet", "gold", "green"];
const CARET_PALETTE = ["#ff6f4f", "#3a6fd8", "#a75fd1", "#d4a017", "#2f7d5a", "#d94f42"];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function caretColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CARET_PALETTE[hash % CARET_PALETTE.length];
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export default function Collab({ params }: { params: { docId: string } }) {
  const router = useRouter();
  const docId = params.docId === "new" ? null : params.docId;

  // Creating a fresh document from the dashboard's "Create document" quick action.
  useEffect(() => {
    if (params.docId !== "new") return;
    documentsApi.createDocument("Untitled document").then((doc) => router.replace(`/collab/${doc.id}`));
  }, [params.docId, router]);

  if (!docId) return <AppShell title="Documents"><PageShimmer variant="document" /></AppShell>;

  // Keyed so navigating between two different documents (docId changes without an unmount)
  // fully re-initializes the Yjs sync state instead of reusing a stale Y.Doc.
  return <DocumentWorkspace key={docId} docId={docId} />;
}

function DocumentWorkspace({ docId }: { docId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const sync = useDocumentSync(docId);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [titleSaved, setTitleSaved] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!downloadOpen) return undefined;
    function onClickOutside(event: MouseEvent) {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setDownloadOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [downloadOpen]);

  useEffect(() => {
    documentsApi.getDocument(docId).then(
      (record) => {
        setDoc(record);
        setTitle(record.title);
      },
      (err) => {
        if (err instanceof ApiError && err.status === 404) router.replace("/collab/new");
        else setError(err instanceof ApiError ? err.message : "Could not load this document.");
      },
    );
  }, [docId, router]);

  const role = doc?.role ?? sync.role ?? "viewer";
  const canEdit = role === "owner" || role === "editor";
  const canManage = role === "owner" || isManager(user?.role);

  // The Y.Doc/Awareness pair is created asynchronously (see yjs-ws-binding.ts — deliberately not
  // synchronous with mount, so React Strict Mode's dev double-invoke can't destroy the only
  // copy). Key the editor on a value that changes from "pending" to a real key only once both
  // exist, so it's recreated with the Collaboration extension properly bound the moment they're
  // ready, instead of ever being constructed against a null document.
  const docReady = Boolean(sync.ydoc && sync.awareness);
  const editorKey = docReady ? `ready-${sync.resetKey}` : "pending";

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: canEdit && docReady,
      extensions: [
        StarterKit.configure({ undoRedo: false }),
        ...(sync.ydoc && sync.awareness
          ? [
              Collaboration.configure({ document: sync.ydoc }),
              CollaborationCaret.configure({
                provider: { awareness: sync.awareness },
                user: { name: user?.displayName ?? "Someone", color: caretColorFor(user?.id ?? "") },
              }),
            ]
          : []),
        Placeholder.configure({ placeholder: docReady ? "Start writing…" : "Loading…" }),
      ],
      onUpdate: () => setDirty(true),
    },
    [editorKey],
  );

  useEffect(() => {
    editor?.setEditable(canEdit);
  }, [editor, canEdit]);

  const toolbarState = useEditorState({
    editor,
    selector: (ctx) =>
      ctx.editor
        ? {
            bold: ctx.editor.isActive("bold"),
            italic: ctx.editor.isActive("italic"),
            bulletList: ctx.editor.isActive("bulletList"),
            orderedList: ctx.editor.isActive("orderedList"),
          }
        : { bold: false, italic: false, bulletList: false, orderedList: false },
  });

  async function saveCheckpoint() {
    if (!editor || !canEdit || !sync.ydoc) return;
    try {
      const state = bytesToBase64(Y.encodeStateAsUpdate(sync.ydoc));
      await documentsApi.saveVersion(docId, title, editor.getHTML(), state);
      setDirty(false);
    } catch {
      // A missed periodic checkpoint isn't user-facing — the next dirty tick or manual save retries.
    }
  }

  useEffect(() => {
    if (!canEdit) return undefined;
    const timer = setInterval(() => {
      if (dirty) saveCheckpoint();
    }, CHECKPOINT_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, canEdit, docId, title]);

  function onTitleChange(value: string) {
    setTitle(value);
    setTitleSaved(false);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => flushTitle(value), TITLE_DEBOUNCE_MS);
  }

  async function flushTitle(value: string) {
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    try {
      await documentsApi.updateTitle(docId, value || "Untitled document");
      setTitleSaved(true);
    } catch {
      setTitleSaved(true); // don't block the UI on a title-save failure; the value is still shown
    }
  }

  async function onDelete() {
    setDeleting(true);
    try {
      await documentsApi.deleteDocument(docId);
      router.replace("/collab");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this document.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function onDownloadDocx() {
    if (!editor) return;
    setDownloading(true);
    try {
      const { downloadAsDocx } = await import("@/lib/document-export");
      await downloadAsDocx(editor, title);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate the Word document.");
    } finally {
      setDownloading(false);
      setDownloadOpen(false);
    }
  }

  async function onDownloadPdf() {
    const element = editorContentRef.current;
    if (!element) return;
    setDownloading(true);
    try {
      const { downloadAsPdf } = await import("@/lib/document-export");
      await downloadAsPdf(element, title);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate the PDF.");
    } finally {
      setDownloading(false);
      setDownloadOpen(false);
    }
  }

  const presenceEntries = useMemo(() => Array.from(sync.presence.entries()), [sync.presence]);
  const prefersReducedMotion = useReducedMotion();

  if (notFound) {
    return (
      <AppShell title="Document not found">
        <div className="page narrow">
          <section className="card">
            <p className="quiet">This document doesn&rsquo;t exist, or you don&rsquo;t have access to it.</p>
          </section>
        </div>
      </AppShell>
    );
  }

  if (!doc || !sync.ready || !editor) {
    return <AppShell title="Documents"><PageShimmer variant="document" /></AppShell>;
  }

  return (
    <AppShell
      title="Documents"
      actions={
        <>
          <button className="plain small" onClick={() => setHistoryOpen(true)}>
            <History size={14} /> History
          </button>
          {canEdit && (
            <button className="plain small" onClick={saveCheckpoint}>
              <Save size={14} /> Save version
            </button>
          )}
          <div style={{ position: "relative" }} ref={downloadMenuRef}>
            <button className="plain small" disabled={downloading} onClick={() => setDownloadOpen((open) => !open)}>
              <Download size={14} /> {downloading ? "Preparing…" : "Download"} <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {downloadOpen && (
                <motion.div
                  className="download-menu"
                  role="menu"
                  initial={{ opacity: 0, scale: 0.94, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -2, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                >
                  <button role="menuitem" onClick={onDownloadPdf}>
                    <FileText size={14} /> Download as PDF
                  </button>
                  <button role="menuitem" onClick={onDownloadDocx}>
                    <FileDown size={14} /> Download as Word (.docx)
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {canManage && (
            <button className="primary small" onClick={() => setShareOpen(true)}>
              <Share2 size={14} /> Share
            </button>
          )}
          {canManage && (
            <button className="danger small" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={14} /> Delete
            </button>
          )}
        </>
      }
    >
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-shell">
        <div className="editor-top">
          <div>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={(e) => flushTitle(e.target.value)}
              disabled={!canManage && !canEdit}
              aria-label="Document title"
            />
            <small style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
              <i /> <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={titleSaved ? "saved" : "saving"}
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 2 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  style={{ display: "inline-block" }}
                >
                  {titleSaved ? "Saved" : "Saving…"}
                </motion.span>
              </AnimatePresence>
              {" · "}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={doc.visibility}
                  className={`priority-badge ${doc.visibility === "public" ? "medium" : "low"}`}
                  style={{ marginLeft: 4 }}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  {doc.visibility === "public" ? <Globe2 size={10} /> : <Lock size={10} />}{" "}
                  {doc.visibility === "public" ? "Public" : "Private"}
                </motion.span>
              </AnimatePresence>
            </small>
          </div>
          <div className="editor-people">
            <AnimatePresence initial={false}>
              {presenceEntries.slice(0, 4).map(([id, name], index) =>
                prefersReducedMotion ? (
                  <Avatar key={id} initials={initialsOf(name)} color={colorFor(id)} size="sm" />
                ) : (
                  <motion.div
                    key={id}
                    layout
                    initial={{ opacity: 0, scale: 0.6, x: 8 }}
                    animate={{ opacity: 1, scale: 1, x: 0, transition: { duration: 0.28, ease: EASE_OUT, delay: index * 0.04 } }}
                    exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.15 } }}
                    style={{ display: "inline-flex" }}
                  >
                    <Avatar initials={initialsOf(name)} color={colorFor(id)} size="sm" />
                  </motion.div>
                ),
              )}
            </AnimatePresence>
            {presenceEntries.length > 4 && <span>+{presenceEntries.length - 4}</span>}
          </div>
        </div>
        {canEdit && (
          <div className="toolbar">
            <motion.button aria-label="Undo" whileTap={tapScale} onClick={() => editor.chain().focus().undo().run()}>
              <Undo />
            </motion.button>
            <motion.button aria-label="Redo" whileTap={tapScale} onClick={() => editor.chain().focus().redo().run()}>
              <Redo />
            </motion.button>
            <i />
            <motion.button
              aria-label="Bold"
              aria-pressed={toolbarState?.bold}
              className={toolbarState?.bold ? "is-active" : ""}
              whileTap={tapScale}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              <Bold />
            </motion.button>
            <motion.button
              aria-label="Italic"
              aria-pressed={toolbarState?.italic}
              className={toolbarState?.italic ? "is-active" : ""}
              whileTap={tapScale}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              <Italic />
            </motion.button>
            <motion.button
              aria-label="Bullet list"
              aria-pressed={toolbarState?.bulletList}
              className={toolbarState?.bulletList ? "is-active" : ""}
              whileTap={tapScale}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <List />
            </motion.button>
            <motion.button
              aria-label="Ordered list"
              aria-pressed={toolbarState?.orderedList}
              className={toolbarState?.orderedList ? "is-active" : ""}
              whileTap={tapScale}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered />
            </motion.button>
          </div>
        )}
        <EditorContent editor={editor} className="document" ref={editorContentRef} />
      </div>

      <AnimatePresence>
        {shareOpen && (
          <ShareDialog
            doc={doc}
            canManage={canManage}
            onClose={() => setShareOpen(false)}
            onUpdated={setDoc}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {historyOpen && (
          <HistoryDialog
            docId={docId}
            canRestore={canManage}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteOpen && (
          <motion.div
            className="share-backdrop"
            variants={dialogBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteOpen(false); }}
          >
            <motion.section
              className="share-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-document-title"
              variants={dialogPanel}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <header>
                <div>
                  <h2 id="delete-document-title">Delete document?</h2>
                  <p>&ldquo;{title || "Untitled document"}&rdquo; and all of its history will be permanently deleted. This cannot be undone.</p>
                </div>
                <button onClick={() => setDeleteOpen(false)} aria-label="Close delete confirmation" disabled={deleting}>
                  <X size={18} />
                </button>
              </header>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button className="plain wide" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                  Cancel
                </button>
                <button className="danger wide" onClick={onDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function ShareDialog({
  doc,
  canManage,
  onClose,
  onUpdated,
}: {
  doc: DocumentRecord;
  canManage: boolean;
  onClose: () => void;
  onUpdated: (doc: DocumentRecord) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [visibilityPending, setVisibilityPending] = useState(false);

  async function onVisibilityChange(visibility: DocumentVisibility) {
    if (!canManage || visibility === doc.visibility) return;
    setError(null);
    setVisibilityPending(true);
    try {
      const updated = await documentsApi.updateVisibility(doc.id, visibility);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change the document's visibility.");
    } finally {
      setVisibilityPending(false);
    }
  }

  async function onAdd(candidate: User) {
    if (doc.collaborators.some((c) => c.userId === candidate.id) || candidate.id === doc.ownerId) return;
    setError(null);
    setPendingId(candidate.id);
    try {
      await documentsApi.addCollaborator(doc.id, candidate.id, "editor");
      const added: DocumentCollaborator = {
        id: candidate.id,
        userId: candidate.id,
        displayName: candidate.displayName,
        email: candidate.email,
        role: "editor",
      };
      onUpdated({ ...doc, collaborators: [...doc.collaborators, added] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add that collaborator.");
    } finally {
      setPendingId(null);
    }
  }

  async function onRoleChange(userId: string, role: "editor" | "viewer") {
    setError(null);
    setPendingId(userId);
    try {
      await documentsApi.updateCollaboratorRole(doc.id, userId, role);
      onUpdated({
        ...doc,
        collaborators: doc.collaborators.map((c) => (c.userId === userId ? { ...c, role } : c)),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change that collaborator's role.");
    } finally {
      setPendingId(null);
    }
  }

  async function onRemove(userId: string) {
    setError(null);
    setPendingId(userId);
    try {
      await documentsApi.removeCollaborator(doc.id, userId);
      onUpdated({ ...doc, collaborators: doc.collaborators.filter((c) => c.userId !== userId) });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not remove that collaborator.");
    } finally {
      setPendingId(null);
    }
  }

  async function copyLink() {
    setError(null);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link. Select it and copy it manually.");
    }
  }

  return (
    <motion.div
      className="share-backdrop"
      variants={dialogBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-share-title"
        variants={dialogPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header>
          <div>
            <h2 id="doc-share-title">Share document</h2>
            <p>
              {doc.visibility === "public"
                ? "Anyone on the platform can view this document. Only the owner and editors below can edit it."
                : "Only people added below (plus the owner) can open this document."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close share dialog">
            <X size={18} />
          </button>
        </header>

        <div style={{ marginBottom: 16 }}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 7 }}>Visibility</span>
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button
              type="button"
              className={doc.visibility === "private" ? "primary small" : "plain small"}
              disabled={!canManage || visibilityPending}
              onClick={() => onVisibilityChange("private")}
              aria-pressed={doc.visibility === "private"}
              whileTap={tapScale}
            >
              <Lock size={14} /> Private
            </motion.button>
            <motion.button
              type="button"
              className={doc.visibility === "public" ? "primary small" : "plain small"}
              disabled={!canManage || visibilityPending}
              onClick={() => onVisibilityChange("public")}
              aria-pressed={doc.visibility === "public"}
              whileTap={tapScale}
            >
              <Globe2 size={14} /> Public
            </motion.button>
          </div>
          {!canManage && <p className="quiet" style={{ marginTop: 6 }}>Only the owner or a manager can change visibility.</p>}
        </div>

        <label>
          Document link
          <div>
            <input value={typeof window === "undefined" ? "" : window.location.href} readOnly onFocus={(event) => event.currentTarget.select()} />
            <button onClick={copyLink}>{copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}</button>
          </div>
        </label>

        {error && (
          <p className="share-error" role="alert">
            {error}
          </p>
        )}

        <div style={{ marginTop: 16 }}>
          {doc.collaborators.length === 0 && <p className="quiet">No collaborators yet — just you.</p>}
          <AnimatePresence initial={false}>
            {doc.collaborators.map((c) => (
              <motion.div
                className="activity-row"
                key={c.userId}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
              >
                <Avatar initials={initialsOf(c.displayName)} color={colorFor(c.userId)} size="sm" />
                <div>
                  <strong>{c.displayName}</strong>
                  <small>{c.email}</small>
                </div>
                <select
                  className="role-select"
                  value={c.role}
                  disabled={pendingId === c.userId}
                  onChange={(e) => onRoleChange(c.userId, e.target.value as "editor" | "viewer")}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button className="danger small" disabled={pendingId === c.userId} onClick={() => onRemove(c.userId)}>
                  Remove
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div style={{ marginTop: 16 }}>
          <label>
            Add a collaborator
            <div style={{ marginTop: 7 }}>
              <UserSearchDropdown onSelect={onAdd} placeholder="Search by name or email…" />
            </div>
          </label>
        </div>
      </motion.section>
    </motion.div>
  );
}

function HistoryDialog({
  docId,
  canRestore,
  onClose,
}: {
  docId: string;
  canRestore: boolean;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<DocumentVersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentVersionFull | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [restoredId, setRestoredId] = useState<string | null>(null);

  useEffect(() => {
    documentsApi
      .listVersions(docId)
      .then(setVersions)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load version history."));
  }, [docId]);

  async function onPreview(versionId: string) {
    setError(null);
    try {
      const full = await documentsApi.getVersion(docId, versionId);
      setPreview(full);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load that version.");
    }
  }

  async function onRestore(versionId: string) {
    if (!window.confirm("Restore this version? The document will reset to this point for everyone currently viewing it.")) return;
    setPendingId(versionId);
    setError(null);
    try {
      await documentsApi.restoreVersion(docId, versionId);
      // The resulting document:restored WS event is what actually resets the live editor. Show a
      // brief confirming state before closing so the restore reads as a deliberate action, not an
      // instant snap.
      setRestoredId(versionId);
      setPendingId(null);
      setTimeout(() => {
        setPreview(null);
        onClose();
      }, 550);
      return;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not restore that version.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <motion.div
      className="share-backdrop"
      variants={dialogBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section
        className="share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-history-title"
        variants={dialogPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <header>
          <div>
            <h2 id="doc-history-title">Version history</h2>
            <p>Checkpoints saved automatically and manually as this document is edited.</p>
          </div>
          <button onClick={onClose} aria-label="Close history dialog">
            <X size={18} />
          </button>
        </header>

        {error && (
          <p className="share-error" role="alert">
            {error}
          </p>
        )}

        {preview ? (
          <div>
            <button className="plain small" onClick={() => setPreview(null)} style={{ marginBottom: 10 }}>
              &larr; Back to versions
            </button>
            <div className="version-preview" dangerouslySetInnerHTML={{ __html: preview.html }} />
            {canRestore && (
              <motion.button
                className="primary wide"
                style={{ marginTop: 12 }}
                disabled={pendingId === preview.id || restoredId === preview.id}
                onClick={() => onRestore(preview.id)}
                whileTap={tapScale}
                animate={restoredId === preview.id ? { scale: [1, 1.03, 1] } : {}}
                transition={{ duration: 0.3, ease: EASE_OUT }}
              >
                {restoredId === preview.id ? <><Check size={14} /> Restored</> : "Restore this version"}
              </motion.button>
            )}
          </div>
        ) : (
          <motion.div style={{ marginTop: 8 }} variants={staggerContainer} initial="hidden" animate="visible">
            {versions === null && <p className="quiet">Loading…</p>}
            {versions?.length === 0 && <p className="quiet">No saved versions yet.</p>}
            {versions?.map((v) => (
              <motion.div className="activity-row" key={v.id} variants={staggerItem}>
                <Avatar initials={initialsOf(v.author.displayName)} color={colorFor(v.authorId)} size="sm" />
                <div>
                  <strong>{v.title || "Untitled document"}</strong>
                  <small>
                    {v.author.displayName} &middot; {new Date(v.createdAt).toLocaleString()}
                  </small>
                </div>
                <button className="plain small" onClick={() => onPreview(v.id)}>
                  Preview
                </button>
                {canRestore && (
                  <motion.button
                    className="danger small"
                    disabled={pendingId === v.id || restoredId === v.id}
                    onClick={() => onRestore(v.id)}
                    whileTap={tapScale}
                    animate={restoredId === v.id ? { scale: [1, 1.06, 1] } : {}}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                  >
                    {restoredId === v.id ? <><Check size={12} /> Restored</> : "Restore"}
                  </motion.button>
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </motion.section>
    </motion.div>
  );
}
