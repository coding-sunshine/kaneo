import { afterEach, vi } from "vite-plus/test";
import {
  assertTestDatabaseUrl,
  baseTestDatabaseUrl,
  workerTestDatabaseUrl,
} from "./test-database-url";

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

process.env.DATABASE_URL = workerTestDatabaseUrl(baseTestDatabaseUrl());
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
