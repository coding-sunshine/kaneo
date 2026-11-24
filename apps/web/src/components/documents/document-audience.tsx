import { useTranslation } from "react-i18next";
import type { DocumentAudience as Audience } from "@/fetchers/document/documents";

type Person = Audience["current"][number];
type DocumentAudienceProps = { current: Person[]; proposed: Person[] };

const names = (people: Person[]) =>
  people.map((person) => person.name).join(", ");
// The people in `from` who are not in `other`.
const without = (from: Person[], other: Person[]) =>
  from.filter(
    (person) => !other.some((match) => match.userId === person.userId),
  );

/** Who will be able to open a document after a move, before it happens. */
export function DocumentAudience({ current, proposed }: DocumentAudienceProps) {
  const { t } = useTranslation();
  const gains = without(proposed, current);
  const loses = without(current, proposed);
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-xs">
      <p className="font-medium">
        {t("navigation:documents.audience.count", { count: proposed.length })}
      </p>
      <p className="max-h-24 overflow-y-auto text-muted-foreground">
        {names(proposed)}
      </p>
      {gains.length > 0 && (
        <p>
          {t("navigation:documents.audience.gains", { names: names(gains) })}
        </p>
      )}
      {loses.length > 0 && (
        <p className="text-warning-foreground">
          {t("navigation:documents.audience.loses", { names: names(loses) })}
        </p>
      )}
      {gains.length + loses.length === 0 && (
        <p className="text-muted-foreground">
          {t("navigation:documents.audience.same")}
        </p>
      )}
    </div>
  );
}
