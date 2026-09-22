// Mirrors src/lib/notification-destination.ts's routing rules — plain JS since a service worker
// can't import the app's TS modules. Only used when the push payload didn't already include an
// explicit `url` (see push-dispatcher.service.ts on the backend).
function urlFromPushData(data) {
  if (!data) return "/notifications";
  if (typeof data.conversationId === "string") return `/chat/${data.conversationId}`;
  if (typeof data.callId === "string") return `/call/${data.callId}`;
  if (typeof data.documentId === "string") return `/collab/${data.documentId}`;
  if (data.kind === "tracking:shared" || typeof data.sessionId === "string") return "/tracking";
  if (typeof data.announcementId === "string") return `/live/${data.announcementId}`;
  if (data.kind === "livestream-request") return "/live";
  if (typeof data.taskId === "string") return `/tasks/${data.taskId}`;
  return "/notifications";
}

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Relay", body: event.data.text() };
  }

  const data = payload.data ?? {};
  if (!data.url) data.url = urlFromPushData(data);

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Relay", {
      body: payload.body ?? "",
      icon: "/icon.png",
      data,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client) client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
