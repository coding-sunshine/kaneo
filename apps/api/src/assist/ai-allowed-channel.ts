import { and, eq, isNull } from "drizzle-orm";
import { chatChannelTable } from "../database/schema";

/** The channel lets AI in: "Turn off AI in this channel" is not set. */
export const aiEnabledChannel = () => eq(chatChannelTable.aiDisabled, false);

/**
 * Channels an AI feature may read for a person: AI not turned off there, and
 * no direct message unless the person opted in. Callers add who may read it.
 */
export const aiAllowedChannel = (includeDirectMessages: boolean) =>
  and(
    aiEnabledChannel(),
    includeDirectMessages ? undefined : isNull(chatChannelTable.directKey),
  );
