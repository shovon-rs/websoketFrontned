"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useWs } from "@/lib/ws-context";

interface IncomingCall {
  callId: string;
  callType: "audio" | "video";
  caller: string;
}

export function IncomingCallBanner() {
  const router = useRouter();
  const { subscribe, send } = useWs();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);

  useEffect(() => subscribe("call:ringing", (event) => setIncoming(event.payload as IncomingCall)), [subscribe]);

  useEffect(() => {
    const offEnd = subscribe("call:end", () => setIncoming(null));
    return offEnd;
  }, [subscribe]);

  if (!incoming) return null;

  function accept() {
    if (!incoming) return;
    send("call:accept", { callId: incoming.callId });
    router.push(`/call/${incoming.callId}`);
    setIncoming(null);
  }

  function reject() {
    if (!incoming) return;
    send("call:reject", { callId: incoming.callId, reason: "declined" });
    setIncoming(null);
  }

  return <div className="incoming-call">
    <span className="incoming-call-icon">{incoming.callType === "video" ? <Video size={18}/> : <Phone size={18}/>}</span>
    <div><strong>Incoming {incoming.callType} call</strong><small>Someone is calling you</small></div>
    <button className="incoming-call-accept" onClick={accept}><Phone size={16}/></button>
    <button className="incoming-call-reject" onClick={reject}><PhoneOff size={16}/></button>
  </div>;
}
