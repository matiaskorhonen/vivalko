import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  manifest: {
    name: 'Vivalko',
    description: 'Shows Vivino ratings for wines on Alko.fi',
    permissions: ['storage'],
    host_permissions: [
      // Vivino's wine search runs on Algolia; the background worker queries it directly.
      'https://9takgwjuxl-dsn.algolia.net/*',
      // Grape names for the popover.
      'https://www.vivino.com/api/*',
      // Bottle images for the popover, passed to the page as data: URLs (Alko's CSP blocks Vivino images).
      'https://images.vivino.com/*',
    ],
  },
  webExt: {
    // `pnpm dev` opens the browser on a page full of wines to badge.
    startUrls: ['https://www.alko.fi/fi/tuotteet/punaviinit'],
  },
});
