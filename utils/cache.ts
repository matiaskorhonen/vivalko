import { storage } from 'wxt/utils/storage';
import type { LookupResult } from './types';

const DAY = 24 * 60 * 60 * 1000;
const FOUND_TTL = 7 * DAY;
const NOT_FOUND_TTL = 1 * DAY;
const PREFIX = 'vivino:';

interface CacheEntry {
  result: LookupResult;
  storedAt: number;
}

export const enabledSetting = storage.defineItem<boolean>('local:enabled', { fallback: true });

export async function getCached(alkoId: string, now = Date.now()): Promise<LookupResult | undefined> {
  const entry = await storage.getItem<CacheEntry>(`local:${PREFIX}${alkoId}`);
  if (!entry) return undefined;
  // Matches cached before the popover existed lack its details; look them up again.
  if (entry.result.status === 'found' && !entry.result.details) return undefined;
  const ttl = entry.result.status === 'found' ? FOUND_TTL : NOT_FOUND_TTL;
  return now - entry.storedAt < ttl ? entry.result : undefined;
}

export async function setCached(alkoId: string, result: LookupResult, now = Date.now()): Promise<void> {
  await storage.setItem<CacheEntry>(`local:${PREFIX}${alkoId}`, { result, storedAt: now });
}

async function cacheKeys(): Promise<string[]> {
  const all = await storage.snapshot('local');
  return Object.keys(all).filter((k) => k.startsWith(PREFIX));
}

export async function cacheStats(): Promise<{ found: number; notFound: number }> {
  const all = await storage.snapshot('local');
  let found = 0;
  let notFound = 0;
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(PREFIX)) continue;
    if ((value as CacheEntry).result?.status === 'found') found++;
    else notFound++;
  }
  return { found, notFound };
}

export async function clearCache(): Promise<void> {
  const keys = await cacheKeys();
  await storage.removeItems(keys.map((k) => `local:${k}` as const));
}
