import {
  countryCode,
  distinctiveTokens,
  grapeTokens,
  extractVintage,
  normalize,
  significantTokens,
  toSearchQuery,
  wineType,
} from './normalize';
import type { AlkoProduct, FoundResult, LookupResult, WineDetails } from './types';

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
  region?: { country?: string; name?: string } | null;
  /** 1 red, 2 white, 3 sparkling, 4 rosé, 7 dessert, 24 fortified. */
  type_id?: number;
  statistics?: Statistics | null;
  grapes?: number[] | null;
  image?: { location?: string; variations?: Record<string, string> } | null;
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
        'id', 'name', 'seo_name', 'type_id', 'winery.name', 'winery.seo_name',
        'region.country', 'region.name', 'statistics', 'vintages', 'grapes', 'image',
      ],
      attributesToHighlight: [],
    }),
  });
  if (!res.ok) throw new Error(`Vivino search failed: HTTP ${res.status}`);
  const data = (await res.json()) as { hits?: VivinoHit[] };
  return data.hits ?? [];
}

/** Classification terms that are part of many wine names without identifying the wine. */
const CLASSIFICATION_WORDS = [
  'premier', '1er', 'grand', 'cru', 'classe', 'superiore', 'superieur', 'doc', 'docg', 'aoc', 'aop',
];

/** Share of `needles` that appear in `haystack`. 0 when there are no needles. */
function coverage(needles: string[], haystack: Set<string>): number {
  if (needles.length === 0) return 0;
  return needles.filter((t) => haystack.has(t)).length / needles.length;
}

export interface ScoredHit {
  hit: VivinoHit;
  score: number;
  /** Share of Vivino's producer words that appear in the Alko name. */
  wineryCoverage: number;
  /**
   * Share of Vivino's distinctive wine-name words that appear in the Alko name.
   * 1 when the wine name has none (e.g. a château's grand vin named after its appellation).
   */
  nameCoverage: number;
  /** Number of distinctive words in Vivino's wine name. */
  nameTokenCount: number;
  /** Share of the Alko name's words that appear anywhere in Vivino's producer + wine name. */
  alkoCoverage: number;
  /** Like alkoCoverage, but only counting words that aren't grapes, colours or styles. */
  distinctiveCoverage: number;
  /** Every grape in the Alko name also appears on Vivino. */
  grapesMatch: boolean;
  /** Share of Vivino's producer words that appear in Alko's catalog producer. */
  producerCoverage: number;
  /** Facts that rule the hit out whatever else matches. */
  countryMismatch: boolean;
  typeMismatch: boolean;
  roseMismatch: boolean;
}

const ROSE_WORDS = ['rose', 'rosato', 'rosado', 'rosa', 'pink'];

/** Lightly sparkling styles that Alko files as still wine but Vivino calls sparkling. */
const FRIZZANTE_WORDS = ['frizzante', 'asti', 'lambrusco', 'petillant', 'verde', 'moscato'];

/** Vivino type ids that Alko may file under any category. */
const DESSERT_OR_FORTIFIED = [7, 24];

/**
 * Whether Vivino's wine type fits Alko's category. Only clear contradictions
 * count: a red is not a white, and a still wine is not a sparkling one.
 */
function typeCompatible(expected: number | undefined, actual: number | undefined, alko: Set<string>): boolean {
  if (!expected || !actual || expected === actual) return true;
  if (DESSERT_OR_FORTIFIED.includes(actual)) return true;
  if (actual === 3 && FRIZZANTE_WORDS.some((w) => alko.has(w))) return true;
  return false;
}

