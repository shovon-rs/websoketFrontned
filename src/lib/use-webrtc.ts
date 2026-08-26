"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWs } from "./ws-context";
import * as callsApi from "./api/calls.api";
import type { CallType } from "./types";

type CallPhase = "connecting" | "ringing" | "active" | "ended" | "failed";

interface UseWebRTCCallOptions {
  callId: string;
  isCaller: boolean;
  callType: CallType;
  onEnded?: () => void;
}

export function useWebRTCCall({ callId, isCaller, callType, onEnded }: UseWebRTCCallOptions) {
  const { subscribe, send } = useWs();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [phase, setPhase] = useState<CallPhase>(isCaller ? "ringing" : "connecting");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(callType === "video");
  const [sharingScreen, setSharingScreen] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const iceServers = await callsApi.getIceServers();
      if (cancelled) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === "video" });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
      setLocalStream(stream);

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => setRemoteStream(event.streams[0]);
      pc.onicecandidate = (event) => {
        if (event.candidate) send("call:ice-candidate", { callId, candidate: event.candidate });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setPhase("active");
        if (pc.connectionState === "failed") setPhase("failed");
      };

      if (!isCaller) {
        // Callee is ready to receive the offer as soon as it arrives.
        setPhase("connecting");
      }
    }

    setup();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    for (const candidate of pendingCandidatesRef.current) {
      await pc.addIceCandidate(candidate).catch(() => undefined);
    }
    pendingCandidatesRef.current = [];
  }, []);

  useEffect(() => {
    const offAccept = subscribe("call:accept", async (event) => {
      if ((event.payload as { callId: string }).callId !== callId || !isCaller) return;
      const pc = pcRef.current;
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send("call:sdp-offer", { callId, sdp: offer });
    });

    const offOffer = subscribe("call:sdp-offer", async (event) => {
      const payload = event.payload as { callId: string; sdp: RTCSessionDescriptionInit };
      if (payload.callId !== callId || isCaller) return;
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(payload.sdp);
      await flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send("call:sdp-answer", { callId, sdp: answer });
    });

    const offAnswer = subscribe("call:sdp-answer", async (event) => {
      const payload = event.payload as { callId: string; sdp: RTCSessionDescriptionInit };
      if (payload.callId !== callId || !isCaller) return;
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(payload.sdp);
      await flushPendingCandidates();
    });

    const offIce = subscribe("call:ice-candidate", async (event) => {
      const payload = event.payload as { callId: string; candidate: RTCIceCandidateInit };
      if (payload.callId !== callId) return;
      const pc = pcRef.current;
      if (pc?.remoteDescription) {
        await pc.addIceCandidate(payload.candidate).catch(() => undefined);
      } else {
        pendingCandidatesRef.current.push(payload.candidate);
      }
    });

    const offEnd = subscribe("call:end", (event) => {
      if ((event.payload as { callId: string }).callId !== callId) return;
      setPhase("ended");
      cleanup();
      onEnded?.();
    });

    const offReject = subscribe("call:reject", (event) => {
      if ((event.payload as { callId: string }).callId !== callId) return;
      setPhase("ended");
      cleanup();
      onEnded?.();
    });

    return () => {
      offAccept();
      offOffer();
      offAnswer();
      offIce();
      offEnd();
      offReject();
    };
  }, [callId, isCaller, subscribe, send, flushPendingCandidates, cleanup, onEnded]);

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
    const pc = pcRef.current;
    if (!pc) return;

    if (sharingScreen) {
      const camTrack = cameraTrackRef.current;
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && camTrack) await sender.replaceTrack(camTrack);
      setSharingScreen(false);
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(screenTrack);
      screenTrack.onended = () => {
        const camTrack = cameraTrackRef.current;
        if (sender && camTrack) sender.replaceTrack(camTrack);
        setSharingScreen(false);
      };
      setSharingScreen(true);
    } catch {
      // user cancelled the screen picker
    }
  }, [sharingScreen]);

  const hangUp = useCallback(() => {
    send("call:end", { callId });
    setPhase("ended");
    cleanup();
    onEnded?.();
  }, [callId, send, cleanup, onEnded]);

  return { localStream, remoteStream, phase, muted, cameraOn, sharingScreen, toggleMute, toggleCamera, toggleScreenShare, hangUp };
}
