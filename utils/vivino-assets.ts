import { storage } from 'wxt/utils/storage';

const IMAGE_HOST = 'images.vivino.com';

/**
 * Downloads a Vivino image and returns it as a data: URL. Alko's Content
 * Security Policy blocks images from vivino.com but allows data: URLs.
 * Only images.vivino.com is allowed, so the page can't use this as a general proxy.
 */
export async function fetchImageAsDataUrl(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== IMAGE_HOST) {
    throw new Error(`Refusing to fetch image from ${parsed.origin}`);
  }
  const res = await fetchImpl(parsed.toString());
  if (!res.ok) throw new Error(`Image fetch failed: HTTP ${res.status}`);
  const type = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  if (!type.startsWith('image/')) throw new Error(`Not an image: ${type}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // Service workers have no FileReader; build the base64 string in chunks.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return `data:${type};base64,${btoa(binary)}`;
}

const GRAPES_URL = 'https://www.vivino.com/api/grapes?language=en';
const GRAPES_TTL = 30 * 24 * 60 * 60 * 1000;

interface GrapeNames {
  names: Record<string, string>;
  storedAt: number;
}

const grapeNamesItem = storage.defineItem<GrapeNames | null>('local:grapeNames', { fallback: null });

/**
 * Vivino's grape id → name list. It is ~300 KB from Vivino, so a compact
 * copy is kept in storage and refreshed monthly.
 */
export async function loadGrapeNames(
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<Record<string, string>> {
  const stored = await grapeNamesItem.getValue();
  if (stored && now - stored.storedAt < GRAPES_TTL) return stored.names;

  const res = await fetchImpl(GRAPES_URL);
  if (!res.ok) {
    // An old list is better than none.
    if (stored) return stored.names;
    throw new Error(`Grape list fetch failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { grapes?: { id: number; name: string }[] };
  const names: Record<string, string> = {};
  for (const g of data.grapes ?? []) names[g.id] = g.name;
  await grapeNamesItem.setValue({ names, storedAt: now });
  return names;
}
