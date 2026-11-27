import { randomUUID } from "node:crypto";
import { and, eq, lte } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { jobLeaseTable } from "../database/schema";

// One export at a time per workspace, and one a minute. The lease lives in
// the database so every API instance sees it, with or without Redis.
const COOLDOWN_MS = 60_000;
// A running export holds the lease this long; a crashed one frees it then.
const RUNNING_MS = 30 * 60_000;

function tooSoon(retryAfterSeconds: number) {
  return new HTTPException(429, {
    res: new Response(
      JSON.stringify({
        message:
          "An export of this workspace ran less than a minute ago or is still running",
        code: "EXPORT_COOLDOWN",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSeconds),
        },
      },
    ),
  });
}

/** Takes the workspace's export lease, or throws 429 with Retry-After. */
export async function takeExportLease(workspaceId: string) {
  const name = `workspace-export:${workspaceId}`;
  const owner = randomUUID();
  const startedAt = new Date();
  const [taken] = await db
    .insert(jobLeaseTable)
    .values({
      name,
      owner,
      expiresAt: new Date(startedAt.getTime() + RUNNING_MS),
    })
    .onConflictDoUpdate({
      target: jobLeaseTable.name,
      set: { owner, expiresAt: new Date(startedAt.getTime() + RUNNING_MS) },
      setWhere: lte(jobLeaseTable.expiresAt, startedAt),
    })
    .returning({ owner: jobLeaseTable.owner });
  if (taken?.owner !== owner) {
    const [held] = await db
      .select({ expiresAt: jobLeaseTable.expiresAt })
      .from(jobLeaseTable)
      .where(eq(jobLeaseTable.name, name));
    const left = (held?.expiresAt.getTime() ?? 0) - Date.now();
    throw tooSoon(Math.min(60, Math.max(1, Math.ceil(left / 1000))));
  }
  // Done: the next export may start a minute after this one started.
  return async () => {
    await db
      .update(jobLeaseTable)
      .set({ expiresAt: new Date(startedAt.getTime() + COOLDOWN_MS) })
      .where(and(eq(jobLeaseTable.name, name), eq(jobLeaseTable.owner, owner)));
  };
}
