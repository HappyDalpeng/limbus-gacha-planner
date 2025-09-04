import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Derive base path for GitHub Pages deployments.
// When running in GitHub Actions, GITHUB_REPOSITORY is like "owner/repo".
const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const isCI = process.env.GITHUB_ACTIONS === "true";
const isUserOrOrgSite = !!repoName && repoName.endsWith(".github.io");
const base = isCI && repoName && !isUserOrOrgSite ? `/${repoName}/` : "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: { port: 5173 },
  preview: { port: 5173 },
});
