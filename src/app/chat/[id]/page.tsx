"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Info, Paperclip, Phone, Search, Send, Smile, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as chatApi from "@/lib/api/chat.api";
import * as usersApi from "@/lib/api/users.api";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";
import { makeEventId } from "@/lib/ws-envelope";
import type { Conversation, Message } from "@/lib/types";

const PALETTE = ["coral", "blue", "violet", "gold", "green"];
function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatConversation({ params }: { params: { id: string } }) {
  const conversationId = params.id;
  const router = useRouter();
  const { user } = useAuth();
  const { status: wsStatus, send, subscribe } = useWs();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const [newConvoEmail, setNewConvoEmail] = useState("");

  const lastEventIdRef = useRef<string | undefined>(undefined);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastTypingSentRef = useRef(0);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeConversation = conversations.find((c) => c.id === conversationId);

  const memberById = useMemo(() => {
    const map = new Map<string, { displayName: string; email: string }>();
    activeConversation?.members.forEach((m) => map.set(m.userId, m.user));
    return map;
  }, [activeConversation]);

  const otherMember = useMemo(
    () => activeConversation?.members.find((m) => m.userId !== user?.id)?.user,
    [activeConversation, user],
  );

  // Load the sidebar conversation list once.
  useEffect(() => {
    chatApi.listConversations().then(setConversations);
  }, []);

  // Load history + join the room whenever the active conversation changes.
  useEffect(() => {
    if (!conversationId) return;
    setMessages([]);
    lastEventIdRef.current = undefined;

    chatApi.getMessages(conversationId).then((history) => {
      setMessages(history.map((m) => ({ ...m, status: m.status as Message["status"] })));
      lastEventIdRef.current = history.at(-1)?.eventId;
    });

    return () => {
      send("chat:leave", { conversationId });
    };
  }, [conversationId, send]);

  // Room membership lives on the server connection, not the client — rejoin on every (re)connect.
  useEffect(() => {
    if (wsStatus === "connected") send("chat:join", { conversationId });
  }, [wsStatus, conversationId, send]);

  // Reconnect catch-up: fetch anything sent while the socket was down.
  const prevStatusRef = useRef(wsStatus);
  useEffect(() => {
    if (prevStatusRef.current !== "connected" && wsStatus === "connected" && lastEventIdRef.current) {
      chatApi.getMessages(conversationId, lastEventIdRef.current).then((missed) => {
        if (missed.length === 0) return;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.eventId));
          const fresh = missed.filter((m) => !seen.has(m.eventId));
          lastEventIdRef.current = missed.at(-1)?.eventId ?? lastEventIdRef.current;
          return [...prev, ...fresh.map((m) => ({ ...m, status: m.status as Message["status"] }))];
        });
      });
    }
    prevStatusRef.current = wsStatus;
  }, [wsStatus, conversationId]);

  useEffect(() => {
    const offNew = subscribe("message:new", (event) => {
      const payload = event.payload as { id: string; conversationId: string; senderId: string; content: string; createdAt: string };
      if (payload.conversationId !== conversationId) return;

      lastEventIdRef.current = event.eventId;
      setMessages((prev) => {
        // Reconcile our own optimistic entry (keyed by the eventId we sent) instead of duplicating it.
        const optimisticIndex = prev.findIndex((m) => m.eventId === event.eventId);
        const resolved: Message = {
          id: payload.id,
          eventId: event.eventId,
          conversationId: payload.conversationId,
          senderId: payload.senderId,
          content: payload.content,
          createdAt: payload.createdAt,
          status: "delivered",
        };
        if (optimisticIndex >= 0) {
          const next = [...prev];
          next[optimisticIndex] = resolved;
          return next;
        }
        if (prev.some((m) => m.id === payload.id)) return prev;
        return [...prev, resolved];
      });

      if (payload.senderId !== user?.id) {
        send("message:ack", { eventId: event.eventId });
      }
    });

    const offTypingStart = subscribe("typing:start", (event) => {
      const payload = event.payload as { conversationId: string; userId: string };
      if (payload.conversationId !== conversationId || payload.userId === user?.id) return;
      setTypingUsers((prev) => new Set(prev).add(payload.userId));
      const timers = typingTimersRef.current;
      clearTimeout(timers.get(payload.userId));
      timers.set(
        payload.userId,
        setTimeout(() => setTypingUsers((prev) => { const next = new Set(prev); next.delete(payload.userId); return next; }), 4000),
      );
    });

    const offTypingStop = subscribe("typing:stop", (event) => {
      const payload = event.payload as { conversationId: string; userId: string };
      if (payload.conversationId !== conversationId) return;
      setTypingUsers((prev) => { const next = new Set(prev); next.delete(payload.userId); return next; });
    });

    return () => {
      offNew();
      offTypingStart();
      offTypingStop();
    };
  }, [conversationId, subscribe, send, user]);

  const sendMessage = useCallback(() => {
    if (!text.trim() || !user) return;
    const eventId = makeEventId();
    const optimistic: Message = {
      id: eventId,
      eventId,
      conversationId,
      senderId: user.id,
      content: text,
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    send("message:send", { conversationId, content: text }, eventId);
    setText("");
  }, [text, user, conversationId, send]);

  function onTyping(value: string) {
    setText(value);
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2000) {
      send("typing:start", { conversationId });
      lastTypingSentRef.current = now;
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => send("typing:stop", { conversationId }), 3000);
  }

  async function startConversation() {
    const [match] = await usersApi.searchUsers(newConvoEmail);
    if (!match) return;
    const conversation = await chatApi.createConversation({ memberIds: [match.id], type: "direct" });
    setConversations((prev) => (prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]));
    setNewConvoOpen(false);
    setNewConvoEmail("");
    router.push(`/chat/${conversation.id}`);
  }

  const typingNames = Array.from(typingUsers).map((id) => memberById.get(id)?.displayName.split(" ")[0] ?? "Someone");

  return <AppShell title="Messages"><div className="chat-layout">
    <aside className="conversation-panel">
      <div className="filter-search"><Search size={17}/><input placeholder="Search conversations"/></div>
      <div className="conv-heading"><strong>All messages</strong><button onClick={() => setNewConvoOpen((v) => !v)}>+</button></div>
      {newConvoOpen && <div className="filter-search" style={{ marginBottom: 10 }}>
        <input placeholder="Start chat with email…" value={newConvoEmail} onChange={(e) => setNewConvoEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startConversation()} />
        <button onClick={startConversation}><Send size={15}/></button>
      </div>}
      {conversations.map((c) => {
        const other = c.members.find((m) => m.userId !== user?.id)?.user;
        const label = c.type === "group" ? c.name ?? "Group" : other?.displayName ?? "Conversation";
        const preview = c.messages?.[0]?.content ?? "No messages yet";
        return <Link href={`/chat/${c.id}`} className={`conversation ${conversationId === c.id ? "selected" : ""}`} key={c.id}>
          <Avatar initials={initialsOf(label)} color={colorFor(c.id)} />
          <div><strong>{label}</strong><small>{preview}</small></div>
        </Link>;
      })}
    </aside>
    <section className="thread">
      <header className="thread-head">
        <div><Avatar initials={initialsOf(otherMember?.displayName ?? activeConversation?.name ?? "?")} color={colorFor(conversationId)}/><span><strong>{otherMember?.displayName ?? activeConversation?.name ?? "Conversation"}</strong><small>{activeConversation?.members.length ?? 0} members</small></span></div>
        <div><button><Search/></button><button><Phone/></button><button><Video/></button><button><Info/></button></div>
      </header>
      <div className="messages">
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          const sender = memberById.get(m.senderId);
          return <div className={`message ${mine ? "mine" : ""}`} key={m.eventId}>
            {!mine && <Avatar initials={initialsOf(sender?.displayName ?? "?")} color={colorFor(m.senderId)} size="sm"/>}
            <div>
              <span className="message-meta"><strong>{mine ? "You" : sender?.displayName ?? "Unknown"}</strong><time>{formatTime(m.createdAt)}</time></span>
              <p>{m.content}</p>
              {mine && <small className="delivered">{m.status === "sending" ? "Sending…" : m.status === "failed" ? "Failed to send" : "Delivered ✓"}</small>}
            </div>
          </div>;
        })}
        {typingNames.length > 0 && <div className="typing"><span><i/><i/><i/></span><small>{typingNames.join(", ")} {typingNames.length > 1 ? "are" : "is"} typing</small></div>}
      </div>
      <div className="composer">
        <div>
          <button><Paperclip/></button>
          <textarea value={text} onChange={(e) => onTyping(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="Write a message…"/>
          <button><Smile/></button>
          <button className="send" onClick={sendMessage}><Send/></button>
        </div>
        <small>Press Enter to send · Shift + Enter for a new line</small>
      </div>
    </section>
  </div></AppShell>;
}
