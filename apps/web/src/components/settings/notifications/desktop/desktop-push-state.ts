export type DesktopPushState =
  | "unsupported"
  | "server-off"
  | "denied"
  | "on"
  | "off";

/** What the desktop row shows, from the browser and the server. */
export function desktopPushState(input: {
  supported: boolean;
  publicKey: string | null;
  permission: NotificationPermission;
  subscribed: boolean;
}): DesktopPushState {
  if (!input.supported) return "unsupported";
  if (!input.publicKey) return "server-off";
  if (input.permission === "denied") return "denied";
  return input.permission === "granted" && input.subscribed ? "on" : "off";
}
