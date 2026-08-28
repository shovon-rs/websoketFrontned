"use client";
import { AppShell } from "@/components/AppShell";
import { Mic, MicOff, MonitorUp, PhoneOff, Video, VideoOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLiveBroadcast } from "@/lib/use-live-broadcast";
import * as announcementsApi from "@/lib/api/announcements.api";
import { ApiError } from "@/lib/api-client";
import type { Announcement } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  connecting: "Connecting…",
  waiting: "Waiting",
  live: "Live",
  failed: "Connection failed",
  ended: "Ended",
};

function BroadcasterView({ announcement }: { announcement: Announcement }) {
  const router = useRouter();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const onEnded = useCallback(() => router.replace("/live"), [router]);
  const {
    localStream,
    phase,
    error,
    muted,
    cameraOn,
    sharingScreen,
    viewerCount,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    endStream,
  } = useLiveBroadcast({ announcementId: announcement.id, isBroadcaster: true, onEnded });

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  const statusLabel = phase === "waiting" ? "Waiting for viewers" : STATUS_LABEL[phase];

  return (
    <AppShell title="Live stream">
      <div className="call-room">
        <div className="call-info">
          <span><i /> {statusLabel}</span>
          <strong>{announcement.title}{viewerCount > 0 ? ` · ${viewerCount} watching` : ""}</strong>
        </div>
        {phase === "failed" && error && <p className="auth-error" style={{ margin: "0 0 16px" }}>{error}</p>}
        <div className="video-grid">
          <div className="video-tile you">
            {cameraOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
              />
            ) : (
              <span>You</span>
            )}
            <label>You{muted ? " · Muted" : ""}</label>
          </div>
        </div>
        <div className="call-controls">
          <button onClick={toggleMute} className={muted ? "off" : ""}>{muted ? <MicOff /> : <Mic />}</button>
          <button onClick={toggleCamera} className={!cameraOn ? "off" : ""}>{cameraOn ? <Video /> : <VideoOff />}</button>
          <button onClick={toggleScreenShare} className={sharingScreen ? "off" : ""}><MonitorUp /></button>
          <button className="hang" onClick={endStream}><PhoneOff /></button>
        </div>
      </div>
    </AppShell>
  );
}

function ViewerRoom({ announcement }: { announcement: Announcement }) {
  const router = useRouter();
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const onEnded = useCallback(() => router.replace("/live"), [router]);
  const { remoteStream, phase, error, leave } = useLiveBroadcast({
    announcementId: announcement.id,
    isBroadcaster: false,
    onEnded,
  });

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  function onLeave() {
    leave();
    router.replace("/live");
  }

  const statusLabel = phase === "connecting" || phase === "waiting" ? "Waiting for the host to start…" : STATUS_LABEL[phase];

  return (
    <AppShell title="Live stream">
      <div className="call-room">
        <div className="call-info"><span><i /> {statusLabel}</span><strong>{announcement.title}</strong></div>
        {phase === "failed" && error && <p className="auth-error" style={{ margin: "0 0 16px" }}>{error}</p>}
        <div className="video-grid">
          <div className="video-tile maya">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
              />
            ) : (
              <span>…</span>
            )}
            <label>{remoteStream ? "Host" : "Waiting to join"}</label>
          </div>
        </div>
        <div className="call-controls">
          <button className="hang" onClick={onLeave}><PhoneOff /></button>
        </div>
      </div>
    </AppShell>
  );
}

export default function LiveRoomPage({ params }: { params: { announcementId: string } }) {
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState<Announcement | null | "loading">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    announcementsApi.getAnnouncement(params.announcementId).then(
      (result) => !cancelled && setAnnouncement(result),
      (err) => {
        if (cancelled) return;
        // 403/404 just means there's no stream to join here — offer a friendly message.
        // Anything else (500, network failure) is a real problem worth surfacing.
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          setAnnouncement(null);
        } else {
          setAnnouncement(null);
          setLoadError(err instanceof ApiError ? err.message : "Could not load this live stream. Please try again.");
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [params.announcementId]);

  if (announcement === "loading") return <AppShell title="Live"><div className="page">Loading…</div></AppShell>;
  if (loadError) {
    return (
      <AppShell title="Live">
        <div className="page narrow"><section className="card"><h3>Something went wrong</h3><p className="auth-error">{loadError}</p></section></div>
      </AppShell>
    );
  }
  if (!announcement) {
    return (
      <AppShell title="Live">
        <div className="page narrow">
          <section className="card">
            <h3>Not available</h3>
            <p className="quiet">This live stream doesn&rsquo;t exist, hasn&rsquo;t started, or you don&rsquo;t have access to it.</p>
          </section>
        </div>
      </AppShell>
    );
  }
  if (announcement.status !== "live") {
    return (
      <AppShell title="Live">
        <div className="page narrow">
          <section className="card">
            <h3>{announcement.title}</h3>
            <p className="quiet">This stream isn&rsquo;t live yet — check back at the scheduled time.</p>
          </section>
        </div>
      </AppShell>
    );
  }

  const isBroadcaster = announcement.broadcasterId === user?.id;
  return isBroadcaster ? <BroadcasterView announcement={announcement} /> : <ViewerRoom announcement={announcement} />;
}
