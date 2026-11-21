import { getCached, setCached } from '@/utils/cache';
import type { LookupRequest, LookupResponse, LookupResult } from '@/utils/types';
import { lookupProduct } from '@/utils/vivino';

/** Maximum number of Vivino searches in flight at once. */
const MAX_CONCURRENT = 3;

export default defineBackground(() => {
  const inFlight = new Map<string, Promise<LookupResult>>();
  const waiting: (() => void)[] = [];
  let running = 0;

  async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
    running++;
    try {
      return await fn();
    } finally {
      running--;
      waiting.shift()?.();
    }
  }

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

  browser.runtime.onMessage.addListener((message: unknown) => {
    const req = message as LookupRequest;
    if (req?.type !== 'vivalko:lookup') return undefined;
    return lookup(req).then(
      (result): LookupResponse => ({ ok: true, result }),
      (err: unknown): LookupResponse => ({ ok: false, error: String(err) }),
    );
  });
});
