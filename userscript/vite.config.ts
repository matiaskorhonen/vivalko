import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
  description: string;
};

// Keep @match, @connect and the grants in step with the extension's manifest in wxt.config.ts.
const metadata = [
  ['name', 'Vivalko'],
  ['namespace', 'https://github.com/matiaskorhonen/vivalko'],
  ['version', pkg.version],
  ['description', pkg.description],
  ['homepageURL', 'https://github.com/matiaskorhonen/vivalko'],
  ['license', 'MIT'],
  ['match', '*://alko.fi/*'],
  ['match', '*://www.alko.fi/*'],
  ['run-at', 'document-idle'],
  // GM APIs only exist in the content scope, and it isn't bound by Alko's CSP.
  ['inject-into', 'content'],
  ['noframes'],
  ['grant', 'GM.xmlHttpRequest'],
  ['grant', 'GM.getValue'],
  ['grant', 'GM.setValue'],
  ['grant', 'GM.deleteValue'],
  ['grant', 'GM.listValues'],
  // Tampermonkey and Violentmonkey only let GM.xmlHttpRequest reach hosts listed here.
  ['connect', '9takgwjuxl-dsn.algolia.net'],
  ['connect', 'www.vivino.com'],
  ['connect', 'images.vivino.com'],
];

const width = Math.max(...metadata.map(([key]) => key!.length));
const banner = [
  '// ==UserScript==',
  ...metadata.map(([key, value]) => `// @${key!.padEnd(width)}${value ? ` ${value}` : ''}`.trimEnd()),
  '// ==/UserScript==',
  '',
].join('\n');

export default defineConfig({
  root,
  resolve: {
    alias: [
      // Shared code stores its cache with WXT's storage; the userscript keeps it in GM storage.
      { find: 'wxt/utils/storage', replacement: fileURLToPath(new URL('gm-storage.ts', import.meta.url)) },
      { find: /^@\//, replacement: `${root}/` },
    ],
  },
  build: {
    outDir: '.output/userscript',
    emptyOutDir: true,
    // Userscript managers show the source, so keep it readable.
    minify: false,
    lib: {
      entry: fileURLToPath(new URL('main.ts', import.meta.url)),
      formats: ['iife'],
      name: 'vivalko',
      fileName: () => 'vivalko.user.js',
    },
    rolldownOptions: {
      output: { banner },
    },
  },
});
