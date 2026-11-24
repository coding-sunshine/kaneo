import { brand } from "@kaneo/brand";

const DEFAULT_BRAND = brand.name;

/**
 * Templates write this where the product name belongs; `render` swaps in the
 * instance name loaded for that email.
 */
export const BRAND_TOKEN = "{{brand}}";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};

export function applyBrandName(html: string, name: string) {
  const escaped = name.replace(
    /[&<>"']/g,
    (char) => HTML_ESCAPES[char] ?? char,
  );
  return html.split(BRAND_TOKEN).join(escaped);
}

let resolveName: () => Promise<string | null | undefined> = async () => null;

/** Let the API supply the instance name shown in email headers and subjects. */
export function setBrandNameResolver(
  resolver: () => Promise<string | null | undefined>,
) {
  resolveName = resolver;
}

/** Take one immutable branding snapshot for an outgoing email. */
export async function loadBrandName() {
  try {
    return (await resolveName())?.trim() || DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

export type EmailSubject = string | ((instanceName: string) => string);
