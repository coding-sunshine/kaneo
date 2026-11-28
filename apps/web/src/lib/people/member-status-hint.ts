import type { PersonProfile } from "./profile-types";

/** The short line shown next to a person's name: status, then away. */
export function memberStatusHint(
  profile: Pick<PersonProfile, "status" | "outOfOffice"> | null | undefined,
  outOfOfficeLabel: string,
) {
  const parts = [
    profile?.status?.text,
    profile?.outOfOffice ? outOfOfficeLabel : undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}
