import { createHmac } from "node:crypto";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { MAX_WEBHOOK_ATTEMPTS } from "../admin/webhooks/claim-webhook-delivery";
import db, { schema } from "../database";
import { decryptSecret } from "../notification-preferences/secrets";
import {
  OutboundRequestError,
  sendOutboundRequest,
} from "../utils/outbound-request";

const delivery = schema.workspaceWebhookDeliveryTable;
const webhook = schema.workspaceWebhookTable;
const now = sql`(clock_timestamp() AT TIME ZONE 'utc')`;

// Same lease, HMAC headers and 5s/30s backoff as the instance webhook worker.
async function claim() {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select({
        delivery,
        url: webhook.url,
        secret: webhook.secret,
        enabled: webhook.enabled,
      })
      .from(delivery)
      .innerJoin(webhook, eq(delivery.webhookId, webhook.id))
      .where(
        and(eq(delivery.state, "pending"), lte(delivery.nextAttemptAt, now)),
      )
      .orderBy(asc(delivery.nextAttemptAt), asc(delivery.id))
      .limit(1)
      .for("update", { of: delivery, skipLocked: true });
    if (!job) return null;
    const stop = !job.enabled
      ? "disabled"
      : job.delivery.attempts >= MAX_WEBHOOK_ATTEMPTS
        ? "interrupted"
        : null;
    if (stop) {
      await tx
        .update(delivery)
        .set({ state: "failed", errorCode: stop })
        .where(eq(delivery.id, job.delivery.id));
      return null;
    }
    const attempts = job.delivery.attempts + 1;
    await tx
      .update(delivery)
      .set({
        attempts,
        nextAttemptAt: sql`${now} + interval '1 minute'`,
      })
      .where(eq(delivery.id, job.delivery.id));
    return { ...job, delivery: { ...job.delivery, attempts } };
  });
}

export async function sendWorkspaceWebhookDelivery() {
  const job = await claim();
  if (!job) return false;
  const { delivery: row, url, secret: encrypted } = job;
  let statusCode: number | null = null;
  let errorCode: string | null = null;
  let retryable = false;
  try {
    const secret = decryptSecret(encrypted);
    if (!secret) throw new Error("Missing signing secret");
    const body = JSON.stringify(row.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret)
      .update(`${timestamp}.${body}`)
      .digest("hex");
    statusCode = (await sendOutboundRequest(
      url,
      {
        body,
        headers: {
          "content-type": "application/json",
          "x-kaneo-timestamp": timestamp,
          "x-kaneo-signature": `sha256=${signature}`,
          "x-kaneo-delivery": row.id,
        },
      },
      { publicDestination: true, readStatus: true, timeoutMs: 5_000 },
    )) as number;
  } catch (error) {
    errorCode =
      error instanceof OutboundRequestError ? error.reason : "signing";
    statusCode =
      error instanceof OutboundRequestError ? (error.status ?? null) : null;
    retryable =
      errorCode === "network" ||
      errorCode === "timeout" ||
      (errorCode === "http" &&
        (statusCode === 408 || statusCode === 429 || (statusCode ?? 0) >= 500));
  }
  const retry =
    errorCode !== null && retryable && row.attempts < MAX_WEBHOOK_ATTEMPTS;
  await db
    .update(delivery)
    .set({
      state: retry ? "pending" : errorCode ? "failed" : "succeeded",
      statusCode,
      errorCode,
      nextAttemptAt: sql`${now} + ${row.attempts === 1 ? 5 : 30} * interval '1 second'`,
    })
    .where(
      and(
        eq(delivery.id, row.id),
        eq(delivery.state, "pending"),
        eq(delivery.attempts, row.attempts),
      ),
    );
  // Keep the newest 20 finished deliveries per webhook.
  await db.execute(sql`
    DELETE FROM workspace_webhook_delivery
    WHERE webhook_id = ${row.webhookId} AND state <> 'pending'
      AND id NOT IN (
        SELECT id FROM workspace_webhook_delivery
        WHERE webhook_id = ${row.webhookId} AND state <> 'pending'
        ORDER BY created_at DESC, id DESC LIMIT 20
      )
  `);
  return true;
}

export function startWorkspaceWebhookWorker() {
  let running: Promise<unknown> | null = null;
  const tick = () => {
    if (running) return;
    running = sendWorkspaceWebhookDelivery()
      .catch(() => {
        console.error("Workspace webhook delivery worker failed");
      })
      .finally(() => {
        running = null;
      });
  };
  const timer = setInterval(tick, 1_000);
  timer.unref();
  tick();
  return async () => {
    clearInterval(timer);
    await running;
  };
}
