import { enabledSetting } from '@/utils/cache';
import { decorate } from '@/utils/decorate';
import type { Service } from '@/utils/service';
import type { AlkoProduct, LookupResult, Message } from '@/utils/types';

export default defineContentScript({
  matches: ['*://www.alko.fi/*', '*://alko.fi/*'],
  runAt: 'document_idle',

  async main(ctx) {
    if (!(await enabledSetting.getValue())) return;

    // Turn the toolbar icon red. Browsers may reset tab icons on client-side navigations
    // too, so repeat it whenever Alko's Next.js router changes the URL.
    const markActive = () => void browser.runtime.sendMessage({ type: 'vivalko:active' } satisfies Message).catch(() => {});
    markActive();
    ctx.addEventListener(window, 'wxt:locationchange', markActive);

    /** Sends a message to the background worker and unwraps its `{ ok, result | error }` reply. */
    async function ask<T>(message: Message): Promise<T> {
      const res = (await browser.runtime.sendMessage(message)) as
        | { ok: true; result: T }
        | { ok: false; error: string }
        | undefined;
      if (!res) throw new Error('No response from background');
      if (!res.ok) throw new Error(res.error);
      return res.result;
    }

    // Vivino is cross-origin, so the background worker does the fetching.
    const service: Service = {
      lookup: (product: AlkoProduct) => ask<LookupResult>({ type: 'vivalko:lookup', product }),
      image: (url) => ask<string>({ type: 'vivalko:image', url }),
      grapes: (ids) => ask<string[]>({ type: 'vivalko:grapes', ids }),
    };

    decorate({
      service,
      isValid: () => ctx.isValid,
      onInvalidated: (cb) => ctx.onInvalidated(cb),
    });
  },
});
