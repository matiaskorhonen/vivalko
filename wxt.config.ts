import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  manifest: {
    name: 'Vivalko',
    description: 'Shows Vivino ratings for wines on Alko.fi',
    permissions: ['storage'],
    // Vivino's wine search runs on Algolia; the background worker queries it directly.
    host_permissions: ['https://9takgwjuxl-dsn.algolia.net/*'],
  },
});
