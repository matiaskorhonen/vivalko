import { getCached, setCached } from './cache';
import { createLimiter } from './limit';
import type { AlkoProduct, LookupResult } from './types';
import { lookupProduct } from './vivino';
import { fetchImageAsDataUrl, loadGrapeNames } from './vivino-assets';

/** Maximum number of Vivino searches in flight at once. */
const MAX_CONCURRENT = 3;
/** Popover images kept in memory; they are small (~30 KB) and only fetched on click. */
const MAX_IMAGES = 30;

/** The cross-origin work: Vivino searches, bottle images and grape names. */
export interface Service {
  lookup(product: AlkoProduct): Promise<LookupResult>;
  image(url: string): Promise<string>;
  grapes(ids: number[]): Promise<string[]>;
}

/**
 * Runs in the extension's background worker, or in the page itself for the userscript,
 * where `fetchImpl` goes through the userscript manager to reach other origins.
 */
export function createService(fetchImpl: typeof fetch = fetch): Service {
  const inFlight = new Map<string, Promise<LookupResult>>();
  const withSlot = createLimiter(MAX_CONCURRENT);
  const images = new Map<string, Promise<string>>();

  async function lookup(product: AlkoProduct): Promise<LookupResult> {
    const cached = await getCached(product.id);
    if (cached) return cached;

    // Cards and the product page can ask for the same wine at the same time.
    let pending = inFlight.get(product.id);
    if (!pending) {
      pending = withSlot(() => lookupProduct(product, fetchImpl)).then(async (result) => {
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
      pending = fetchImageAsDataUrl(url, fetchImpl);
      pending.catch(() => images.delete(url));
      images.set(url, pending);
      // Drop the oldest entry; a Map keeps insertion order.
      if (images.size > MAX_IMAGES) images.delete(images.keys().next().value!);
    }
    return pending;
  }

  async function grapes(ids: number[]): Promise<string[]> {
    const names = await loadGrapeNames(fetchImpl);
    return ids.map((id) => names[id]).filter((n): n is string => !!n);
  }

  return { lookup, image, grapes };
}
