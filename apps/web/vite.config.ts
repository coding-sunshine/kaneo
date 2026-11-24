import path from "node:path";
import { brand } from "@kaneo/brand";
import babel from "@rolldown/plugin-babel";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";
import type { Plugin } from "vite-plus";
import packageJson from "../../package.json";

const manifest = JSON.stringify(
  {
    name: brand.name,
    short_name: brand.name,
    icons: [192, 512].map((size) => ({
      src: `/web-app-manifest-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "maskable",
    })),
    theme_color: brand.themeColor,
    background_color: brand.backgroundColor,
    display: "standalone",
  },
  null,
  2,
);

// Fills the %BRAND_*% placeholders in index.html and serves/emits
// site.webmanifest, so the brand lives only in @kaneo/brand.
const brandPlugin: Plugin = {
  name: "kaneo-brand",
  transformIndexHtml: (html: string) =>
    html
      .replaceAll("%BRAND_NAME%", brand.name)
      .replaceAll("%BRAND_DESCRIPTION%", brand.description)
      .replaceAll("%BRAND_BACKGROUND%", brand.backgroundColor),
  configureServer(server) {
    server.middlewares.use("/site.webmanifest", (_req, res) => {
      res.setHeader("Content-Type", "application/manifest+json");
      res.end(manifest);
    });
  },
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "site.webmanifest",
      source: manifest,
    });
  },
};

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT;
const uploadSourceMaps = Boolean(sentryAuthToken && sentryOrg && sentryProject);

export default defineConfig({
  run: {
    tasks: {
      compile: {
        command: "vp build",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
      "check:types": {
        command:
          "tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p tsconfig.node.json",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        // Typechecks read sources across the workspace and `auto` can't trace
        // tsc 7, so a cached result can be stale; always run them (like cli).
        cache: false,
      },
      "test:run": {
        command: "vp test run --config vitest.config.ts",
        dependsOn: [
          { task: "build", from: ["dependencies", "devDependencies"] },
        ],
        cache: false,
      },
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
  base: "/",
  plugins: lazyPlugins(() => [
    tanstackRouter({
      autoCodeSplitting: true,
      // Keep co-located route tests out of the generated route tree.
      routeFileIgnorePattern: "\\.test\\.tsx?$",
    }),
    tailwindcss(),
    brandPlugin,
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // Hidden when Sentry env vars are absent so local dev does not depend on it.
    ...(uploadSourceMaps
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProject,
            release: { name: packageJson.version },
            sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          }),
        ]
      : []),
  ]),
  server: {
    host: true,
    hmr: true,
    port: 5173,
  },
  optimizeDeps: {
    exclude: ["better-auth"],
  },
  ssr: {
    noExternal: ["better-auth"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@i18n": path.resolve(__dirname, "../../i18n"),
    },
  },
  build: {
    // Generate maps only for private symbolication, then delete after upload.
    // "hidden" alone still writes publicly servable .map files.
    sourcemap: uploadSourceMaps ? "hidden" : false,
    rollupOptions: {},
    commonjsOptions: {
      include: [/better-auth/, /node_modules/],
      transformMixedEsModules: true,
    },
    target: "esnext",
  },
});
