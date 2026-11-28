/** The server's coding agent, or null while its address or key is not set. */
export function codingAgentConfig() {
  const url = process.env.CODING_AGENT_URL?.trim();
  const key = process.env.CODING_AGENT_API_KEY?.trim();
  if (!url || !key) return null;
  return {
    url: url.replace(/\/+$/, ""),
    key,
    name: process.env.CODING_AGENT_NAME?.trim() || "Coding agent",
  };
}

let warned = false;

/** Logs once that delegation is off, so an admin can see why. */
export function warnCodingAgentOff() {
  if (warned) return;
  warned = true;
  console.warn(
    "Coding agent delegation is off: set CODING_AGENT_URL and CODING_AGENT_API_KEY to turn it on.",
  );
}
