import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { placeNear } from '../utils/popover';
import { countryName, typeName } from '../utils/i18n';
import { toDetails, toResult, type VivinoHit } from '../utils/vivino';
import { fetchImageAsDataUrl, loadGrapeNames } from '../utils/vivino-assets';

// Trimmed from Vivino's search result for Mont-Ferrant L' Americano Organic Brut Nature.
const montFerrant: VivinoHit = {
  id: 7251877,
  name: "L' Americano Organic Brut Nature",
  type_id: 3,
  grapes: [83, 85, 86],
  winery: { name: 'Mont-Ferrant' },
  region: { country: 'es', name: 'Cava' },
  statistics: { status: 'Normal', ratings_count: 767, ratings_average: 3.5 },
  image: {
    location: '//images.vivino.com/thumbs/9O7pStV6TKWB_HpVU6tE6A_pl_480x640.png',
    variations: {
      bottle_medium: '//images.vivino.com/thumbs/9O7pStV6TKWB_HpVU6tE6A_pb_x600.png',
      label_large: '//images.vivino.com/thumbs/9O7pStV6TKWB_HpVU6tE6A_pl_375x500.png',
    },
  },
  vintages: [],
};

describe('wine details for the popover', () => {
  it('collects what the popover shows, preferring the bottle shot', () => {
    expect(toDetails(montFerrant)).toEqual({
      winery: 'Mont-Ferrant',
      wine: "L' Americano Organic Brut Nature",
      countryCode: 'es',
      region: 'Cava',
      typeId: 3,
      grapeIds: [83, 85, 86],
      imageUrl: 'https://images.vivino.com/thumbs/9O7pStV6TKWB_HpVU6tE6A_pb_x600.png',
    });
  });

  it('falls back to the label photo, or no image', () => {
    const labelOnly = { ...montFerrant, image: { variations: { label_large: '//images.vivino.com/l.png' } } };
    expect(toDetails(labelOnly).imageUrl).toBe('https://images.vivino.com/l.png');
    expect(toDetails({ ...montFerrant, image: null }).imageUrl).toBeUndefined();
  });

  it('is part of every match', () => {
    const result = toResult(montFerrant, undefined);
    expect(result.status === 'found' && result.details?.winery).toBe('Mont-Ferrant');
  });

  it('names countries and wine types in the page language', () => {
    expect(countryName('es', 'fi')).toBe('Espanja');
    expect(countryName('es', 'sv')).toBe('Spanien');
    expect(countryName('es', 'en')).toBe('Spain');
    expect(typeName(3, 'fi')).toBe('Kuohuviini');
    expect(typeName(3, 'sv')).toBe('Mousserande vin');
    expect(typeName(99, 'en')).toBeUndefined();
  });
});

describe('fetchImageAsDataUrl', () => {
  it('returns the image as a data: URL', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fakeFetch = (async () => new Response(png, { headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch;
    expect(await fetchImageAsDataUrl('https://images.vivino.com/thumbs/x.png', fakeFetch)).toBe('data:image/png;base64,iVBORw==');
  });

  it('only fetches from images.vivino.com', async () => {
    const fakeFetch = (async () => new Response('')) as unknown as typeof fetch;
    await expect(fetchImageAsDataUrl('https://example.com/x.png', fakeFetch)).rejects.toThrow('Refusing');
    await expect(fetchImageAsDataUrl('http://images.vivino.com/x.png', fakeFetch)).rejects.toThrow('Refusing');
  });

  it('rejects responses that are not images', async () => {
    const fakeFetch = (async () => new Response('<html>', { headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;
    await expect(fetchImageAsDataUrl('https://images.vivino.com/x.png', fakeFetch)).rejects.toThrow('Not an image');
  });
});

describe('loadGrapeNames', () => {
  beforeEach(() => fakeBrowser.reset());

  it('downloads the grape list once and keeps it for a month', async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ grapes: [{ id: 83, name: 'Macabeo' }, { id: 85, name: 'Xarel-lo' }] }));
    }) as unknown as typeof fetch;

    expect(await loadGrapeNames(fakeFetch, 0)).toEqual({ 83: 'Macabeo', 85: 'Xarel-lo' });
    await loadGrapeNames(fakeFetch, 29 * 24 * 3600 * 1000);
    expect(calls).toBe(1);
    await loadGrapeNames(fakeFetch, 31 * 24 * 3600 * 1000);
    expect(calls).toBe(2);
  });

  it('keeps using an old list if the refresh fails', async () => {
    const ok = (async () => new Response(JSON.stringify({ grapes: [{ id: 1, name: 'Merlot' }] }))) as unknown as typeof fetch;
    const failing = (async () => new Response('', { status: 503 })) as unknown as typeof fetch;
    await loadGrapeNames(ok, 0);
    expect(await loadGrapeNames(failing, 60 * 24 * 3600 * 1000)).toEqual({ 1: 'Merlot' });
  });
});

describe('placeNear', () => {
  const viewport = { width: 1000, height: 800 };
  const panel = { width: 440, height: 300 };

  it('opens below the badge, aligned to its left edge', () => {
    const anchor = { left: 100, top: 100, bottom: 124 } as DOMRect;
    expect(placeNear(anchor, panel, viewport)).toEqual({ top: 132, left: 100 });
  });

  it('flips above the badge near the bottom of the window', () => {
    const anchor = { left: 100, top: 700, bottom: 724 } as DOMRect;
    expect(placeNear(anchor, panel, viewport)).toEqual({ top: 392, left: 100 });
  });

  it('stays inside the window on the right', () => {
    const anchor = { left: 900, top: 100, bottom: 124 } as DOMRect;
    expect(placeNear(anchor, panel, viewport).left).toBe(1000 - 440 - 12);
  });
});
