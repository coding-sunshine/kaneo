import { resolveFileSecret } from "../../utils/file-secret";

export type CallConfig = { url: string; apiKey: string; apiSecret: string };

// Calls run on a LiveKit server the operator provides (self-hosted or cloud).
// Without all three values the feature stays off.
export function readCallConfig(): CallConfig | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = resolveFileSecret("LIVEKIT_API_SECRET")?.trim();
  return url && apiKey && apiSecret ? { url, apiKey, apiSecret } : null;
}

// For the public config: says whether calls are set up without reading the
// secret file, so a bad file fails the call routes, not the login screen.
export function callsConfigured() {
  return Boolean(
    process.env.LIVEKIT_URL?.trim() &&
    process.env.LIVEKIT_API_KEY?.trim() &&
    (process.env.LIVEKIT_API_SECRET?.trim() ||
      process.env.LIVEKIT_API_SECRET_FILE),
  );
}

let toldOff = false;

export function logCallsOffOnce() {
  if (toldOff) return;
  toldOff = true;
  console.info(
    "Calls are off: set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to turn them on.",
  );
}
