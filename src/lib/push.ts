import * as pushApi from "./api/push.api";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from(Array.from(raw).map((c) => c.charCodeAt(0)));
}

export async function subscribePush(): Promise<void> {
  if (!isPushSupported()) throw new Error("Push notifications are not supported in this browser");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied");

  const publicKey = await pushApi.getVapidPublicKey();
  if (!publicKey) throw new Error("Push is not configured on the server");

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });

  await pushApi.registerToken({
    platform: "web",
    token: subscription.endpoint,
    subscription: subscription.toJSON(),
  });
}

export async function unsubscribePush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await pushApi.unregisterToken(subscription.endpoint);
  await subscription.unsubscribe();
}