export function scoreHit(product: AlkoProduct, hit: VivinoHit): ScoredHit {
  const searchName = toSearchQuery(product.name);
  const alkoTokens = significantTokens(searchName);
  const alko = new Set(alkoTokens);
  const producer = new Set(significantTokens(product.producer ?? ''));
  const wineryTokens = significantTokens(hit.winery?.name ?? '');
  const allNameTokens = significantTokens(hit.name);
  const vivino = new Set([...wineryTokens, ...allNameTokens]);

  // Vivino often names a wine after its appellation or repeats the producer
  // ("Carruades de Lafite Pauillac" by Château Lafite Rothschild). Those words
  // say nothing about which of the producer's wines it is.
  const generic = new Set([
    ...wineryTokens,
    ...significantTokens(hit.region?.name ?? ''),
    ...CLASSIFICATION_WORDS,
  ]);
  const nameTokens = allNameTokens.filter((t) => !generic.has(t));

  const wineryCoverage = coverage(wineryTokens, alko);
  const nameCoverage = nameTokens.length === 0 ? 1 : coverage(nameTokens, alko);
  const alkoCoverage = coverage(alkoTokens, vivino);
  const distinctiveCoverage = coverage(distinctiveTokens(searchName), vivino);
  const grapesMatch = grapeTokens(searchName).every((t) => vivino.has(t));
  const producerCoverage = coverage(wineryTokens, producer);

  const expectedCountry = countryCode(product.country);
  const actualCountry = hit.region?.country;
  const countryMismatch = !!expectedCountry && !!actualCountry && expectedCountry !== actualCountry;

  // Alko's category says red/white/rosé/sparkling; Vivino records the same as type_id.
  const typeMismatch = !typeCompatible(wineType(product.category), hit.type_id, alko);

  // "Charles Heidsieck Rosé Réserve" is not the house's "Brut Réserve".
  const alkoSaysRose = ROSE_WORDS.some((w) => alko.has(w));
  const roseMismatch = alkoSaysRose && hit.type_id !== 4 && !ROSE_WORDS.some((w) => vivino.has(w));

  // A vintage that Vivino has ratings for is a sign of the right wine: Palmer's
  // "Collection Vintage 1999" is their vintage champagne, not the non-vintage Brut Réserve.
  const year = extractVintage(product.name);
  const knownVintage = !!year && !!hit.vintages?.some(
    (v) => v.year === String(year) && (v.statistics?.ratings_count ?? 0) > 0,
  );

  const score =
    2 * wineryCoverage + nameCoverage + alkoCoverage + distinctiveCoverage + producerCoverage +
    (expectedCountry === actualCountry ? 0.5 : 0) + (knownVintage ? 0.5 : 0);
  return {
    hit, score, wineryCoverage, nameCoverage, nameTokenCount: nameTokens.length, alkoCoverage,
    distinctiveCoverage, grapesMatch, producerCoverage, countryMismatch, typeMismatch, roseMismatch,
  };
}

/** How convincing a hit is: `strong` rests on the producer, `weak` only on Algolia's ranking. */
type Plausibility = 'strong' | 'weak' | false;

/**
 * Whether a hit is believable at all. A wrong rating is worse than none, so
 * this is strict: one shared producer word plus a grape name is not enough.
 */
function plausibility(s: ScoredHit, rank: number): Plausibility {
  if (s.countryMismatch || s.typeMismatch || s.roseMismatch) return false;
  // Every producer word is in the Alko name ("Quinta do Crasto ...").
  if (s.wineryCoverage === 1) return 'strong';
  // Part of the producer plus the full, multi-word wine name.
  if (s.wineryCoverage >= 0.5 && s.nameCoverage === 1 && s.nameTokenCount >= 2) return 'strong';
  // Alko's catalog names the producer ("Tanca Farrá" by Sella & Mosca) and the wine's
  // own distinctive words match. Grapes alone don't count: Alko's producer field is
  // sometimes a big group like Concha y Toro, which makes many Cabernets.
  // All of them must match: "Pegasus Tombola" is not San Cassiano's "Pegasus Amarone",
  // and "Lobetia Tempranillo Shiraz" is not the producer's straight "Lobetia Tempranillo".
  if (s.producerCoverage === 1 && s.distinctiveCoverage === 1 && s.grapesMatch) return 'strong';
  // Alko sometimes names the wine without its producer ("Château Malvat" is made by
  // Château Villars). Only trust that when Algolia itself ranks the hit first.
  return rank === 0 && s.alkoCoverage === 1 ? 'weak' : false;
}

export interface Match {
  hit: VivinoHit;
  plausibility: 'strong' | 'weak';
}

/**
 * Picks the Vivino hit that best matches the Alko product, or undefined when
 * none is convincing. Each step down Algolia's ranking costs a little, since
 * Algolia already handles things like "Old Vines" vs "Vinhas Velhas" better
 * than token overlap can.
 */
