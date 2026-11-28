import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/get-initials";
import type { PersonProfile } from "@/lib/people/profile-types";

export type Person = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  profile: PersonProfile;
};

const day = (instant: string, locale: string) =>
  new Date(instant).toLocaleDateString(locale, { dateStyle: "medium" });

/** One person in the directory. A field they left empty is not shown. */
export function PersonCard({ person }: { person: Person }) {
  const { t, i18n } = useTranslation();
  const { profile } = person;
  const fields = [
    [t("team:people.jobTitle"), profile.jobTitle],
    [t("team:people.department"), profile.department],
    [t("team:people.location"), profile.location],
    [t("team:people.timeZone"), profile.timeZone],
  ].filter((field): field is [string, string] => Boolean(field[1]));

  return (
    <li className="flex gap-3 rounded-lg border p-3">
      <Avatar className="size-9">
        <AvatarImage src={person.image ?? ""} alt="" />
        <AvatarFallback className="text-xs">
          {getInitials(person.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="truncate font-medium text-sm">{person.name}</h3>
        {person.email && (
          <span className="truncate text-muted-foreground text-xs">
            {person.email}
          </span>
        )}
        {profile.status && (
          <span className="text-sm">{profile.status.text}</span>
        )}
        {profile.outOfOffice && (
          <span className="text-amber-700 text-xs dark:text-amber-400">
            {t("team:people.outOfOfficeRange", {
              from: day(profile.outOfOffice.from, i18n.language),
              until: day(profile.outOfOffice.until, i18n.language),
            })}
          </span>
        )}
        {fields.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            {fields.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </li>
  );
}
