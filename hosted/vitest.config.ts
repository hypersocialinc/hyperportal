import { defineConfig } from "vitest/config";

// The access logic is pure TS with no DOM/CSS. Disable PostCSS/CSS handling so
// vitest doesn't try to load the app's Tailwind PostCSS config.
export default defineConfig({
  // Inline empty PostCSS config so vitest doesn't discover the app's Tailwind
  // postcss.config.mjs (which its plugin loader can't parse).
  css: { postcss: { plugins: [] } },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
