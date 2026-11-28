import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useSyncExternalStore } from "react";

import { api } from "./api/endpoints";
import { pushStatus, type PushStatus } from "./push-status";
import { sessionStore } from "./session";

/**
 * Instant chat pushes: the phone's native APNs or FCM token is registered with the
 * server, which sends through Apple or Google once its operator sets the key. Until then,
 * and on API key sign-ins, the background check in `background.ts` is all there is.
 */
let status: PushStatus | null = null;
let registeredToken: string | null = null;
const listeners = new Set<() => void>();

function setStatus(next: PushStatus | null) {
  status = next;
  listeners.forEach((l) => l());
}

export function usePushStatus() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

async function register(token: string | null) {
  const session = sessionStore.get().session;
  if (!session) return;
  let delivering: boolean | null = null;
  if (token && session.credentialType === "bearer") {
    const platform = Platform.OS === "ios" ? "ios" : "android";
    delivering = (await api.registerPushDevice({ platform, token })).delivering;
    registeredToken = token;
  }
  const next = pushStatus({
    credentialType: session.credentialType,
    token,
    delivering,
  });
  if (next !== "on") console.info(`Kaneo chat pushes are off: ${next}`);
  setStatus(next);
}

/** Registers this phone for chat pushes. Call after notification permission is granted. */
export async function startPush() {
  let token: string | null = null;
  try {
    // Throws without the APNs entitlement or the Firebase config in the build.
    token = (await Notifications.getDevicePushTokenAsync()).data as string;
  } catch {
    token = null;
  }
  try {
    await register(token);
  } catch {
    setStatus(null);
  }
}

/** Apple and Google can rotate a token; the new one replaces the old on the server. */
export function watchPushToken() {
  const sub = Notifications.addPushTokenListener((next) => {
    void register(String(next.data)).catch(() => {});
  });
  return () => sub.remove();
}

/** Stops pushes to this phone. Runs before sign-out drops the credentials. */
export async function stopPush() {
  const token = registeredToken;
  const session = sessionStore.get().session;
  registeredToken = null;
  setStatus(null);
  if (token && session)
    await api.unregisterPushDevice(token, session).catch(() => {});
}
