export type TeamCsvRow = {
  name: string;
  key: string;
  description: string | null;
  visibility: string;
  issues: number;
  created: string;
};

const cell = (value: string | number) =>
  /[",\n]/.test(String(value))
    ? `"${String(value).replaceAll('"', '""')}"`
    : String(value);

/** Rows in the order of Settings > Teams, headed by the column titles. */
export function buildTeamsCsv(headers: string[], rows: TeamCsvRow[]) {
  return [
    headers,
    ...rows.map((row) => [
      row.name,
      row.key,
      row.description ?? "",
      row.visibility,
      row.issues,
      row.created,
    ]),
  ]
    .map((line) => line.map(cell).join(","))
    .join("\n");
}
