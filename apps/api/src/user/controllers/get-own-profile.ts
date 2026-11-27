import { eq } from "drizzle-orm";
import db from "../../database";
import { userProfileTable } from "../../database/schema";
import { profileColumns } from "../profile/profile-columns";
import { visibleProfile } from "../profile/visible-profile";

async function getOwnProfile(userId: string) {
  const [row] = await db
    .select(profileColumns)
    .from(userProfileTable)
    .where(eq(userProfileTable.userId, userId));
  return visibleProfile(row ?? null, new Date());
}

export default getOwnProfile;
