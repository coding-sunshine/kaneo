import { createHash, randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gunzipSync } from "node:zlib";
import { eq, sql } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vite-plus/test";
import { runBackupIfDue } from "../../apps/api/src/backup/run-backup-if-due";
import { scratchDatabaseName } from "../../apps/api/src/backup/scratch-database";
import db, { schema } from "../../apps/api/src/database";
import {
  backupRunTable,
  chatChannelTable,
  chatMessageTable,
} from "../../apps/api/src/database/schema";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import {
  insertInstanceRole,
  signInWithRole,
} from "./helpers/admin/instance-roles";
import { resetTestDatabase } from "./helpers/database";
import { createRestrictedWorkspace } from "./helpers/project-access/create-restricted-workspace";
import { projectAccessApi } from "./helpers/project-access/project-access-api";

// A stand-in for the offsite bucket: path-style S3 PUT, HEAD and GET.
type FakeBucket = {
  objects: Map<string, Buffer>;
  failPuts: boolean;
  server: Server;
  endpoint: string;
};

async function startFakeBucket(): Promise<FakeBucket> {
  const bucket = {
    objects: new Map<string, Buffer>(),
    failPuts: false,
  } as FakeBucket;
  bucket.server = createServer((req, res) => {
    const key = decodeURIComponent(
      (req.url ?? "").split("?")[0].replace(/^\/backups-bucket\//, ""),
    );
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      if (req.method === "PUT") {
        if (bucket.failPuts) {
          res.writeHead(500, { "content-type": "application/xml" });
          res.end(
            "<Error><Code>InternalError</Code><Message>offsite down</Message></Error>",
          );
          return;
        }
        bucket.objects.set(key, Buffer.concat(chunks));
        res.writeHead(200, { etag: '"etag"' });
        res.end();
        return;
      }
      const body = bucket.objects.get(key);
      if (!body) {
        res.writeHead(404, { "content-type": "application/xml" });
        res.end("<Error><Code>NoSuchKey</Code></Error>");
        return;
      }
      res.writeHead(200, {
        "content-length": String(body.length),
        "content-type": "application/gzip",
        etag: '"etag"',
      });
      res.end(req.method === "HEAD" ? undefined : body);
    });
  });
  await new Promise<void>((resolve) =>
    bucket.server.listen(0, "127.0.0.1", resolve),
  );
  const { port } = bucket.server.address() as AddressInfo;
  bucket.endpoint = `http://127.0.0.1:${port}`;
  return bucket;
}

const BACKUP_ENV = [
  "BACKUP_S3_BUCKET",
  "BACKUP_S3_ENDPOINT",
  "BACKUP_S3_ACCESS_KEY_ID",
  "BACKUP_S3_SECRET_ACCESS_KEY",
  "BACKUP_S3_REGION",
  "BACKUP_S3_ACCESS_KEY_ID_FILE",
  "BACKUP_S3_SECRET_ACCESS_KEY_FILE",
];

let bucket: FakeBucket;

function configureOffsite() {
  process.env.BACKUP_S3_BUCKET = "backups-bucket";
  process.env.BACKUP_S3_ENDPOINT = bucket.endpoint;
  process.env.BACKUP_S3_ACCESS_KEY_ID = "test-backup-key";
  process.env.BACKUP_S3_SECRET_ACCESS_KEY = "test-backup-secret";
  process.env.BACKUP_S3_REGION = "us-east-1";
}

beforeAll(async () => {
  bucket = await startFakeBucket();
});

afterAll(async () => {
  await new Promise((resolve) => bucket.server.close(resolve));
});

beforeEach(async () => {
  await resetTestDatabase();
  for (const name of BACKUP_ENV) delete process.env[name];
  bucket.objects.clear();
  bucket.failPuts = false;
});

afterEach(() => {
  for (const name of BACKUP_ENV) delete process.env[name];
});

async function seedContent() {
  const ctx = await createRestrictedWorkspace();
  await db.insert(schema.documentTable).values([
    {
      workspaceId: ctx.workspace.id,
      title: "Runbook",
      scope: "workspace",
      creatorId: ctx.owner.id,
    },
    {
      workspaceId: ctx.workspace.id,
      title: "Plan",
      scope: "workspace",
      creatorId: ctx.owner.id,
    },
  ]);
  const [channel] = await db
    .insert(chatChannelTable)
    .values({ workspaceId: ctx.workspace.id, name: "general" })
    .returning();
  await db.insert(chatMessageTable).values(
    ["one", "two", "three"].map((body) => ({
      channelId: channel.id,
      userId: ctx.owner.id,
      body,
    })),
  );
  return ctx;
}

async function databaseExists(name: string) {
  const result = await db.execute(
    sql`SELECT 1 FROM pg_database WHERE datname = ${name}`,
  );
  return (result.rowCount ?? 0) > 0;
}

type BackupStatus = {
  enabled: boolean;
  missingEnv: string[];
  lastRun: {
    status: string;
    startedAt: string;
    sizeBytes: number | null;
    offsiteStatus: string | null;
    errorCode: string | null;
  } | null;
  lastSuccess: {
    startedAt: string;
    sizeBytes: number | null;
    offsiteStatus: string | null;
  } | null;
};

