import { getBackupStatus } from "../backup/get-backup-status";
import { backupStatusSchema, restoreTestResultSchema } from "../backup/schema";
import { testRestore } from "../backup/test-restore";
import {
  apiRouter,
  createRoute,
  errorResponse,
  jsonResponse,
} from "../openapi";
import { requireUserSession } from "../utils/require-user-session";
import { requireInstancePermission } from "./roles/require-instance-permission";

const forbidden = errorResponse(
  "The caller lacks the instance permission or used an API key",
);

const getBackupStatusRoute = createRoute({
  method: "get",
  operationId: "getAdminBackupStatus",
  path: "/",
  tags: ["Admin"],
  summary: "Get backup status",
  description:
    "Whether scheduled backups are on, the latest backup run and the latest successful one with its size and offsite copy state. Requires the `system:read` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("system:read"),
  ] as const,
  responses: {
    200: jsonResponse("Backup status", backupStatusSchema),
    403: forbidden,
  },
});

const testRestoreRoute = createRoute({
  method: "post",
  operationId: "testAdminBackupRestore",
  path: "/test-restore",
  tags: ["Admin"],
  summary: "Test restoring the latest backup",
  description:
    "Download the latest offsite backup, restore it into a scratch database, compare ticket, document and chat message counts, then drop the scratch database. Requires the `instance:settings` instance permission; API keys are rejected.",
  middleware: [
    requireUserSession,
    requireInstancePermission("instance:settings"),
  ] as const,
  responses: {
    200: jsonResponse("The restore test result", restoreTestResultSchema),
    403: forbidden,
    409: errorResponse(
      "Backups are off, there is no backup yet, or a restore test is already running",
    ),
  },
});

const adminBackupRoutes = apiRouter()
  .openapi(getBackupStatusRoute, async (c) => {
    c.header("cache-control", "no-store");
    return c.json(await getBackupStatus(), 200);
  })
  .openapi(testRestoreRoute, async (c) => c.json(await testRestore(), 200));

export default adminBackupRoutes;
