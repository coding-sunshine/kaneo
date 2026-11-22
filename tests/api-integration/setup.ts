import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, vi } from "vite-plus/test";

// Prevent dotenv-mono from loading the local .env file during tests.
// All env vars are set explicitly below; the .env file must be ignored.
vi.mock("dotenv-mono", () => ({
  config: () => {},
}));

// Password hashing at the production cost (10) takes ~70ms of pure-JS CPU per
// sign-up and per sign-in. Cost 4 runs the same code path in ~1ms. bcryptjs is
// a dependency of apps/api only, so the mock names it by that path.
vi.mock(
  "../../apps/api/node_modules/bcryptjs/index.js",
  async (importOriginal) => {
    const { default: bcrypt } =
      await importOriginal<typeof import("bcryptjs")>();
    return {
      default: { ...bcrypt, hash: (value: string) => bcrypt.hash(value, 4) },
    };
  },
);

function stripEnvValueQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function deriveTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");

  if (!databaseName || databaseName.endsWith("_test")) {
    return connectionString;
  }

  url.pathname = `/${databaseName}_test`;
  return url.toString();
}

// Each Vitest worker gets its own database so test files can run in parallel
// without resetting each other's rows: kaneo_test becomes kaneo_w3_test.
function workerTestDatabaseUrl(connectionString: string) {
  const poolId = process.env.VITEST_POOL_ID;
  if (!poolId) {
    return connectionString;
  }

  const url = new URL(connectionString);
  url.pathname = url.pathname.replace(/_test$/, `_w${poolId}_test`);
  return url.toString();
}

function assertTestDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  const databaseName = url.pathname.replace(/^\//, "");
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Integration tests require DATABASE_URL to use a database name ending in _test (got "${databaseName}")`,
    );
  }
}

function readDatabaseUrlFromEnvFile() {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(currentDir, "../../.env");

  if (!existsSync(envPath)) {
    return null;
  }

  const envFile = readFileSync(envPath, "utf8");
  const match = envFile.match(/^DATABASE_URL=(.+)$/m);
  const raw = match?.[1]?.trim();
  return raw ? stripEnvValueQuotes(raw) : null;
}

const defaultTestDatabaseUrl =
  "postgresql://postgres:postgres@localhost:5432/kaneo_test";
const envDatabaseUrl = process.env.DATABASE_URL?.trim();
const fromEnv = envDatabaseUrl ? stripEnvValueQuotes(envDatabaseUrl) : "";
const rawDatabaseUrl =
  fromEnv || readDatabaseUrlFromEnvFile() || defaultTestDatabaseUrl;
process.env.DATABASE_URL = workerTestDatabaseUrl(
  deriveTestDatabaseUrl(rawDatabaseUrl),
);
assertTestDatabaseUrl(process.env.DATABASE_URL);

process.env.NODE_ENV = "test";
process.env.AUTH_SECRET = "test-secret-with-at-least-32-chars";
process.env.KANEO_API_URL = "http://localhost:1337";
process.env.KANEO_CLIENT_URL = "http://localhost:5173";
process.env.DISABLE_GUEST_ACCESS = "false";
process.env.DISABLE_REGISTRATION = "false";
process.env.DISABLE_PASSWORD_REGISTRATION = "false";
process.env.DISABLE_EMAIL_OTP_SIGN_IN = "false";
process.env.DISABLE_LOGIN_FORM = "";
process.env.DEMO_MODE = "false";
process.env.SMTP_HOST = "";
process.env.SMTP_PORT = "";
process.env.SMTP_SECURE = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASSWORD = "";
process.env.GITHUB_OAUTH_CLIENT_ID = "";
process.env.GITHUB_OAUTH_CLIENT_SECRET = "";
process.env.GITHUB_CLIENT_ID = "";
process.env.GITHUB_CLIENT_SECRET = "";
process.env.GOOGLE_CLIENT_ID = "";
process.env.GOOGLE_CLIENT_SECRET = "";
process.env.DISCORD_CLIENT_ID = "";
process.env.DISCORD_CLIENT_SECRET = "";
process.env.CUSTOM_OAUTH_CLIENT_ID = "";
process.env.CUSTOM_OAUTH_CLIENT_SECRET = "";
process.env.CUSTOM_OAUTH_AUTHORIZATION_URL = "";
process.env.CUSTOM_OAUTH_TOKEN_URL = "";
process.env.CUSTOM_OAUTH_USER_INFO_URL = "";
process.env.CUSTOM_OAUTH_SCOPES = "";
process.env.CUSTOM_OAUTH_RESPONSE_TYPE = "";
process.env.CUSTOM_OAUTH_DISCOVERY_URL = "";
process.env.CUSTOM_OAUTH_BACKCHANNEL_LOGOUT = "";
process.env.CUSTOM_OAUTH_AUTO_LOGIN = "";
process.env.CUSTOM_OAUTH_NAME = "";
process.env.CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS = "";
process.env.CUSTOM_OAUTH_ACCOUNT_URL = "";
process.env.DEVICE_AUTH_CLIENT_IDS = "kaneo-cli";

afterEach(() => {
  vi.restoreAllMocks();
});
