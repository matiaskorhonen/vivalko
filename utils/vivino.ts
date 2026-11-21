import {
  countryCode,
  extractVintage,
  significantTokens,
  toSearchQuery,
} from './normalize';
import type { AlkoProduct, LookupResult } from './types';

/**
 * Vivino's own wine search is backed by Algolia. These are the public,
 * search-only credentials that vivino.com ships to every browser.
 */
const ALGOLIA_URL = 'https://9takgwjuxl-dsn.algolia.net/1/indexes/WINES_prod/query';
const ALGOLIA_APP_ID = '9TAKGWJUXL';
const ALGOLIA_API_KEY = '60c11b2f1068885161d95ca068d3a6ae';

interface Statistics {
  status?: string;
  ratings_count: number;
  ratings_average: number;
}

export interface VivinoHit {
  id: number;
  name: string;
  seo_name?: string;
  winery?: { name: string; seo_name?: string } | null;
  region?: { country?: string } | null;
  statistics?: Statistics | null;
  vintages?: { id: number; year: string; name: string; statistics?: Statistics | null }[];
}

export async function searchVivino(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VivinoHit[]> {
  const res = await fetchImpl(ALGOLIA_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-algolia-application-id': ALGOLIA_APP_ID,
      'x-algolia-api-key': ALGOLIA_API_KEY,
    },
    body: JSON.stringify({
      query,
      hitsPerPage: 6,
      attributesToRetrieve: [
        'id', 'name', 'seo_name', 'winery.name', 'winery.seo_name',
        'region.country', 'statistics', 'vintages',
      ],
      attributesToHighlight: [],
    }),
  });
  if (!res.ok) throw new Error(`Vivino search failed: HTTP ${res.status}`);
  const data = (await res.json()) as { hits?: VivinoHit[] };
  return data.hits ?? [];
}

/** Share of `needles` that appear in `haystack`. 0 when there are no needles. */
function coverage(needles: string[], haystack: Set<string>): number {
  if (needles.length === 0) return 0;
  return needles.filter((t) => haystack.has(t)).length / needles.length;
}

export interface ScoredHit {
  hit: VivinoHit;
  score: number;
  wineryCoverage: number;
  nameCoverage: number;
}

export function scoreHit(product: AlkoProduct, hit: VivinoHit): ScoredHit {
  const alko = new Set(significantTokens(product.name));
  const wineryCoverage = coverage(significantTokens(hit.winery?.name ?? ''), alko);
  const nameCoverage = coverage(significantTokens(hit.name), alko);

  let score = 2 * wineryCoverage + nameCoverage;
  const expected = countryCode(product.country);
  const actual = hit.region?.country;
  if (expected && actual) score += expected === actual ? 0.5 : -1;

  return { hit, score, wineryCoverage, nameCoverage };
}

/**
 * Picks the Vivino hit that best matches the Alko product, or undefined when
 * none is convincing. Each step down Algolia's ranking costs a little, since
 * Algolia already handles things like "Old Vines" vs "Vinhas Velhas" better
 * than token overlap can.
 */
export function pickBestHit(product: AlkoProduct, hits: VivinoHit[]): VivinoHit | undefined {
  let best: { hit: VivinoHit; rankedScore: number } | undefined;
  hits.forEach((hit, rank) => {
    const s = scoreHit(product, hit);
    const plausible =
      s.wineryCoverage >= 0.5 ||
      (s.nameCoverage === 1 && significantTokens(hit.name).length >= 2);
    const rankedScore = s.score - 0.25 * rank;
    if (plausible && s.score >= 1.2 && (!best || rankedScore > best.rankedScore)) {
      best = { hit, rankedScore };
    }
  });
  return best?.hit;
}

function hasRating(s: Statistics | null | undefined): s is Statistics {
  return !!s && s.ratings_average > 0 && s.ratings_count > 0 && s.status !== 'BelowThreshold';
}

export function vivinoWineUrl(wineId: number, year?: number): string {
  const url = new URL(`https://www.vivino.com/w/${wineId}`);
  if (year) url.searchParams.set('year', String(year));
  return url.toString();
}

export function vivinoSearchUrl(query: string): string {
  const url = new URL('https://www.vivino.com/search/wines');
  url.searchParams.set('q', query);
  return url.toString();
}

/** Builds the lookup result for a matched hit, preferring the vintage's own rating. */
export function toResult(hit: VivinoHit, year: number | undefined): LookupResult {
  const wineName = [hit.winery?.name, hit.name].filter(Boolean).join(' ');
  const vintage = year ? hit.vintages?.find((v) => v.year === String(year)) : undefined;

  if (year && hasRating(vintage?.statistics)) {
    return {
      status: 'found',
      wineId: hit.id,
      wineName: vintage!.name,
      url: vivinoWineUrl(hit.id, year),
      rating: vintage!.statistics!.ratings_average,
      ratingsCount: vintage!.statistics!.ratings_count,
      scope: 'vintage',
      year,
    };
  }

  const stats = hit.statistics;
  return {
    status: 'found',
    wineId: hit.id,
    wineName,
    url: vivinoWineUrl(hit.id, vintage ? year : undefined),
    rating: hasRating(stats) ? stats.ratings_average : null,
    ratingsCount: stats?.ratings_count ?? 0,
    scope: 'wine',
  };
}

export async function lookupProduct(
  product: AlkoProduct,
  fetchImpl: typeof fetch = fetch,
): Promise<LookupResult> {
  const query = toSearchQuery(product.name);
  const hits = await searchVivino(query, fetchImpl);
  const hit = pickBestHit(product, hits);
  if (!hit) return { status: 'not-found', searchUrl: vivinoSearchUrl(query) };
  return toResult(hit, extractVintage(product.name));
}
