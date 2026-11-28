function localDay(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year: year ?? 0, month: (month ?? 1) - 1, day: day ?? 1 };
}

/** Whole local days, from the start of `from` to the end of `until`. */
export function localDayRange(from: string, until: string) {
  const start = localDay(from);
  const end = localDay(until);
  return {
    from: new Date(start.year, start.month, start.day).toISOString(),
    until: new Date(
      end.year,
      end.month,
      end.day,
      23,
      59,
      59,
      999,
    ).toISOString(),
  };
}

/** The local calendar day of an instant, as a date input value. */
export function toDateInput(instant: string) {
  const date = new Date(instant);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
