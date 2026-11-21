/**
 * Alko's own product search API, used by alko.fi's listing pages. It returns
 * catalog details that the product cards don't show, most usefully the producer.
 *
 * This must be called from a page on alko.fi (the content script): the site sits
 * behind a web application firewall that only lets normal browser sessions through.
 */

export interface AlkoDetails {
  id: string;
  name: string;
  /** Producer or brand owner. Sometimes the importer instead (e.g. "Hartwall"). */
  producer?: string;
  /** Finnish country name, e.g. "Ranska". */
  country?: string;
}

interface SearchItem {
  id: string;
  name?: string;
  producer?: string;
  countryName?: string;
}

export async function fetchAlkoDetails(
  id: string,
  fetchImpl: typeof fetch = fetch,
  // Absolute, because Firefox resolves relative URLs in content scripts against the extension.
  origin: string = globalThis.location?.origin ?? 'https://www.alko.fi',
): Promise<AlkoDetails | undefined> {
  // Free-text search on the product number returns exactly that product.
  const res = await fetchImpl(`${origin}/api/search/product?lang=fi`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ search: id, top: 1 }),
  });
  if (!res.ok) throw new Error(`Alko product search failed: HTTP ${res.status}`);
  const data = (await res.json()) as { value?: SearchItem[] };
  const item = data.value?.find((v) => v.id === id);
  if (!item?.name) return undefined;
  return {
    id,
    name: item.name,
    producer: item.producer?.trim() || undefined,
    country: item.countryName?.trim() || undefined,
  };
}
