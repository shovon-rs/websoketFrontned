self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Relay", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Relay", {
      body: payload.body ?? "",
      icon: "/icon.png",
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/notifications"));
});
