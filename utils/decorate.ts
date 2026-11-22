import { readCard, readProductPage } from './alko';
import { fetchAlkoDetails } from './alko-api';
import { createBadge } from './badge';
import { getCached } from './cache';
import { pageLanguage } from './i18n';
import { createLimiter } from './limit';
import { isWineCategory } from './normalize';
import { createPopover, supportsPopover } from './popover';
import type { Service } from './service';
import type { AlkoProduct, FoundResult } from './types';

/** What the page code needs from whatever runs it: the extension's content script or the userscript. */
export interface Host {
  /** Vivino lookups, which need to reach other origins. */
  service: Service;
  /** False once the extension has been reloaded or removed and this copy should stop. */
  isValid(): boolean;
  onInvalidated(cb: () => void): void;
}

/** Adds Vivino rating badges to Alko's product cards and product pages, and keeps them up to date. */
export function decorate({ service, isValid, onInvalidated }: Host): void {
  // Alko's product API is only reachable from the page itself (the site's firewall
  // blocks other clients), so catalog details are fetched here, not by the service.
  const alkoLimit = createLimiter(3);
  const details = new Map<string, Promise<AlkoProduct>>();

  /** Adds the catalog producer (and country, if the page didn't show one). */
  function enrich(product: AlkoProduct): Promise<AlkoProduct> {
    let pending = details.get(product.id);
    if (!pending) {
      pending = alkoLimit(() => fetchAlkoDetails(product.id))
        // The catalog is always queried in Finnish, so its country name maps reliably
        // even when the page is in Swedish or English.
        .then((d) => ({ ...product, producer: d?.producer, country: d?.country ?? product.country }))
        // Matching still works on the name alone, just less precisely.
        .catch(() => product);
      details.set(product.id, pending);
    }
    return pending;
  }

  // Clicking a rating badge shows the wine's Vivino details. Without the
  // native popover API (older browsers) the badge simply links to Vivino.
  const popover = supportsPopover()
    ? createPopover({
        loadImage: (url) => service.image(url),
        loadGrapes: (ids) => service.grapes(ids),
      })
    : undefined;
  onInvalidated(() => popover?.host.remove());
  const openDetails = popover
    ? (anchor: HTMLAnchorElement, result: FoundResult) => popover.open(anchor, result, pageLanguage())
    : undefined;

  async function fill(render: ReturnType<typeof createBadge>['render'], product: AlkoProduct) {
    try {
      const cached = await getCached(product.id);
      if (cached) {
        render({ kind: 'result', result: cached });
        return;
      }
      render({ kind: 'result', result: await service.lookup(await enrich(product)) });
    } catch (err) {
      if (isValid()) render({ kind: 'error', message: String(err) });
    }
  }

  /**
   * Marks what an element was decorated for. Badges are written in the page language,
   * so switching Alko's language without a reload must redraw them.
   */
  function marker(id: string): string {
    return `${pageLanguage()}:${id}`;
  }

  function decorateCards() {
    for (const card of document.querySelectorAll<HTMLElement>('article[id^="product-"]')) {
      if (card.dataset.vivalko === marker(card.id)) continue;
      card.dataset.vivalko = marker(card.id);
      card.querySelector('[data-vivalko="badge"]')?.remove();

      const product = readCard(card);
      if (!product || !isWineCategory(product.category)) continue;
      const heading = card.querySelector(`#card-heading-${product.id}`);
      const nameBlock = heading?.parentElement;
      if (!nameBlock?.parentElement) continue;

      const badge = createBadge('small', pageLanguage(), openDetails);
      // The info column is a flex column ordered with `order`; sit between name and price.
      badge.host.style.order = '2';
      nameBlock.after(badge.host);
      void fill(badge.render, product);
    }
  }

  function decorateProductPage() {
    const page = readProductPage(document, location.pathname);
    if (!page) return;
    const { product, headings } = page;

    for (const h1 of headings) {
      if (h1.dataset.vivalko === marker(product.id)) continue;
      // Next.js may reuse the heading across client-side navigations.
      h1.dataset.vivalko = marker(product.id);
      h1.parentElement?.querySelector(':scope > [data-vivalko="badge"]')?.remove();
      if (!isWineCategory(product.category)) continue;

      const badge = createBadge('large', pageLanguage(), openDetails);
      badge.host.style.order = getComputedStyle(h1).order;
      badge.host.style.padding = '0 1rem';
      badge.host.style.marginBottom = '1rem';
      h1.after(badge.host);
      // The service de-duplicates concurrent lookups for the same wine.
      void fill(badge.render, product);
    }
  }

  function scan() {
    decorateCards();
    decorateProductPage();
  }

  // Alko is a Next.js app: content arrives after load and pages change without reloads.
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      if (isValid()) scan();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  onInvalidated(() => observer.disconnect());
  scan();
}
