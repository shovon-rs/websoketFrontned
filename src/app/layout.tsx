import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Relay — Realtime workspace", description: "One place for conversations, work, and live collaboration." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
