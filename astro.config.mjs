import { defineConfig } from 'astro/config';

// Deployed to Cloudflare Pages at https://crfw-site.pages.dev/.
// Per-branch previews land at https://<branch-hash>.crfw-site.pages.dev/.
//
// History: hosted on GitHub Pages until 2026-04-26 at /crfw-site/ subpath
// (which forced every internal link through a withBase() helper). Cloudflare
// Pages serves at root, so base is now '/'.
//
// When a custom domain lands: swap `site` to the domain. base stays '/'.
export default defineConfig({
  site: 'https://crfw-site.pages.dev',
  base: '/',
  output: 'static',
  build: { assets: 'assets' },
  trailingSlash: 'ignore',
});
