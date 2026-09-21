"use client";
import { AppShell } from "@/components/AppShell";
import { PageShimmer } from "@/components/Shimmer";
import { ApiError } from "@/lib/api-client";
import * as documentsApi from "@/lib/api/documents.api";
import { useAuth } from "@/lib/auth-context";
import type { DocumentSummary } from "@/lib/types";
import { FileText, Globe2, PenSquare, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
    <Link href={`/collab/${doc.id}`} className="project-card" key={doc.id} title={new Date(doc.updatedAt).toLocaleString()}>
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
    </Link>
  );
}

function DocumentSection({ title, docs }: { title: string; docs: DocumentSummary[] }) {
  if (docs.length === 0) return null;
  return (
    <section style={{ marginTop: 22 }}>
      <h3 style={{ margin: "0 0 10px" }}>{title}</h3>
      <div className="project-grid">
        {docs.map((doc) => (
          <DocumentRow doc={doc} key={doc.id} />
        ))}
      </div>
    </section>
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

        <section className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
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
          <button className="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> New document
          </button>
        </section>

        {!documents && !error && <PageShimmer />}

        {documents && documents.length === 0 && (
          <section className="card" style={{ marginTop: 22 }}>
            <p className="quiet">No documents yet. Create one to start writing with your team.</p>
          </section>
        )}

        {documents && documents.length > 0 && (
          <>
            <DocumentSection title="Your documents" docs={owned} />
            <DocumentSection title="Shared with you" docs={shared} />
            <DocumentSection title="Public documents" docs={discoverable} />
          </>
        )}
      </div>

      {createOpen && (
        <div className="share-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
          <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="create-document-title">
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
          </section>
        </div>
      )}
    </AppShell>
  );
}
