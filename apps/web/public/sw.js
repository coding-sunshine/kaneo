// The app's service worker: installs the app and shows desktop pushes for
// mentions and direct messages. It caches nothing, so boards and live
// updates always come from the network.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

const chatUrl = (data) =>
  data &&
  data.kind === "chat" &&
  typeof data.workspaceId === "string" &&
  typeof data.chatChannelId === "string"
    ? `/dashboard/workspace/${encodeURIComponent(data.workspaceId)}/channels/${encodeURIComponent(data.chatChannelId)}${
        typeof data.messageId === "string"
          ? `?messageId=${encodeURIComponent(data.messageId)}`
          : ""
      }`
    : "/";

self.addEventListener("push", (event) => {
  let push = {};
  try {
    push = event.data ? event.data.json() : {};
  } catch {
    // An unreadable push still has to show something.
  }
  // A push must always show a notification, or the browser revokes it.
  event.waitUntil(
    self.registration.showNotification(push.title || self.location.host, {
      body: push.body || "",
      tag: push.tag,
      icon: "/web-app-manifest-192x192.png",
      data: { url: chatUrl(push.data) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const open = windows.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (open) return open.focus().then(() => open.navigate(url));
        return self.clients.openWindow(url);
      }),
  );
});
