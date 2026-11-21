import { describe, expect, it } from 'vitest';
import { fetchAlkoDetails } from '../utils/alko-api';

// Trimmed from a real /api/search/product response.
const RESPONSE = {
  '@odata.count': 1,
  value: [
    {
      id: '436367',
      name: 'Château Malvat 2018',
      producer: 'Famille Gaudrie',
      country: 'countryId|FRA|Ranska|',
      countryName: 'Ranska',
      productGroupName: ['punaviinit', 'punaviinit'],
    },
  ],
};

describe('fetchAlkoDetails', () => {
  it("searches Alko's API by product number and reads the producer", async () => {
    let body: any;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      expect(url).toBe('https://www.alko.fi/api/search/product?lang=fi');
      body = JSON.parse(init.body as string);
      return new Response(JSON.stringify(RESPONSE));
    }) as typeof fetch;

    expect(await fetchAlkoDetails('436367', fakeFetch)).toEqual({
      id: '436367', name: 'Château Malvat 2018', producer: 'Famille Gaudrie', country: 'Ranska',
    });
    expect(body).toEqual({ search: '436367', top: 1 });
  });

  it('ignores results for other products', async () => {
    const fakeFetch = (async () => new Response(JSON.stringify(RESPONSE))) as unknown as typeof fetch;
    expect(await fetchAlkoDetails('999999', fakeFetch)).toBeUndefined();
  });

  it('throws on HTTP errors so the caller can fall back to the name', async () => {
    const fakeFetch = (async () => new Response('blocked', { status: 403 })) as unknown as typeof fetch;
    await expect(fetchAlkoDetails('436367', fakeFetch)).rejects.toThrow('HTTP 403');
  });
});
