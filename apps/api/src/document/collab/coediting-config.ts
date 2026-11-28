import { ApiError } from "../../errors/api-error";

// The owner's approval of keeping live edits as Yjs state. Read per call so
// an operator can turn it on without a code change and tests can switch it.
export const COEDITING_KEY_ENV = "DOCUMENT_COEDITING_KEY";

export function coeditingOn() {
  return Boolean(process.env[COEDITING_KEY_ENV]?.trim());
}

let toldOff = false;

export function logCoeditingOffOnce() {
  if (toldOff) return;
  toldOff = true;
  console.info(
    `Document co-editing is off: set ${COEDITING_KEY_ENV} once the owner has approved storing live edits as Yjs state. Documents still warn before a save overwrites a newer version.`,
  );
}

export function assertCoeditingOn() {
  if (coeditingOn()) return;
  logCoeditingOffOnce();
  throw new ApiError(409, {
    code: "COEDITING_OFF",
    message: "Co-editing is off on this instance",
  });
}
