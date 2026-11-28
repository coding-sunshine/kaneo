export type PushStatus = "on" | "serverOff" | "needsSession" | "noToken";

/**
 * Whether new chat messages reach this phone right away. Pushes ride on a
 * sign-in session, so an API key sign-in never gets them.
 */
export function pushStatus(input: {
  credentialType: "bearer" | "apiKey";
  token: string | null;
  delivering: boolean | null;
}): PushStatus {
  if (input.credentialType !== "bearer") return "needsSession";
  if (!input.token) return "noToken";
  return input.delivering ? "on" : "serverOff";
}
