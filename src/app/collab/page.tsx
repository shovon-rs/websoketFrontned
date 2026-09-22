"use client";
import { AppShell } from "@/components/AppShell";
import { PageShimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as documentsApi from "@/lib/api/documents.api";
import { useAuth } from "@/lib/auth-context";
import { EASE_OUT, dialogBackdrop, dialogPanel, staggerContainer, staggerItem, tapScale } from "@/lib/motion";
import type { DocumentSummary } from "@/lib/types";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Globe2, PenSquare, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const MotionLink = motion(Link);

const ROLE_LABEL: Record<DocumentSummary["role"], string> = {
  owner: "Owner",
  editor: "Editor",
  viewer: "Viewer",
};

function formatUpdatedAt(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Updated ${days}d ago`;
  return `Updated on ${new Date(iso).toLocaleDateString()}`;
}

function DocumentRow({ doc }: { doc: DocumentSummary }) {
  return (
    <MotionLink
      href={`/collab/${doc.id}`}
      className="project-card"
      key={doc.id}
      title={new Date(doc.updatedAt).toLocaleString()}
      variants={staggerItem}
      whileTap={tapScale}
    >
      <div className="project-card-head">
        <FileText size={16} />
        <strong>{doc.title || "Untitled document"}</strong>
      </div>
      <div className="project-card-stats">
        <span className={`priority-badge ${doc.role === "owner" ? "urgent" : doc.role === "editor" ? "medium" : "low"}`}>
          {ROLE_LABEL[doc.role]}
        </span>
        {doc.visibility === "public" && (
          <span className="priority-badge medium">
            <Globe2 size={10} /> Public
          </span>
        )}
        <span className="quiet">{formatUpdatedAt(doc.updatedAt)}</span>
      </div>
    </MotionLink>
  );
}

function DocumentSection({ title, docs, index }: { title: string; docs: DocumentSummary[]; index: number }) {
  if (docs.length === 0) return null;
  return (
    <motion.section
      style={{ marginTop: 22 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE_OUT, delay: index * 0.12 }}
    >
      <h3 style={{ margin: "0 0 10px" }}>{title}</h3>
      <motion.div className="project-grid" variants={staggerContainer} initial="hidden" animate="visible">
        {docs.map((doc) => (
          <DocumentRow doc={doc} key={doc.id} />
        ))}
      </motion.div>
    </motion.section>
  );
}

export default function CollabListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  function load() {
    documentsApi
      .listDocuments()
      .then(setDocuments)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load documents."));
  }

  useEffect(load, []);

  async function onCreate(title: string) {
    setCreating(true);
    try {
      const doc = await documentsApi.createDocument(title || "Untitled document");
      router.push(`/collab/${doc.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the document.");
      setCreating(false);
    }
  }

  const { owned, shared, discoverable } = useMemo(() => {
    const owned: DocumentSummary[] = [];
    const shared: DocumentSummary[] = [];
    const discoverable: DocumentSummary[] = [];
    for (const doc of documents ?? []) {
      if (doc.ownerId === user?.id) owned.push(doc);
      else if (doc.role !== "viewer" || doc.visibility !== "public") shared.push(doc);
      else discoverable.push(doc);
    }
    return { owned, shared, discoverable };
  }, [documents, user?.id]);

  return (
    <AppShell title="Documents" subtitle="Write together in real time.">
      <div className="page narrow">
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <motion.section
          className="card doc-cta-card"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.36, ease: EASE_OUT }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#fbe9e4",
                color: "#c45138",
                flexShrink: 0,
              }}
            >
              <PenSquare size={22} />
            </span>
            <div>
              <h3 style={{ margin: "0 0 4px" }}>Write a document</h3>
              <p className="quiet" style={{ margin: 0 }}>
                Start a new document and invite your team to write together in real time.
              </p>
            </div>
          </div>
          <motion.button className="primary doc-cta-btn" onClick={() => setCreateOpen(true)} whileTap={tapScale} whileHover={{ scale: 1.03 }}>
            <Plus size={16} /> New document
          </motion.button>
        </motion.section>

        {!documents && !error && <PageShimmer variant="cards" />}

        {documents && documents.length === 0 && (
          <section className="card" style={{ marginTop: 22 }}>
            <div className="empty-state">
              <FileText size={26} />
              <p className="quiet">No documents yet. Create one to start writing with your team.</p>
            </div>
          </section>
        )}

        {documents && documents.length > 0 && (
          <>
            <DocumentSection title="Your documents" docs={owned} index={0} />
            <DocumentSection title="Shared with you" docs={shared} index={1} />
            <DocumentSection title="Public documents" docs={discoverable} index={2} />
          </>
        )}
      </div>

      <AnimatePresence>
        {createOpen && (
          <motion.div
            className="share-backdrop"
            variants={dialogBackdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setCreateOpen(false);
            }}
          >
            <motion.section
              className="share-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-document-title"
              variants={dialogPanel}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <header>
                <div>
                  <h2 id="create-document-title">New document</h2>
                  <p>Give it a title to get started — you can rename it later.</p>
                </div>
                <button onClick={() => setCreateOpen(false)} aria-label="Close create document dialog">
                  <X size={18} />
                </button>
              </header>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  onCreate(String(form.get("title") ?? "").trim());
                }}
              >
                <label>
                  Title
                  <input name="title" placeholder="Untitled document" maxLength={200} autoFocus />
                </label>
                <button className="primary wide" disabled={creating}>
                  {creating ? "Creating…" : "Create document"}
                </button>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
