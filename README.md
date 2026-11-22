# Vivalko

A browser extension that shows [Vivino](https://www.vivino.com/) ratings next to wines on [Alko.fi](https://www.alko.fi/), on listing, search and product pages. Built with [WXT](https://wxt.dev/).

## How it works

- **Content script** (`entrypoints/content.ts`) watches Alko's pages, which are a Next.js app, so it keeps up with client-side navigation. For each wine it reads the name, category and country (`utils/alko.ts`), skips anything that isn't a wine, and inserts a badge (`utils/badge.ts`) inside a Shadow DOM so Alko's styles don't affect it.
- **Popover** (`utils/popover.ts`) opens when you click a rating badge (Cmd/Ctrl-click still opens Vivino). Like the header of Vivino's wine page, it shows:
  - the bottle shot
  - producer and wine name
  - country, region, type and grapes
  - the rating

  The details come from the same Vivino search as the rating. Alko's Content Security Policy blocks images from Vivino, so the background worker downloads the bottle shot and passes it to the page as a `data:` URL. Grape names come from Vivino's grape list, which is cached for a month.
- **Background worker** (`entrypoints/background.ts`) does the lookups. It caches results in `storage.local` for 7 days (or 1 day for "not found"), merges duplicate lookups that arrive at the same time, and runs at most 3 Vivino searches in parallel.
- **Vivino search** (`utils/vivino.ts`) queries the Algolia index behind Vivino's own search box, using the public, search-only key that vivino.com ships to browsers. This is an unofficial interface and may change without notice.
- **Alko catalog data** (`utils/alko-api.ts`) comes from `/api/search/product`, the endpoint Alko's own listing pages use. For each wine not already cached, the content script looks up the catalog producer there. It runs in the page because Alko's firewall turns away requests that don't come from a browser session. The old downloadable price list (`alkon-hinnasto-tekstitiedostona.xlsx`) no longer exists on the new site.
- **Matching** cleans up the Alko name first: it removes the vintage, packaging words like "hanapakkaus" or "Magnum", availability notes and alcohol percentages (`utils/normalize.ts`). It then scores Vivino's results on:
  - how well the producer and wine-name words overlap, including Alko's catalog producer
  - country
  - whether Vivino has ratings for that vintage

  It rejects results that contradict Alko's category, such as a white for a red, a sparkling wine for a still one, or a non-rosé for a rosé. If the name alone gives no confident match, it searches again with the producer added.

  Matching is deliberately strict, because a wrong rating is worse than none, so an unclear match shows "ei löytynyt" with a link to a Vivino search instead. When the vintage has enough ratings, the badge shows the vintage rating; otherwise it shows the rating across all vintages and says so.

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

## License

[MIT](LICENSE)
