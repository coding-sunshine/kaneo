type Searchable = {
  name?: string | null;
  email?: string | null;
  profile?: {
    jobTitle: string | null;
    department: string | null;
    location: string | null;
    timeZone: string | null;
  } | null;
};

// Time zone ids read as words: America/New_York matches "new york".
const normalize = (value: string) =>
  value.toLowerCase().replace(/[_/]+/g, " ").replace(/\s+/g, " ").trim();

export function matchesPerson(person: Searchable, search: string) {
  const query = normalize(search);
  if (!query) return true;
  const { profile } = person;
  return [
    person.name,
    person.email,
    profile?.jobTitle,
    profile?.department,
    profile?.location,
    profile?.timeZone,
  ].some((value) => value && normalize(value).includes(query));
}
