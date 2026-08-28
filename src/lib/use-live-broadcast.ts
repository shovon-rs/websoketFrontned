"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWs } from "./ws-context";
import * as callsApi from "./api/calls.api";
import type { IceServer } from "./types";

type LivePhase = "connecting" | "waiting" | "live" | "ended" | "failed";

interface UseLiveBroadcastOptions {
  announcementId: string;
  isBroadcaster: boolean;
  onEnded?: () => void;
}

/**
 * A one-way broadcast, not a mesh conference: only the broadcaster publishes media. The
 * broadcaster opens one RTCPeerConnection per viewer (all fed the same local tracks, so
 * toggling mute/camera once affects every viewer); a viewer opens exactly one connection
 * back to the broadcaster and never calls getUserMedia at all. Structurally this mirrors
 * use-webrtc.ts's callee half on the viewer side, but keyed per-peer everywhere a 1:1 call
 * only needed one of everything.
 */
export function useLiveBroadcast({ announcementId, isBroadcaster, onEnded }: UseLiveBroadcastOptions) {
  const { status: wsStatus, subscribe, send } = useWs();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<LivePhase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const iceServersRef = useRef<IceServer[]>([]);

  // Broadcaster: one connection per viewer, keyed by viewerId. Viewer: at most one entry,
  // keyed by the broadcaster's userId.
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const cleanup = useCallback(() => {
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    pendingCandidatesRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const flushPendingCandidatesFor = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = pendingCandidatesRef.current.get(peerId) ?? [];
    for (const candidate of queued) await pc.addIceCandidate(candidate).catch(() => undefined);
    pendingCandidatesRef.current.delete(peerId);
  }, []);

  // Broadcaster: opens a connection to a (newly joined) viewer and sends the offer.
  const offerToViewer = useCallback(
    async (viewerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
      localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
      pc.onicecandidate = (event) => {
        if (event.candidate) send("live:ice-candidate", { announcementId, targetUserId: viewerId, candidate: event.candidate });
      };
      pcsRef.current.set(viewerId, pc);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send("live:sdp-offer", { announcementId, targetUserId: viewerId, sdp: offer });
    },
    [announcementId, send],
  );

  // Viewer: applies the broadcaster's offer, creating its one connection if needed.
  const applyOfferFromBroadcaster = useCallback(
    async (broadcasterId: string, sdp: RTCSessionDescriptionInit) => {
      let pc = pcsRef.current.get(broadcasterId);
      if (!pc) {
        pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
        const thisPc = pc;
        thisPc.ontrack = (event) => setRemoteStream(event.streams[0]);
        thisPc.onicecandidate = (event) => {
          if (event.candidate) send("live:ice-candidate", { announcementId, targetUserId: broadcasterId, candidate: event.candidate });
        };
        thisPc.onconnectionstatechange = () => {
          if (thisPc.connectionState === "connected") setPhase("live");
          if (thisPc.connectionState === "failed") setPhase("failed");
        };
        pcsRef.current.set(broadcasterId, thisPc);
      }

      await pc.setRemoteDescription(sdp);
      await flushPendingCandidatesFor(broadcasterId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send("live:sdp-answer", { announcementId, targetUserId: broadcasterId, sdp: answer });
    },
    [announcementId, send, flushPendingCandidatesFor],
  );

  // Broadcaster: applies a viewer's answer to that viewer's connection.
  const applyAnswerFromViewer = useCallback(
    async (viewerId: string, sdp: RTCSessionDescriptionInit) => {
      const pc = pcsRef.current.get(viewerId);
      if (!pc) return;
      await pc.setRemoteDescription(sdp);
      await flushPendingCandidatesFor(viewerId, pc);
      setPhase("live");
    },
    [flushPendingCandidatesFor],
  );

  // Setup: fetch ICE servers; the broadcaster also grabs camera/mic (in parallel — neither
  // depends on the other, mirroring the same fix already made to use-webrtc.ts).
  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        if (isBroadcaster) {
          const [iceServers, stream] = await Promise.all([
            callsApi.getIceServers(),
            navigator.mediaDevices.getUserMedia({ audio: true, video: true }),
          ]);
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          iceServersRef.current = iceServers;
          localStreamRef.current = stream;
          cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
          setLocalStream(stream);
          setPhase("waiting");
        } else {
          const iceServers = await callsApi.getIceServers();
          if (cancelled) return;
          iceServersRef.current = iceServers;
          setPhase("waiting");
        }
      } catch (err) {
        if (!cancelled) {
          setPhase("failed");
          setError(err instanceof Error ? err.message : "Could not access camera/microphone");
        }
      }
    }

    setup();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcementId, isBroadcaster]);

  // Room membership lives on the connection, not the client — re-join on every reconnect,
  // not just once on mount (this repo's documented WS gotcha).
  useEffect(() => {
    if (wsStatus === "connected") send("live:join", { announcementId });
  }, [wsStatus, announcementId, send]);

  useEffect(() => {
    const offJoined = subscribe("live:joined", (event) => {
      const payload = event.payload as { announcementId: string; iceServers: IceServer[]; broadcasterId: string; viewerIds: string[] };
      if (payload.announcementId !== announcementId) return;
      iceServersRef.current = payload.iceServers;
      if (isBroadcaster) {
        setViewerCount(payload.viewerIds.length);
        payload.viewerIds.forEach((viewerId) => {
          offerToViewer(viewerId).catch(() => undefined);
        });
      }
    });

    const offViewerJoined = subscribe("live:viewer-joined", (event) => {
      const payload = event.payload as { announcementId: string; userId: string };
      if (payload.announcementId !== announcementId || !isBroadcaster) return;
      setViewerCount((n) => n + 1);
      offerToViewer(payload.userId).catch(() => undefined);
    });

    const offViewerLeft = subscribe("live:viewer-left", (event) => {
      const payload = event.payload as { announcementId: string; userId: string };
      if (payload.announcementId !== announcementId) return;
      pcsRef.current.get(payload.userId)?.close();
      pcsRef.current.delete(payload.userId);
      pendingCandidatesRef.current.delete(payload.userId);
      if (isBroadcaster) setViewerCount((n) => Math.max(0, n - 1));
    });

    const offOffer = subscribe("live:sdp-offer", (event) => {
      const payload = event.payload as { announcementId: string; fromUserId: string; sdp: RTCSessionDescriptionInit };
      if (payload.announcementId !== announcementId || isBroadcaster) return;
      applyOfferFromBroadcaster(payload.fromUserId, payload.sdp).catch((err) => {
        setPhase("failed");
        setError(err instanceof Error ? err.message : "Failed to join the stream");
      });
    });

    const offAnswer = subscribe("live:sdp-answer", (event) => {
      const payload = event.payload as { announcementId: string; fromUserId: string; sdp: RTCSessionDescriptionInit };
      if (payload.announcementId !== announcementId || !isBroadcaster) return;
      applyAnswerFromViewer(payload.fromUserId, payload.sdp).catch(() => undefined);
    });

    const offIce = subscribe("live:ice-candidate", (event) => {
      const payload = event.payload as { announcementId: string; fromUserId: string; candidate: RTCIceCandidateInit };
      if (payload.announcementId !== announcementId) return;
      const pc = pcsRef.current.get(payload.fromUserId);
      if (pc?.remoteDescription) {
        pc.addIceCandidate(payload.candidate).catch(() => undefined);
      } else {
        const queue = pendingCandidatesRef.current.get(payload.fromUserId) ?? [];
        queue.push(payload.candidate);
        pendingCandidatesRef.current.set(payload.fromUserId, queue);
      }
    });

    const offEnded = subscribe("live:ended", (event) => {
      const payload = event.payload as { announcementId: string };
      if (payload.announcementId !== announcementId) return;
      setPhase("ended");
      cleanup();
      onEnded?.();
    });

    return () => {
      offJoined();
      offViewerJoined();
      offViewerLeft();
      offOffer();
      offAnswer();
      offIce();
      offEnded();
    };
  }, [announcementId, isBroadcaster, subscribe, offerToViewer, applyOfferFromBroadcaster, applyAnswerFromViewer, cleanup, onEnded]);

  useEffect(() => cleanup, [cleanup]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOn;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCameraOn(next);
  }, [cameraOn]);

  const toggleScreenShare = useCallback(async () => {
    if (sharingScreen) {
      const camTrack = cameraTrackRef.current;
      if (camTrack) {
        pcsRef.current.forEach((pc) => {
          pc.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(camTrack);
        });
      }
      setSharingScreen(false);
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      // Must replace on every viewer's connection, not just one — a single pc.getSenders()
      // call (as in use-webrtc.ts's 1:1 case) would only update the first viewer.
      pcsRef.current.forEach((pc) => {
        pc.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(screenTrack);
      });
      screenTrack.onended = () => {
        const camTrack = cameraTrackRef.current;
        if (camTrack) {
          pcsRef.current.forEach((pc) => {
            pc.getSenders().find((s) => s.track?.kind === "video")?.replaceTrack(camTrack);
          });
        }
        setSharingScreen(false);
      };
      setSharingScreen(true);
    } catch {
      // user cancelled the screen picker
    }
  }, [sharingScreen]);

  const leave = useCallback(() => {
    send("live:leave", { announcementId });
    cleanup();
  }, [announcementId, send, cleanup]);

  const endStream = useCallback(() => {
    send("live:end", { announcementId });
    setPhase("ended");
    cleanup();
    onEnded?.();
  }, [announcementId, send, cleanup, onEnded]);

  return {
    localStream,
    remoteStream,
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
    leave,
  };
}
