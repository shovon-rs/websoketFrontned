"use client";
import { AppShell } from "@/components/AppShell";
import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useWs } from "@/lib/ws-context";
import { useWebRTCCall } from "@/lib/use-webrtc";
import * as callsApi from "@/lib/api/calls.api";
import * as usersApi from "@/lib/api/users.api";
import { ApiError } from "@/lib/api-client";
import type { Call, CallType } from "@/lib/types";

function StartCallPicker() {
  const router = useRouter();
  const { send, subscribe } = useWs();
  const [email, setEmail] = useState("");
  const [callType, setCallType] = useState<CallType>("video");
  const [error, setError] = useState<string | null>(null);
  const [dialing, setDialing] = useState(false);

  useEffect(() => {
    if (!dialing) return undefined;
    return subscribe("call:initiated", (event) => {
      router.replace(`/call/${(event.payload as { callId: string }).callId}`);
    });
  }, [dialing, subscribe, router]);

  async function startCall() {
    setError(null);
    const [match] = await usersApi.searchUsers(email);
    if (!match) {
      setError("No user found with that email.");
      return;
    }
    setDialing(true);
    send("call:initiate", { calleeId: match.id, callType });
  }

  return <AppShell title="Calls"><div className="page narrow"><section className="card">
    <h3>Start a call</h3>
    <p className="quiet">Enter a teammate's email and choose audio or video.</p>
    <div className="filter-search" style={{ margin: "16px 0" }}>
      <input placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      <button className={callType === "audio" ? "primary" : "plain"} onClick={() => setCallType("audio")}>Audio</button>
      <button className={callType === "video" ? "primary" : "plain"} onClick={() => setCallType("video")}>Video</button>
    </div>
    {error && <p className="auth-error">{error}</p>}
    <button className="primary wide" onClick={startCall} disabled={!email || dialing}>{dialing ? "Calling…" : "Call"}</button>
  </section></div></AppShell>;
}

function ActiveCall({ call, callId }: { call: Call; callId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const isCaller = call.initiatorId === user?.id;
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const onEnded = useCallback(() => router.replace("/dashboard"), [router]);
  const { localStream, remoteStream, phase, muted, cameraOn, sharingScreen, toggleMute, toggleCamera, toggleScreenShare, hangUp } =
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

  useEffect(() => {
    let cancelled = false;
    callsApi.getCall(params.callId).then(
      (result) => !cancelled && setCall(result),
      (err) => !cancelled && setCall(err instanceof ApiError && err.status === 404 ? null : null),
    );
    return () => {
      cancelled = true;
    };
  }, [params.callId]);

  if (call === "loading") return <AppShell title="Calls"><div className="page">Loading call…</div></AppShell>;
  if (!call) return <StartCallPicker />;
  return <ActiveCall call={call} callId={params.callId} />;
}
