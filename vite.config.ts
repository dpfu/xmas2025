import { defineConfig } from 'vite';

// GitHub Pages: set base to your repo name (or '/' for a custom domain).
// Example: if your repo is https://github.com/ORG/xmas2025 then base is '/xmas2025/'
export default defineConfig({
  base: process.env.PAGES_BASE ?? '/',
});