describe("scheduled backups", () => {
  it("stays off and says which settings are missing without offsite keys", async () => {
    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);

    await runBackupIfDue();

    expect(await db.select().from(backupRunTable)).toEqual([]);
    const response = await projectAccessApi()("/admin/backups");
    expect(response.status).toBe(200);
    const body = (await response.json()) as BackupStatus;
    expect(body.enabled).toBe(false);
    expect(body.missingEnv).toEqual([
      "BACKUP_S3_BUCKET",
      "BACKUP_S3_ACCESS_KEY_ID",
      "BACKUP_S3_SECRET_ACCESS_KEY",
    ]);
    expect(body.lastRun).toBeNull();

    const restore = await projectAccessApi()("/admin/backups/test-restore", {
      method: "POST",
    });
    expect(restore.status).toBe(409);
  });

  it("limits status to system:read and the restore test to instance:settings", async () => {
    configureOffsite();
    mockAnonymousSession();
    expect((await projectAccessApi()("/admin/backups")).status).toBe(401);
    expect(
      (
        await projectAccessApi()("/admin/backups/test-restore", {
          method: "POST",
        })
      ).status,
    ).toBe(401);

    const ctx = await createRestrictedWorkspace();
    mockAuthenticatedSession(ctx.owner);
    expect((await projectAccessApi()("/admin/backups")).status).toBe(403);
    expect(
      (
        await projectAccessApi()("/admin/backups/test-restore", {
          method: "POST",
        })
      ).status,
    ).toBe(403);
  });

  it("lets a read-only system role see status but not run a restore test", async () => {
    configureOffsite();
    const { app } = createApp();
    await insertInstanceRole("observer", ["system:read"]);
    const observer = await signInWithRole(app, "observer");

    expect((await observer.api("/backups")).status).toBe(200);
    expect(
      (await observer.api("/backups/test-restore", { method: "POST" })).status,
    ).toBe(403);
  });

  it("rejects API keys even when they belong to an administrator", async () => {
    configureOffsite();
    const admin = await createInstanceAdmin();
    const key = `test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: admin.id,
      userId: admin.id,
      key: createHash("sha256").update(key).digest("base64url"),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockAnonymousSession();
    const request = projectAccessApi({ "x-api-key": key });
    expect((await request("/admin/backups")).status).toBe(403);
    expect(
      (await request("/admin/backups/test-restore", { method: "POST" })).status,
    ).toBe(403);
  });

  it("backs up once a day to the offsite bucket and restores it with matching counts", async () => {
    configureOffsite();
    await seedContent();

    await runBackupIfDue();
    await runBackupIfDue();

    const runs = await db.select().from(backupRunTable);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      status: "succeeded",
      offsiteStatus: "ok",
      counts: { tickets: 2, documents: 2, chatMessages: 3 },
    });
    const stored = bucket.objects.get(runs[0].objectKey ?? "");
    expect(stored?.length).toBe(runs[0].sizeBytes);
    expect(gunzipSync(stored ?? Buffer.alloc(0)).toString()).toContain(
      '"format":"kaneo-backup"',
    );

    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const status = (await (
      await projectAccessApi()("/admin/backups")
    ).json()) as BackupStatus;
    expect(status.enabled).toBe(true);
    expect(status.lastSuccess?.offsiteStatus).toBe("ok");
    expect(status.lastSuccess?.sizeBytes).toBeGreaterThan(0);
    expect(
      Date.now() - Date.parse(status.lastSuccess?.startedAt ?? ""),
    ).toBeLessThan(24 * 60 * 60 * 1000);

    // Rows written after the dump are not in it; the test compares with the
    // counts taken in the dump's snapshot and also reports live counts.
    const restore = await projectAccessApi()("/admin/backups/test-restore", {
      method: "POST",
    });
    expect(restore.status).toBe(200);
    expect(await restore.json()).toMatchObject({
      status: "passed",
      errorCode: null,
      restored: { tickets: 2, documents: 2, chatMessages: 3 },
      live: { tickets: 2, documents: 2, chatMessages: 3 },
      atBackup: { tickets: 2, documents: 2, chatMessages: 3 },
    });
    expect(
      await databaseExists(scratchDatabaseName(process.env.DATABASE_URL ?? "")),
    ).toBe(false);
  });

  it("records a failed backup when the offsite copy fails", async () => {
    configureOffsite();
    bucket.failPuts = true;

    await runBackupIfDue();

    const [run] = await db.select().from(backupRunTable);
    expect(run).toMatchObject({ status: "failed", offsiteStatus: "failed" });
    expect(run.errorCode).not.toContain("127.0.0.1");

    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const status = (await (
      await projectAccessApi()("/admin/backups")
    ).json()) as BackupStatus;
    expect(status.lastRun?.status).toBe("failed");
    expect(status.lastSuccess).toBeNull();

    // A failure is retried on a later tick, not held off for a day.
    bucket.failPuts = false;
    await db
      .update(backupRunTable)
      .set({ startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
      .where(eq(backupRunTable.id, run.id));
    await runBackupIfDue();
    const runs = await db.select().from(backupRunTable);
    expect(runs.map((r) => r.status).sort()).toEqual(["failed", "succeeded"]);
  });
});
