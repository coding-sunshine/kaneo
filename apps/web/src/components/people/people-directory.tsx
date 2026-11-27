import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type Person, PersonCard } from "@/components/people/person-card";
import { Input } from "@/components/ui/input";
import { matchesPerson } from "@/lib/people/matches-person";

/** Everyone in the workspace, searchable by name and profile fields. */
export function PeopleDirectory({ people }: { people: Person[] }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const shown = people
    .filter((person) => matchesPerson(person, search))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      <div className="relative sm:w-96">
        <Search
          aria-hidden="true"
          className="-translate-y-1/2 absolute top-1/2 left-2.5 size-3.5 text-muted-foreground"
        />
        <Input
          type="search"
          size="sm"
          className="pl-8"
          aria-label={t("team:people.searchLabel")}
          placeholder={t("team:people.searchPlaceholder")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          {t("team:people.empty")}
        </p>
      ) : (
        <ul
          aria-label={t("team:people.pageTitle")}
          className="grid gap-3 sm:grid-cols-2"
        >
          {shown.map((person) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </ul>
      )}
    </div>
  );
}
