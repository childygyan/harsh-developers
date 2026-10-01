// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';

// Harsh Developers — property listing + loan management.
// Fully server-rendered on Cloudflare Pages: every page reads from D1 at
// request time, API routes run as Workers with D1 + R2 bindings.
// (Astro 5 removed the old "hybrid" mode; "server" is SSR-by-default.)
export default defineConfig({
  site: 'https://harsh-developers.pages.dev',
  output: 'server',
  adapter: cloudflare(),
  integrations: [tailwind()],
});
