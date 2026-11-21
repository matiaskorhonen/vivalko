/**
 * The language Alko is showing: the first segment of the path (/fi/, /sv/, /en/).
 * `<html lang>` is not reliable, because it keeps its old value when the
 * language is switched without a page reload.
 */
export function pageLanguage(path: string = location.pathname): string {
  return path.match(/^\/(fi|sv|en)(?:\/|$)/)?.[1] ?? (document.documentElement.lang || 'fi');
}

const LABELS = {
  fi: {
    ratings: 'arviota',
    allVintages: 'kaikki vuosikerrat',
    notFound: 'ei löytynyt',
    tooFew: 'liian vähän arvioita',
    error: 'ei saatavilla',
    loading: 'haetaan',
    openOnVivino: 'Avaa Vivinossa',
    wrongWine: 'Väärä viini? Hae Vivinosta',
    close: 'Sulje',
    grapes: 'Rypäleet',
    blend: 'Sekoitus',
    ratingForVintage: 'Arvio vuosikerralle',
    ratingForAllVintages: 'Arvio kaikista vuosikerroista',
    types: { 1: 'Punaviini', 2: 'Valkoviini', 3: 'Kuohuviini', 4: 'Roseeviini', 7: 'Jälkiruokaviini', 24: 'Väkevä viini' },
  },
  sv: {
    ratings: 'betyg',
    allVintages: 'alla årgångar',
    notFound: 'hittades inte',
    tooFew: 'för få betyg',
    error: 'inte tillgänglig',
    loading: 'söker',
    openOnVivino: 'Öppna på Vivino',
    wrongWine: 'Fel vin? Sök på Vivino',
    close: 'Stäng',
    grapes: 'Druvor',
    blend: 'Blandning',
    ratingForVintage: 'Betyg för årgång',
    ratingForAllVintages: 'Betyg för alla årgångar',
    types: { 1: 'Rött vin', 2: 'Vitt vin', 3: 'Mousserande vin', 4: 'Rosévin', 7: 'Dessertvin', 24: 'Starkvin' },
  },
  en: {
    ratings: 'ratings',
    allVintages: 'all vintages',
    notFound: 'not found',
    tooFew: 'too few ratings',
    error: 'unavailable',
    loading: 'searching',
    openOnVivino: 'Open on Vivino',
    wrongWine: 'Wrong wine? Search Vivino',
    close: 'Close',
    grapes: 'Grapes',
    blend: 'Blend',
    ratingForVintage: 'Rating for vintage',
    ratingForAllVintages: 'Rating across all vintages',
    types: { 1: 'Red wine', 2: 'White wine', 3: 'Sparkling wine', 4: 'Rosé wine', 7: 'Dessert wine', 24: 'Fortified wine' },
  },
} satisfies Record<string, unknown>;

export type Labels = (typeof LABELS)['fi'];

/** Labels in the Alko page language (fi is the default, sv and en are also served). */
export function labels(lang: string): Labels {
  if (lang.startsWith('sv')) return LABELS.sv;
  if (lang.startsWith('en')) return LABELS.en;
  return LABELS.fi;
}

/** Vivino's wine type (1 red, 2 white, ...) as a name in the page language. */
export function typeName(typeId: number | undefined, lang: string): string | undefined {
  if (!typeId) return undefined;
  return (labels(lang).types as Record<number, string>)[typeId];
}

/** A country name in the page language from an ISO code like "es". */
export function countryName(code: string | undefined, lang: string): string | undefined {
  if (!code) return undefined;
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code.toUpperCase());
  } catch {
    return undefined;
  }
}

export function formatRating(rating: number, lang: string): string {
  return rating.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function formatCount(n: number, lang: string): string {
  return new Intl.NumberFormat(lang, { notation: n >= 10000 ? 'compact' : 'standard' }).format(n);
}
