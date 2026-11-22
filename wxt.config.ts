import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  manifest: ({ browser }) => ({
    name: 'Vivalko',
    description: 'Shows Vivino ratings for wines on Alko.fi',
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'vivalko@vivalko',
          // data_collection_permissions needs Firefox 140.
          strict_min_version: '140.0',
          // Wine names and producers shown on Alko's pages are sent to Vivino to look up ratings.
          data_collection_permissions: { required: ['websiteContent'] },
        },
        // Firefox for Android only gained data_collection_permissions in 142.
        gecko_android: {
          strict_min_version: '142.0',
        },
      },
    }),
    permissions: ['storage'],
    host_permissions: [
      // Vivino's wine search runs on Algolia; the background worker queries it directly.
      'https://9takgwjuxl-dsn.algolia.net/*',
      // Grape names for the popover.
      'https://www.vivino.com/api/*',
      // Bottle images for the popover, passed to the page as data: URLs (Alko's CSP blocks Vivino images).
      'https://images.vivino.com/*',
    ],
  }),
  webExt: {
    // `pnpm dev` opens the browser on a page full of wines to badge.
    startUrls: ['https://www.alko.fi/fi/tuotteet/punaviinit'],
  },
});
