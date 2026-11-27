/**
 * Paths whose answer says whether a password or code was right. A success
 * there gives its charge back, so only failed guesses fill an account's
 * limit. Everywhere else (mail-sending paths among them) every request
 * counts, or a named person could be sent mail without end.
 */
const CREDENTIAL_PATHS = new Set([
  "/sign-in/email",
  "/sign-in/username",
  "/sign-in/email-otp",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/two-factor/verify-otp",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
  "/change-password",
  "/email-otp/verify-email",
]);

export const isCredentialPath = (path: string) => CREDENTIAL_PATHS.has(path);
