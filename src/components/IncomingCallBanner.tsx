"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useWs } from "@/lib/ws-context";
import { startRingtone } from "@/lib/sound";
import { tapScale, EASE_SPRING } from "@/lib/motion";

interface IncomingCall {
  callId: string;
  callType: "audio" | "video";
  caller: string;
}

export function IncomingCallBanner() {
  const router = useRouter();
  const { subscribe, send } = useWs();
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  const stopRingtoneRef = useRef<(() => void) | null>(null);

  useEffect(() => subscribe("call:ringing", (event) => setIncoming(event.payload as IncomingCall)), [subscribe]);

  useEffect(() => {
    const offEnd = subscribe("call:end", () => setIncoming(null));
    return offEnd;
  }, [subscribe]);

  // Ring for as long as there's an unanswered incoming call, and only then.
  useEffect(() => {
    if (incoming) {
      stopRingtoneRef.current = startRingtone();
    }
    return () => {
      stopRingtoneRef.current?.();
      stopRingtoneRef.current = null;
    };
  }, [incoming?.callId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <AnimatePresence>
      {incoming && (
        <motion.div
          className="incoming-call"
          role="alert"
          initial={{ opacity: 0, x: 40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.15 } }}
          transition={{ duration: 0.35, ease: EASE_SPRING }}
        >
          <span className="incoming-call-icon">{incoming.callType === "video" ? <Video size={18}/> : <Phone size={18}/>}</span>
          <div><strong>Incoming {incoming.callType} call</strong><small>Someone is calling you</small></div>
          <motion.button className="incoming-call-accept" onClick={accept} whileTap={tapScale} aria-label="Accept call"><Phone size={16}/></motion.button>
          <motion.button className="incoming-call-reject" onClick={reject} whileTap={tapScale} aria-label="Decline call"><PhoneOff size={16}/></motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
