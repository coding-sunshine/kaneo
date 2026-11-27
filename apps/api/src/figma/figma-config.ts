import { resolveFileSecret } from "../utils/file-secret";

// Read at request time so an operator can add the token without a code change
// and tests can switch the feature on and off.
export function readFigmaToken() {
  return resolveFileSecret("FIGMA_ACCESS_TOKEN")?.trim() || null;
}

// For the public config: does not read the secret file, so a bad file fails
// the preview routes, not the login screen.
export function figmaConfigured() {
  return Boolean(
    process.env.FIGMA_ACCESS_TOKEN?.trim() ||
    process.env.FIGMA_ACCESS_TOKEN_FILE,
  );
}

let toldOff = false;

export function logFigmaOffOnce() {
  if (toldOff) return;
  toldOff = true;
  console.info(
    "Figma link cards are off: set FIGMA_ACCESS_TOKEN to turn them on. Figma links still show as plain links.",
  );
}
