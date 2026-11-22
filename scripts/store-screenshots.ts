/**
 * Takes Chrome Web Store screenshots of the extension running on Alko.fi.
 *
 * Run with `pnpm screenshots`, which builds the extension first. The images
 * (1280×800 JPEG) land in .output/store-screenshots/.
 *
 * Needs Playwright's Chromium (`pnpm exec playwright install chromium`):
 * branded Chrome no longer loads unpacked extensions from the command line.
 */
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';

/** A producer with several well-known, much-rated wines on Alko, for the list shots. */
const PRODUCER = 'Antinori';
/** A much-rated wine for the product page shots. */
const FEATURED = 'Tignanello';

const root = resolve(import.meta.dirname, '..');
const extension = resolve(root, '.output/chrome-mv3');
const out = resolve(root, '.output/store-screenshots');

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// An empty user data dir gives a fresh, throwaway profile.
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  locale: 'en-GB',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
const page = context.pages()[0] ?? (await context.newPage());

try {
  await page.goto(searchUrl(PRODUCER), { waitUntil: 'domcontentloaded' });
  await dismissBanners(page);
  await waitForBadges(page);

  const badge = await scoredBadge(page);
  const card = page.locator('article[id^="product-"]').filter({ has: badge }).first();
  await card.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -20));
  await shoot(page, '1-list');
  // Leave room above the card for the popover.
  await page.evaluate(() => window.scrollBy(0, -240));
  await openPopover(page, badge);
  await shoot(page, '2-popover');
  await page.keyboard.press('Escape');

  await page.goto(searchUrl(FEATURED), { waitUntil: 'domcontentloaded' });
  await waitForBadges(page);
  // The regular bottle rather than a magnum or gift box.
  const featured = page
    .locator('article[id^="product-"]')
    .filter({ hasText: FEATURED, hasNotText: /magnum|box/i })
    .locator('a[href*="/products/"]')
    .first();
  await page.goto(new URL((await featured.getAttribute('href'))!, page.url()).href, { waitUntil: 'domcontentloaded' });
  await waitForBadges(page);
  await shoot(page, '3-product');
  await openPopover(page, await scoredBadge(page));
  await shoot(page, '4-product-popover');
} finally {
  await context.close();
}

console.log(`Screenshots saved to ${out}`);

function searchUrl(query: string) {
  const url = new URL('https://www.alko.fi/en/search-results');
  url.searchParams.set('search', query);
  return url.href;
}

/** Declines optional cookies and closes the app promo banner at the top of the page. */
async function dismissBanners(page: Page) {
  // The cookie banner shows up a moment after the page loads.
  const reject = page.locator('#onetrust-reject-all-handler');
  try {
    await reject.click({ timeout: 10_000 });
    await page.locator('#onetrust-banner-sdk').waitFor({ state: 'hidden' });
  } catch {
    // No cookie banner this time.
  }
  await page.locator('button').evaluateAll((buttons) => {
    const close = buttons.find((b) => {
      const rect = b.getBoundingClientRect();
      return rect.width > 0 && rect.top < 80 && rect.left > 1000 && !b.textContent?.trim();
    });
    (close as HTMLButtonElement | undefined)?.click();
  });
  await page.waitForTimeout(800);
}

/** Waits until the first few badges have finished loading. */
async function waitForBadges(page: Page) {
  await page.waitForFunction(
    () => {
      const badges = [...document.querySelectorAll('[data-vivalko="badge"]')];
      return badges.length > 0 && badges.slice(0, 6).every((b) => !b.shadowRoot?.querySelector('.loading'));
    },
    null,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(1500);
}

/** The first visible badge that shows a rating. */
async function scoredBadge(page: Page): Promise<Locator> {
  const index = await page.evaluate(() =>
    [...document.querySelectorAll('[data-vivalko="badge"]')].findIndex(
      (b) => b.shadowRoot?.querySelector('.score') && b.getBoundingClientRect().width > 0,
    ),
  );
  if (index < 0) throw new Error(`No rated wine on ${page.url()}`);
  return page.locator('[data-vivalko="badge"]').nth(index);
}

/** Opens the badge's popover and waits for the bottle image to load. */
async function openPopover(page: Page, badge: Locator) {
  await badge.locator('a').click();
  await page.waitForFunction(
    () => {
      const root = document.querySelector('[data-vivalko="popover"]')?.shadowRoot;
      return root?.querySelector('.panel:popover-open') && root.querySelector('img.loaded, .panel.no-image');
    },
    null,
    { timeout: 20_000 },
  );
  // Grape names come from a separate request. Not every wine has them.
  await page
    .waitForFunction(() => document.querySelector('[data-vivalko="popover"]')?.shadowRoot?.querySelector('.grapes:not([hidden])'), null, {
      timeout: 5000,
    })
    .catch(() => {});
}

async function shoot(page: Page, name: string) {
  await page.waitForTimeout(800);
  // Rendered at 2× and scaled down to 1280×800 for crisper text. JPEG has no
  // alpha channel, which the store requires.
  await page.screenshot({ path: `${out}/screenshot-${name}.jpg`, type: 'jpeg', quality: 92, scale: 'css' });
}
