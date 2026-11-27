import { and, eq, gte, inArray, sql } from "drizzle-orm";
import db from "../database";
import { emailIntakeFailureTable } from "../database/schema";
import { withJobLease } from "../scheduler/leader-lock";
import {
  addressedTokens,
  EMAIL_INTAKE_ENV_HINT,
  readEmailIntakeConfig,
} from "./config";
import { ingestEmail } from "./ingest-email";
import { parseEmail } from "./parse-email";
import { openPop3 } from "./pop3-client";

// Messages for other recipients stay in the mailbox (a shared catcher also
// holds the replies this instance sends), so remember them instead of
// reading their headers on every poll.
const skipped = new Set<string>();

let reportedOff = false;

/** Logs once that intake is off when the mailbox settings are missing. */
export function reportEmailIntakeStatus() {
  if (readEmailIntakeConfig() || reportedOff) return;
  reportedOff = true;
  console.log(
    `📭 Email intake is off: ${EMAIL_INTAKE_ENV_HINT} to turn it on.`,
  );
}

export const MAX_EMAIL_BYTES = 5 * 1024 * 1024;
export const MAX_ATTEMPTS = 5;
const MAX_SKIPPED = 10_000;

async function recordFailure(uid: string) {
  const [row] = await db
    .insert(emailIntakeFailureTable)
    .values({ uid })
    .onConflictDoUpdate({
      target: emailIntakeFailureTable.uid,
      set: {
        attempts: sql`${emailIntakeFailureTable.attempts} + 1`,
        lastFailedAt: new Date(),
      },
    })
    .returning({ attempts: emailIntakeFailureTable.attempts });
  return row?.attempts ?? 1;
}

/**
 * Reads the intake mailbox once. Mail addressed to a team is filed and then
 * deleted. A message that fails to file stays for the next poll, up to five
 * attempts; after that it stays in the mailbox unread.
 */
export async function pollIntakeMailbox() {
  const config = readEmailIntakeConfig();
  if (!config) {
    reportEmailIntakeStatus();
    return { filed: 0, degraded: false };
  }
  return withJobLease(
    "email-intake",
    async () => {
      const mailbox = await openPop3(config.pop3);
      let filed = 0;
      let degraded = false;
      try {
        const listed = await mailbox.list();
        const uids = new Set(listed.map(({ uid }) => uid));
        for (const uid of skipped) if (!uids.has(uid)) skipped.delete(uid);
        const failed = new Set(
          uids.size === 0
            ? []
            : (
                await db
                  .select({ uid: emailIntakeFailureTable.uid })
                  .from(emailIntakeFailureTable)
                  .where(
                    and(
                      inArray(emailIntakeFailureTable.uid, [...uids]),
                      gte(emailIntakeFailureTable.attempts, MAX_ATTEMPTS),
                    ),
                  )
              ).map((row) => row.uid),
        );
        for (const { number, uid } of listed) {
          if (skipped.has(uid) || failed.has(uid)) continue;
          // Checked before reading anything: one huge message must not
          // exhaust memory or the parser.
          if ((await mailbox.size(number)) > MAX_EMAIL_BYTES) {
            console.warn(
              `Deleted an intake email over ${MAX_EMAIL_BYTES} bytes without reading it (uid ${uid})`,
            );
            await mailbox.remove(number);
            continue;
          }
          const headers = parseEmail(await mailbox.headers(number));
          if (addressedTokens(config, headers.recipients).length === 0) {
            if (skipped.size >= MAX_SKIPPED) skipped.clear();
            skipped.add(uid);
            continue;
          }
          const raw = await mailbox.retrieve(number);
          try {
            const result = await ingestEmail(raw, config);
            filed += result.tickets.length + result.replies.length;
            await mailbox.remove(number);
            await db
              .delete(emailIntakeFailureTable)
              .where(eq(emailIntakeFailureTable.uid, uid));
          } catch (error) {
            degraded = true;
            const attempts = await recordFailure(uid);
            console.error(
              `Failed to file an intake email (uid ${uid}, attempt ${attempts} of ${MAX_ATTEMPTS})`,
              error instanceof Error ? error.message : error,
            );
          }
        }
        await mailbox.quit();
      } catch (error) {
        mailbox.close();
        throw error;
      }
      return { filed, degraded };
    },
    () => ({ filed: 0, degraded: false }),
    5 * 60 * 1000,
  );
}
