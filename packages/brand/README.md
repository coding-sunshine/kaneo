# @kaneo/brand

The product name and brand values live in `src/index.ts`. Rename or whitelabel by editing that one file and swapping the logo files below.

Where the brand flows:

- Web: `apps/web/vite.config.ts` fills `index.html` (title, description, og, app-name meta, dark background) and generates `site.webmanifest`; i18next gets `appName` as a default variable, so `{{appName}}` in `i18n/*.json` shows the name; page title, logo alt, Trello token name, import source and public project "Powered by" use `brand` directly.
- API: default instance name (`DB instance_settings.instance_name` still overrides it), passkey RP name, email subject defaults, OpenAPI title and descriptions, notification fallback copy.
- Email: `packages/email` templates write `{{brand}}`, replaced at send time with the instance name.

Logo files to swap in `apps/web/public`: `logo-dark.svg`, `logo-light.svg`, `favicon.svg`, `favicon.ico`, `favicon-96x96.png`, `apple-touch-icon.png`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`.

Emails also show `apps/web/public/email/mark.png`; swap it too.
