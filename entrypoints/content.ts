import { readCard, readProductPage } from '@/utils/alko';
import { createBadge } from '@/utils/badge';
import { enabledSetting } from '@/utils/cache';
import { isWineCategory } from '@/utils/normalize';
import type { AlkoProduct, LookupRequest, LookupResponse } from '@/utils/types';

export default defineContentScript({
  matches: ['*://www.alko.fi/*', '*://alko.fi/*'],
  runAt: 'document_idle',

  async main(ctx) {
    if (!(await enabledSetting.getValue())) return;

    async function fill(render: ReturnType<typeof createBadge>['render'], product: AlkoProduct) {
      try {
        const req: LookupRequest = { type: 'vivalko:lookup', product };
        const res = (await browser.runtime.sendMessage(req)) as LookupResponse | undefined;
        if (!res) throw new Error('No response from background');
        render(res.ok ? { kind: 'result', result: res.result } : { kind: 'error', message: res.error });
      } catch (err) {
        if (ctx.isValid) render({ kind: 'error', message: String(err) });
      }
    }

    function decorateCards() {
      for (const card of document.querySelectorAll<HTMLElement>('article[id^="product-"]')) {
        if (card.dataset.vivalko === card.id) continue;
        card.dataset.vivalko = card.id;
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
      const h1 = document.querySelector('h1');
      if (!h1) return;
      const product = readProductPage(document, location.pathname);
      if (!product) return;
      if (h1.dataset.vivalko === product.id) return;

      // Next.js may reuse the heading across client-side navigations.
      h1.dataset.vivalko = product.id;
      h1.parentElement?.querySelector(':scope > [data-vivalko="badge"]')?.remove();
      if (!isWineCategory(product.category)) return;

      const badge = createBadge('large');
      badge.host.style.order = getComputedStyle(h1).order;
      badge.host.style.padding = '0 1rem';
      badge.host.style.marginBottom = '1rem';
      h1.after(badge.host);
      void fill(badge.render, product);
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
