# Vivalko

A browser extension that shows [Vivino](https://www.vivino.com/) ratings next to wines on [Alko.fi](https://www.alko.fi/), on listing, search and product pages. Built with [WXT](https://wxt.dev/).

## How it works

- **Content script** (`entrypoints/content.ts`) watches Alko's pages, which are a Next.js app, so it keeps up with client-side navigation. For each wine it reads the name, category and country (`utils/alko.ts`), skips anything that isn't a wine, and inserts a badge (`utils/badge.ts`) inside a Shadow DOM so Alko's styles don't affect it.
- **Background worker** (`entrypoints/background.ts`) does the lookups. It caches results in `storage.local` for 7 days (or 1 day for "not found"), merges duplicate lookups that arrive at the same time, and runs at most 3 Vivino searches in parallel.
- **Vivino search** (`utils/vivino.ts`) queries the Algolia index behind Vivino's own search box, using the public, search-only key that vivino.com ships to browsers. This is an unofficial interface and may change without notice.
- **Matching** cleans up the Alko name first: it removes the vintage, packaging words like "hanapakkaus" or "Magnum", availability notes and alcohol percentages (`utils/normalize.ts`). It then scores Vivino's results by how well the producer and wine-name words overlap, and by country. Matching is deliberately strict, because a wrong rating is worse than none, so an unclear match shows "ei löytynyt" with a link to a Vivino search instead. When the vintage has enough ratings, the badge shows the vintage rating; otherwise it shows the rating across all vintages and says so.

## Development

```bash
pnpm install
pnpm dev            # Chrome, with the extension loaded and hot reload
pnpm dev:firefox
pnpm test           # unit tests (vitest)
pnpm compile        # type-check
pnpm build          # .output/chrome-mv3
pnpm zip            # store-ready zip
```

The test fixtures in `tests/fixtures/` are recorded Vivino search responses.
