import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";

import { notificationRoute } from "@/lib/notification-route";

/** Opens the task or chat channel behind a tapped system notification. */
export function NotificationOpener({ enabled }: { enabled: boolean }) {
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!response) return;
    const id = response.notification.request.identifier;
    if (handled.current === id) return;
    // Handle each tap once, and drop taps made while signed out, so a later sign-in never
    // replays a notification from an earlier session.
    handled.current = id;
    Notifications.clearLastNotificationResponse();
    const route = notificationRoute(
      response.notification.request.content.data ?? undefined,
    );
    if (enabled && route) router.push(route);
  }, [response, enabled]);
  return null;
}
