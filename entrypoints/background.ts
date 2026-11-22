import { getCached, setCached } from '@/utils/cache';
import { createLimiter } from '@/utils/limit';
import type { LookupRequest, LookupResult, Message } from '@/utils/types';
import { lookupProduct } from '@/utils/vivino';
import { fetchImageAsDataUrl, loadGrapeNames } from '@/utils/vivino-assets';

/** Maximum number of Vivino searches in flight at once. */
const MAX_CONCURRENT = 3;
/** Popover images kept in memory; they are small (~30 KB) and only fetched on click. */
const MAX_IMAGES = 30;

export default defineBackground(() => {
  const inFlight = new Map<string, Promise<LookupResult>>();
  const withSlot = createLimiter(MAX_CONCURRENT);
  const images = new Map<string, Promise<string>>();

  async function lookup(req: LookupRequest): Promise<LookupResult> {
    const { product } = req;
    const cached = await getCached(product.id);
    if (cached) return cached;

    // Cards and the product page can ask for the same wine at the same time.
    let pending = inFlight.get(product.id);
    if (!pending) {
      pending = withSlot(() => lookupProduct(product)).then(async (result) => {
        await setCached(product.id, result);
        return result;
      });
      pending.finally(() => inFlight.delete(product.id)).catch(() => {});
      inFlight.set(product.id, pending);
    }
    return pending;
  }

  function image(url: string): Promise<string> {
    let pending = images.get(url);
    if (!pending) {
      pending = fetchImageAsDataUrl(url);
      pending.catch(() => images.delete(url));
      images.set(url, pending);
      // Drop the oldest entry; a Map keeps insertion order.
      if (images.size > MAX_IMAGES) images.delete(images.keys().next().value!);
    }
    return pending;
  }

  async function grapes(ids: number[]): Promise<string[]> {
    const names = await loadGrapeNames();
    return ids.map((id) => names[id]).filter((n): n is string => !!n);
  }

  /** Every reply has the same shape: `{ ok: true, result }` or `{ ok: false, error }`. */
  function respond<T>(p: Promise<T>) {
    return p.then(
      (result) => ({ ok: true as const, result }),
      (err: unknown) => ({ ok: false as const, error: String(err) }),
    );
  }

  /**
   * Shows the red icon in one tab. Tab-specific icons are cleared when the tab navigates,
   * so leaving Alko.fi reverts to the grey default.
   */
  function markActive(tabId: number) {
    // Firefox MV2 only has `browserAction`.
    const action = browser.action ?? browser.browserAction;
    action
      .setIcon({ tabId, path: { 16: '/icon/16.png', 32: '/icon/32.png' } })
      // The tab may have closed in the meantime.
      .catch(() => {});
  }

  browser.runtime.onMessage.addListener((message: unknown, sender) => {
    const msg = message as Message;
    switch (msg?.type) {
      case 'vivalko:active':
        if (sender.tab?.id !== undefined) markActive(sender.tab.id);
        return undefined;
      case 'vivalko:lookup':
        return respond(lookup(msg));
      case 'vivalko:image':
        return respond(image(msg.url));
      case 'vivalko:grapes':
        return respond(grapes(msg.ids));
      default:
        return undefined;
    }
  });
});
