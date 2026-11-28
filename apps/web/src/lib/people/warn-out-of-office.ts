import i18n from "i18next";
import { toast } from "@/lib/toast";
import { warnsOutOfOffice } from "./out-of-office-warning";
import type { OutOfOffice } from "./profile-types";

const day = (instant: string) =>
  new Date(instant).toLocaleDateString(i18n.language, { dateStyle: "medium" });

/** Tells whoever just assigned a ticket that the assignee will be away. */
export function warnOutOfOffice(
  assignee: {
    name?: string | null;
    profile?: { outOfOffice: OutOfOffice | null };
  },
  dueDate: string | null | undefined,
) {
  const range = assignee.profile?.outOfOffice;
  if (!range || !warnsOutOfOffice(range, dueDate, new Date())) return;
  toast.warning(
    i18n.t("team:people.assignedOutOfOffice", {
      name: assignee.name ?? "",
      from: day(range.from),
      until: day(range.until),
    }),
  );
}
