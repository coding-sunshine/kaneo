import { and, eq, TransactionRollbackError } from "drizzle-orm";
import db from "../database";
import {
  dailyBriefPreferenceTable,
  dailyBriefTable,
  userProfileTable,
  workspaceUserTable,
} from "../database/schema";
import {
  dispatchNotification,
  persistNotification,
} from "../notification/controllers/create-notification";
import { workspaceIsActive } from "../workspace/archive/active-workspace-sql";
import { gatherBrief } from "./gather-brief";
import { localTime } from "./local-time";

/** Briefs go out from this local hour on, once per local day. */
export const BRIEF_HOUR = 8;

/**
 * Puts one brief in the Inbox of everyone who turned it on and whose local
 * morning has come, at most once per workspace and local day.
 */
export async function runDailyBriefs(now = new Date()) {
  const people = await db
    .select({
      workspaceId: dailyBriefPreferenceTable.workspaceId,
      userId: dailyBriefPreferenceTable.userId,
      timeZone: userProfileTable.timeZone,
    })
    .from(dailyBriefPreferenceTable)
    .innerJoin(
      workspaceUserTable,
      and(
        eq(
          workspaceUserTable.workspaceId,
          dailyBriefPreferenceTable.workspaceId,
        ),
        eq(workspaceUserTable.userId, dailyBriefPreferenceTable.userId),
      ),
    )
    .leftJoin(
      userProfileTable,
      eq(userProfileTable.userId, dailyBriefPreferenceTable.userId),
    )
    .where(
      and(
        eq(dailyBriefPreferenceTable.enabled, true),
        workspaceIsActive(dailyBriefPreferenceTable.workspaceId),
      ),
    );

  let sent = 0;
  for (const person of people) {
    const { day, hour } = localTime(now, person.timeZone);
    if (hour < BRIEF_HOUR) continue;
    const [existing] = await db
      .select({ id: dailyBriefTable.id })
      .from(dailyBriefTable)
      .where(
        and(
          eq(dailyBriefTable.workspaceId, person.workspaceId),
          eq(dailyBriefTable.userId, person.userId),
          eq(dailyBriefTable.day, day),
        ),
      );
    if (existing) continue;
    const content = await gatherBrief(
      person.workspaceId,
      person.userId,
      day,
      person.timeZone,
      now,
    );
    // The brief and its Inbox entry land together, or neither does and the
    // next run tries that day again.
    const notification = await db
      .transaction(async (tx) => {
        const [brief] = await tx
          .insert(dailyBriefTable)
          .values({
            workspaceId: person.workspaceId,
            userId: person.userId,
            day,
            content,
          })
          .onConflictDoNothing()
          .returning({ id: dailyBriefTable.id });
        if (!brief) return null;
        const created = await persistNotification(
          {
            userId: person.userId,
            type: "daily_brief",
            // Email and push read these; the Inbox uses its own copy.
            title: "Your daily brief",
            content: `Due today: ${content.dueToday.length} · Mentions: ${content.mentions.length} · Moved: ${content.moved.length}`,
            eventData: {
              workspaceId: person.workspaceId,
              briefId: brief.id,
              day,
              dueToday: content.dueToday.length,
              mentions: content.mentions.length,
              moved: content.moved.length,
            },
            resourceId: person.workspaceId,
            resourceType: "workspace",
          },
          tx,
        );
        if (!created) tx.rollback();
        return created;
      })
      .catch((error) => {
        if (!(error instanceof TransactionRollbackError))
          console.error("Daily brief failed", { userId: person.userId, error });
        return null;
      });
    if (notification) {
      await dispatchNotification(notification);
      sent += 1;
    }
  }
  return { sent };
}