export function pickBestMatch(product: AlkoProduct, hits: VivinoHit[]): Match | undefined {
  let best: (Match & { rankedScore: number }) | undefined;
  hits.forEach((hit, rank) => {
    const s = scoreHit(product, hit);
    const p = plausibility(s, rank);
    const rankedScore = s.score - 0.25 * rank;
    if (p && (!best || rankedScore > best.rankedScore)) best = { hit, plausibility: p, rankedScore };
  });
  return best && { hit: best.hit, plausibility: best.plausibility };
}

export function pickBestHit(product: AlkoProduct, hits: VivinoHit[]): VivinoHit | undefined {
  return pickBestMatch(product, hits)?.hit;
}

function hasRating(s: Statistics | null | undefined): s is Statistics {
  return !!s && s.ratings_average > 0 && s.ratings_count > 0 && s.status !== 'BelowThreshold';
}

export function vivinoWineUrl(wineId: number, year?: number): string {
  const url = new URL(`https://www.vivino.com/w/${wineId}`);
  if (year) url.searchParams.set('year', String(year));
  return url.toString();
}

/**
 * Explore's filter state, zlib-compressed and base64url-encoded: just "nb=true",
 * which includes wines that aren't for sale. Vivino's plain search
 * (/search/wines?q=) only lists wines you can buy there, and hides sold-out ones.
 */
const EXPLORE_ALL_WINES = 'eJzLS7ItKSpNBQAK-wLO';

/** Vivino's wine search, including wines that aren't for sale. */
export function vivinoSearchUrl(query: string): string {
  const url = new URL('https://www.vivino.com/explore');
  url.searchParams.set('e', EXPLORE_ALL_WINES);
  url.searchParams.set('search_term', query);
  return url.toString();
}

/** Builds the lookup result for a matched hit, preferring the vintage's own rating. */
/** Vivino image URLs are protocol-relative ("//images.vivino.com/..."). */
function absoluteImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('//') ? `https:${url}` : url;
}

/** The details the popover shows, preferring a bottle shot over a label photo. */
export function toDetails(hit: VivinoHit): WineDetails {
  const images = hit.image?.variations ?? {};
  return {
    winery: hit.winery?.name,
    wine: hit.name,
    countryCode: hit.region?.country,
    region: hit.region?.name,
    typeId: hit.type_id,
    grapeIds: hit.grapes?.length ? hit.grapes : undefined,
    imageUrl: absoluteImageUrl(images.bottle_medium ?? images.label_large ?? hit.image?.location),
  };
}

export function toResult(hit: VivinoHit, year: number | undefined): FoundResult {
  const wineName = [hit.winery?.name, hit.name].filter(Boolean).join(' ');
  const vintage = year ? hit.vintages?.find((v) => v.year === String(year)) : undefined;
  const details = toDetails(hit);

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
      details,
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
    // Keep the year for display when Alko sells a vintage, even if the rating covers all of them.
    year: vintage ? year : undefined,
    details,
  };
}

export async function lookupProduct(
  product: AlkoProduct,
  fetchImpl: typeof fetch = fetch,
): Promise<LookupResult> {
  const query = toSearchQuery(product.name);
  let match = pickBestMatch(product, await searchVivino(query, fetchImpl));

  // Alko often leaves the producer out of the name ("Tanca Farrá" by Sella & Mosca).
  // If the name alone found nothing, or only a match that rests on Algolia's ranking,
  // search again with the catalog producer in front and prefer a producer-backed match:
  // "Special Club Premier Cru 2016" by Gaston Chiquet is not Marc Hébrart's Special Club.
  const withProducer = producerQuery(product.producer, query);
  if (withProducer && match?.plausibility !== 'strong') {
    const retry = pickBestMatch(product, await searchVivino(withProducer, fetchImpl));
    if (retry && (!match || retry.plausibility === 'strong')) match = retry;
  }

  if (!match) return { status: 'not-found', searchUrl: vivinoSearchUrl(query) };
  return { ...toResult(match.hit, extractVintage(product.name)), searchUrl: vivinoSearchUrl(query) };
}

/** The search query with the producer added, or undefined if it adds nothing new. */
export function producerQuery(producer: string | undefined, query: string): string | undefined {
  if (!producer) return undefined;
  const inQuery = new Set(significantTokens(query));
  const extra = significantTokens(producer).filter((t) => !inQuery.has(t));
  return extra.length > 0 ? `${normalize(producer)} ${query}` : undefined;
}
