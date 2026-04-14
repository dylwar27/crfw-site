import { defineConfig } from 'astro/config';
export default defineConfig({
  site: 'https://crfw.example',
  output: 'static',
  build: { assets: 'assets' },
});
