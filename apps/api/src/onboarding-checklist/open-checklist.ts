import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { onboardingChecklistTable as checklist } from "../database/schema";

// A checklist shows once its welcome workspace is made, until it is dismissed.
export const openChecklist = (userId: string) =>
  and(
    eq(checklist.userId, userId),
    isNotNull(checklist.seededAt),
    isNull(checklist.dismissedAt),
  );
