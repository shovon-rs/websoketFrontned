"use client";
import { AuthProvider } from "@/lib/auth-context";
import { WsProvider } from "@/lib/ws-context";
import { IncomingCallBanner } from "./IncomingCallBanner";
import { NotificationSoundListener } from "./NotificationSoundListener";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <WsProvider>
        {children}
        <IncomingCallBanner />
        <NotificationSoundListener />
      </WsProvider>
    </AuthProvider>
  );
}
