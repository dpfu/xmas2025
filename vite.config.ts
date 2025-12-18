import { defineConfig } from 'vite';

// GitHub Pages: set base to your repo name (or '/' for a custom domain).
// Example: if your repo is https://github.com/ORG/academic-tree-gifts then base is '/academic-tree-gifts/'
export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? '/',
});
