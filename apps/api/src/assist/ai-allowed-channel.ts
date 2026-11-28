import { and, eq, isNull, notExists, type SQLWrapper, sql } from "drizzle-orm";
import db from "../database";
import {
  chatChannelAiExclusionTable,
  chatChannelTable,
} from "../database/schema";

/** The channel is not marked "no AI". */
export const notAiExcluded = (channelId: SQLWrapper = chatChannelTable.id) =>
  notExists(
    db
      .select({ one: sql`1` })
      .from(chatChannelAiExclusionTable)
      .where(eq(chatChannelAiExclusionTable.channelId, channelId)),
  );

/**
 * Channels an AI feature may read for a person: not marked "no AI", and no
 * direct message unless the person opted in. Callers add who may read it.
 */
export const aiAllowedChannel = (includeDirectMessages: boolean) =>
  and(
    notAiExcluded(),
    includeDirectMessages ? undefined : isNull(chatChannelTable.directKey),
  );
