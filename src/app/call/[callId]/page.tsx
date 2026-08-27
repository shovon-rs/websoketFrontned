"use client";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { UserSearchDropdown } from "@/components/UserSearchDropdown";
import { PageShimmer } from "@/components/Shimmer";
import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";
import { useWebRTCCall } from "@/lib/use-webrtc";
import * as callsApi from "@/lib/api/calls.api";
import { ApiError } from "@/lib/api-client";
import type { Call, CallType, User } from "@/lib/types";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function StartCallPicker() {
  const router = useRouter();
  const { send, subscribe } = useWs();
  const [recipient, setRecipient] = useState<User | null>(null);
  const [callType, setCallType] = useState<CallType>("video");
  const [error, setError] = useState<string | null>(null);
  const [dialing, setDialing] = useState(false);

  useEffect(() => {
    if (!dialing) return undefined;

    const offInitiated = subscribe("call:initiated", (event) => {
      router.replace(`/call/${(event.payload as { callId: string }).callId}`);
    });
    // The server rejected call:initiate (rate limit, validation, unexpected error) — without
    // this, "Calling…" would hang forever with no feedback.
    const offError = subscribe("error", (event) => {
      setDialing(false);
      setError(event.error?.message ?? "Could not start the call. Please try again.");
    });
    // Belt-and-suspenders: if nothing came back at all (e.g. a dropped WS message), stop spinning.
    const timeout = setTimeout(() => {
      setDialing(false);
      setError("No response from the server. Check your connection and try again.");
    }, 15000);

    return () => {
      offInitiated();
      offError();
      clearTimeout(timeout);
    };
  }, [dialing, subscribe, router]);

  function startCall() {
    if (!recipient) return;
    setError(null);
    setDialing(true);
    send("call:initiate", { calleeId: recipient.id, callType });
  }

  return <AppShell title="Calls"><div className="page narrow"><section className="card">
    <h3>Start a call</h3>
    <p className="quiet">Search for a teammate and choose audio or video.</p>

    {!recipient && <div style={{ margin: "16px 0" }}>
      <UserSearchDropdown onSelect={setRecipient} placeholder="Search people by name or email…" autoFocus />
    </div>}

    {recipient && <div className="selected-recipient">
      <Avatar initials={initialsOf(recipient.displayName)} color="green" />
      <div><strong>{recipient.displayName}</strong><small>{recipient.email}</small></div>
      <button onClick={() => setRecipient(null)} disabled={dialing}><X size={14} style={{ verticalAlign: "-2px", marginRight: 4 }}/>Change</button>
    </div>}

    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      <button className={callType === "audio" ? "primary" : "plain"} onClick={() => setCallType("audio")} disabled={dialing}>Audio</button>
      <button className={callType === "video" ? "primary" : "plain"} onClick={() => setCallType("video")} disabled={dialing}>Video</button>
    </div>
    {error && <p className="auth-error">{error}</p>}
    <button className="primary wide" onClick={startCall} disabled={!recipient || dialing}>{dialing ? "Calling…" : "Call"}</button>
  </section></div></AppShell>;
}

function ActiveCall({ call, callId }: { call: Call; callId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isCaller = call.initiatorId === user?.id;
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const onEnded = useCallback(() => router.replace("/dashboard"), [router]);
  const { localStream, remoteStream, phase, error, muted, cameraOn, sharingScreen, toggleMute, toggleCamera, toggleScreenShare, hangUp } =
    useWebRTCCall({ callId, isCaller, callType: call.type, onEnded });

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  const statusLabel = phase === "ringing" ? "Ringing…" : phase === "connecting" ? "Connecting…" : phase === "active" ? "Live" : phase === "failed" ? "Connection failed" : "Call ended";

  return <AppShell title={call.type === "video" ? "Video call" : "Audio call"}>
    <div className="call-room">
      <div className="call-info"><span><i/> {statusLabel}</span><strong>{call.type === "video" ? "Video call" : "Audio call"}</strong></div>
      {phase === "failed" && error && <p className="auth-error" style={{ margin: "0 0 16px" }}>{error}</p>}
      <div className="video-grid">
        <div className="video-tile you">
          {call.type === "video" && cameraOn ? <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} /> : <span>You</span>}
          <label>You{muted ? " · Muted" : ""}</label>
        </div>
        <div className="video-tile maya">
          {remoteStream && call.type === "video" ? <video ref={remoteVideoRef} autoPlay playsInline style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} /> : <span>{remoteStream ? "" : "…"}</span>}
          <label>{remoteStream ? "Participant" : "Waiting to join"}</label>
        </div>
      </div>
      <div className="call-controls">
        <button onClick={toggleMute} className={muted ? "off" : ""}>{muted ? <MicOff/> : <Mic/>}</button>
        {call.type === "video" && <button onClick={toggleCamera} className={!cameraOn ? "off" : ""}>{cameraOn ? <Video/> : <VideoOff/>}</button>}
        {call.type === "video" && <button onClick={toggleScreenShare} className={sharingScreen ? "off" : ""}><MonitorUp/></button>}
        <button className="hang" onClick={hangUp}><PhoneOff/></button>
      </div>
    </div>
  </AppShell>;
}

export default function CallPage({ params }: { params: { callId: string } }) {
  const [call, setCall] = useState<Call | null | "loading">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    callsApi.getCall(params.callId).then(
      (result) => !cancelled && setCall(result),
      (err) => {
        if (cancelled) return;
        // 403/404 just means there's no call to join here (e.g. a stale link) — offer to start one.
        // Anything else (500, network failure) is a real problem worth surfacing.
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setCall(null);
        } else {
          setCall(null);
          setLoadError(err instanceof ApiError ? err.message : "Could not load this call. Please try again.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [params.callId]);

  if (call === "loading") return <AppShell title="Calls"><PageShimmer variant="call" /></AppShell>;
  if (loadError) return <AppShell title="Calls"><div className="page narrow"><section className="card"><h3>Something went wrong</h3><p className="auth-error">{loadError}</p></section></div></AppShell>;
  if (!call) return <StartCallPicker />;
  return <ActiveCall call={call} callId={params.callId} />;
}
