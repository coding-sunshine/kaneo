import { normalizeApiServerUrl } from "./openapi-spec";

/** Where a stored file is read back from. */
export const apiBaseUrl = (requestUrl: string) =>
  normalizeApiServerUrl(
    process.env.KANEO_API_URL || new URL(requestUrl).origin,
  );
