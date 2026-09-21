"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import { useWs } from "./ws-context";
import type { DocumentRole } from "./types";

// Origins used to tag how a Y.Doc update was produced, so the local `ydoc.on("update", ...)`
// listener can tell a genuinely-local edit apart from one that just arrived over the wire —
// without this, re-broadcasting an update the server just sent back to us (the backend does not
// filter the sender out of its broadcast) would create an infinite echo loop.
const ORIGIN_REMOTE = "remote";
const ORIGIN_SERVER = "server";
const ORIGIN_RESTORE = "restore";

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type DocState = {
  ydoc: Y.Doc;
  awareness: Awareness;
  key: number;
};

function createDocState(key: number): DocState {
  const ydoc = new Y.Doc();
  const awareness = new Awareness(ydoc);
  return { ydoc, awareness, key };
}

export interface DocumentSyncResult {
  ydoc: Y.Doc | null;
  awareness: Awareness | null;
  /** Bumps (and swaps ydoc/awareness) whenever a version restore resets the document —
   * key the editor-owning component off this so it fully remounts with fresh Yjs state. */
  resetKey: number;
  /** True once the initial `document:state` snapshot has been applied. */
  ready: boolean;
  role: DocumentRole | null;
  /** Presence: userId -> displayName, for everyone currently joined to this document room. */
  presence: Map<string, string>;
}

/**
 * Wires a Y.Doc + Awareness pair to the app's single WebSocket connection for one collaborative
 * document. The backend relays raw Yjs update/awareness bytes (base64 inside the normal WS
 * envelope) — this is NOT a y-websocket/Hocuspocus provider, just the glue for that relay.
 */
export function useDocumentSync(documentId: string | null): DocumentSyncResult {
  const { status, send, subscribe } = useWs();
  const [state, setState] = useState<DocState | null>(null);
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<DocumentRole | null>(null);
  const [presence, setPresence] = useState<Map<string, string>>(new Map());
  const stateRef = useRef<DocState | null>(state);
  stateRef.current = state;

  // Create the Y.Doc/Awareness pair for this document INSIDE an effect, not via useState's lazy
  // initializer. React 18 Strict Mode double-invokes effects in dev (mount -> cleanup -> mount)
  // to surface exactly this kind of bug: if the doc were created once via useState and destroyed
  // in a cleanup, Strict Mode's synthetic first cleanup would destroy the *only* copy, and the
  // second mount phase would keep operating on already-destroyed Yjs objects — corrupting the
  // document (this is what was happening: garbled/rainbow text from stale, dead-doc awareness
  // state). Creating and destroying inside the same effect makes each mount phase self-contained.
  useEffect(() => {
    if (!documentId) {
      setState(null);
      return undefined;
    }
    const created = createDocState(0);
    setState(created);
    setReady(false);
    setRole(null);
    setPresence(new Map());
    return () => {
      created.awareness.destroy();
      created.ydoc.destroy();
    };
  }, [documentId]);

  // Re-send document:join on every reconnect transition, not just once on mount — room
  // membership lives on the connection (see the relay-frontend skill's WS reconnect-rejoin note).
  useEffect(() => {
    if (status === "connected" && documentId && state) {
      send("document:join", { documentId });
    }
  }, [status, documentId, state, send]);

  useEffect(() => {
    if (!documentId || !state) return undefined;

    const offState = subscribe("document:state", (event) => {
      const payload = event.payload as { documentId: string; state: string; title?: string; role?: DocumentRole };
      if (payload.documentId !== documentId) return;
      const bytes = base64ToBytes(payload.state);
      Y.applyUpdate(stateRef.current!.ydoc, bytes, ORIGIN_SERVER);
      if (payload.role) setRole(payload.role);
      setReady(true);
    });

    const offUpdate = subscribe("document:update", (event) => {
      const payload = event.payload as { documentId: string; update: string; authorId?: string };
      if (payload.documentId !== documentId) return;
      const bytes = base64ToBytes(payload.update);
      Y.applyUpdate(stateRef.current!.ydoc, bytes, ORIGIN_REMOTE);
    });

    const offPresence = subscribe("document:presence", (event) => {
      const payload = event.payload as { documentId: string; userId: string; displayName: string; joined: boolean };
      if (payload.documentId !== documentId) return;
      setPresence((prev) => {
        const next = new Map(prev);
        if (payload.joined) next.set(payload.userId, payload.displayName);
        else next.delete(payload.userId);
        return next;
      });
    });

    const offAwareness = subscribe("document:awareness", (event) => {
      const payload = event.payload as { documentId: string; awareness: string; userId?: string };
      if (payload.documentId !== documentId) return;
      const bytes = base64ToBytes(payload.awareness);
      applyAwarenessUpdate(stateRef.current!.awareness, bytes, ORIGIN_REMOTE);
    });

    const offRestored = subscribe("document:restored", (event) => {
      const payload = event.payload as { documentId: string; state: string };
      if (payload.documentId !== documentId) return;
      // A live Y.Doc bound to a live ProseMirror editor can't be cleanly reset in place — tear
      // down and start over with a brand-new Y.Doc/Awareness pair, and bump resetKey so the
      // editor-owning component remounts against it.
      const prev = stateRef.current;
      if (!prev) return;
      const next = createDocState(prev.key + 1);
      Y.applyUpdate(next.ydoc, base64ToBytes(payload.state), ORIGIN_RESTORE);
      prev.awareness.destroy();
      prev.ydoc.destroy();
      setPresence(new Map());
      setReady(true);
      setState(next);
    });

    // Best-effort: tell the room we're leaving. The doc-state creation effect's own cleanup
    // (above) destroys the Awareness, whose 'update' event (handled below) sends the actual
    // awareness-removal message — this send() here is for the room-membership side only.
    return () => {
      offState();
      offUpdate();
      offPresence();
      offAwareness();
      offRestored();
      send("document:leave", { documentId });
    };
  }, [documentId, state, subscribe, send]);

  // Local edits (and remote edits merged in under any origin other than the ones above) get
  // forwarded to the server. Incoming document:update/document:state applies are tagged
  // "remote"/"server" specifically so this listener does not re-send them (echo-loop guard).
  useEffect(() => {
    if (!state || !documentId) return undefined;
    const { ydoc } = state;
    function onUpdate(update: Uint8Array, origin: unknown) {
      if (origin === ORIGIN_REMOTE || origin === ORIGIN_SERVER || origin === ORIGIN_RESTORE) return;
      if (!documentId) return;
      send("document:update", { documentId, update: bytesToBase64(update) });
    }
    ydoc.on("update", onUpdate);
    return () => ydoc.off("update", onUpdate);
  }, [state, documentId, send]);

  useEffect(() => {
    if (!state || !documentId) return undefined;
    const { awareness } = state;
    function onAwarenessUpdate(
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) {
      if (origin === ORIGIN_REMOTE) return;
      if (!documentId) return;
      const changed = [...added, ...updated, ...removed];
      if (changed.length === 0) return;
      const update = encodeAwarenessUpdate(awareness, changed);
      send("document:awareness", { documentId, awareness: bytesToBase64(update) });
    }
    awareness.on("update", onAwarenessUpdate);
    return () => awareness.off("update", onAwarenessUpdate);
  }, [state, documentId, send]);

  return useMemo(
    () => ({
      ydoc: state?.ydoc ?? null,
      awareness: state?.awareness ?? null,
      resetKey: state?.key ?? 0,
      ready,
      role,
      presence,
    }),
    [state, ready, role, presence],
  );
}
