import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { cacheStats, clearCache, enabledSetting, getCached, setCached } from '../utils/cache';
import type { LookupResult } from '../utils/types';

const found: LookupResult = {
  status: 'found', wineId: 1, wineName: 'X', url: 'https://www.vivino.com/w/1',
  rating: 4, ratingsCount: 10, scope: 'wine', details: { wine: 'X' }, searchUrl: 'https://www.vivino.com/search/wines?q=x',
};
const notFound: LookupResult = { status: 'not-found', searchUrl: 'https://www.vivino.com/search/wines?q=x' };
const DAY = 24 * 60 * 60 * 1000;

describe('cache', () => {
  beforeEach(() => fakeBrowser.reset());

  it('expires found results after a week and misses after a day', async () => {
    await setCached('a', found, 0);
    await setCached('b', notFound, 0);
    expect(await getCached('a', 6 * DAY)).toEqual(found);
    expect(await getCached('a', 8 * DAY)).toBeUndefined();
    expect(await getCached('b', DAY / 2)).toEqual(notFound);
    expect(await getCached('b', 2 * DAY)).toBeUndefined();
  });

  it('treats matches cached without popover details as stale', async () => {
    const { details: _, ...old } = found as Extract<LookupResult, { status: 'found' }>;
    await setCached('a', old, 0);
    expect(await getCached('a', DAY)).toBeUndefined();
  });

  it('treats matches cached without a search link as stale', async () => {
    const { searchUrl: _, ...old } = found as Extract<LookupResult, { status: 'found' }>;
    await setCached('a', old, 0);
    expect(await getCached('a', DAY)).toBeUndefined();
  });

  it('counts and clears only cached lookups', async () => {
    await setCached('a', found);
    await setCached('b', notFound);
    await enabledSetting.setValue(false);
    expect(await cacheStats()).toEqual({ found: 1, notFound: 1 });
    await clearCache();
    expect(await cacheStats()).toEqual({ found: 0, notFound: 0 });
    expect(await enabledSetting.getValue()).toBe(false);
  });
});
