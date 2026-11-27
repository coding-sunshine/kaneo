// Plural categories newer CLDR data adds to a language. Node 26 (CLDR 49)
// gives Vietnamese a "one" form, while Node 24 (CLDR 48) reports only
// "other". Requiring the union keeps the check's answer the same on both, and
// a browser on the newer data finds the form instead of falling back to
// English.
const NEWER_CLDR_CATEGORIES = { vi: ["one"] };

export function pluralCategories(locale) {
  let categories;
  try {
    categories = new Intl.PluralRules(locale).resolvedOptions()
      .pluralCategories;
  } catch (error) {
    throw new Error(
      `Unknown locale "${locale}": Intl.PluralRules rejected it`,
      {
        cause: error,
      },
    );
  }

  const { language } = new Intl.Locale(locale);
  return new Set([...categories, ...(NEWER_CLDR_CATEGORIES[language] ?? [])]);
}
