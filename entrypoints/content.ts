import { readCard, readProductPage } from '@/utils/alko';
import { fetchAlkoDetails } from '@/utils/alko-api';
import { createBadge, pageLanguage } from '@/utils/badge';
import { enabledSetting, getCached } from '@/utils/cache';
import { createLimiter } from '@/utils/limit';
import { isWineCategory } from '@/utils/normalize';
import type { AlkoProduct, LookupRequest, LookupResponse } from '@/utils/types';

export default defineContentScript({
  matches: ['*://www.alko.fi/*', '*://alko.fi/*'],
  runAt: 'document_idle',

  async main(ctx) {
    if (!(await enabledSetting.getValue())) return;

    // Alko's product API is only reachable from the page itself (the site's firewall
    // blocks other clients), so catalog details are fetched here, not in the background.
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

    async function fill(render: ReturnType<typeof createBadge>['render'], product: AlkoProduct) {
      try {
        const cached = await getCached(product.id);
        if (cached) {
          render({ kind: 'result', result: cached });
          return;
        }
        const req: LookupRequest = { type: 'vivalko:lookup', product: await enrich(product) };
        const res = (await browser.runtime.sendMessage(req)) as LookupResponse | undefined;
        if (!res) throw new Error('No response from background');
        render(res.ok ? { kind: 'result', result: res.result } : { kind: 'error', message: res.error });
      } catch (err) {
        if (ctx.isValid) render({ kind: 'error', message: String(err) });
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

        const badge = createBadge('small');
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

        const badge = createBadge('large');
        badge.host.style.order = getComputedStyle(h1).order;
        badge.host.style.padding = '0 1rem';
        badge.host.style.marginBottom = '1rem';
        h1.after(badge.host);
        // The background worker de-duplicates concurrent lookups for the same wine.
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
        if (ctx.isValid) scan();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    scan();
  },
});
