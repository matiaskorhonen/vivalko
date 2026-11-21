/** Lowercase, strip diacritics and punctuation, collapse whitespace. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokens(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

/**
 * Words Alko adds to product names that describe packaging, size or labelling
 * rather than the wine itself. Matched against normalized text.
 */
const PACKAGING_WORDS = [
  'kartonkitolkki',
  'hanapakkaus',
  'bag in box',
  'muovipullo',
  'tolkki',
  'pouch',
  'double magnum',
  'magnum',
  'jeroboam',
  'rehoboam',
  'mathusalem',
  'methuselah',
  'salmanazar',
  'balthazar',
  'nebuchadnezzar',
  'luomu',
  'lahjapakkaus',
  'gift box',
];

const PACKAGING_RE = new RegExp(`\\b(${PACKAGING_WORDS.join('|')})\\b`, 'g');
const VINTAGE_RE = /\b(19[5-9]\d|20[0-4]\d)\b/;

/** Extracts the vintage year from a product name, if there is one. */
export function extractVintage(name: string): number | undefined {
  const m = name.match(VINTAGE_RE);
  return m ? Number(m[1]) : undefined;
}

/** Turns an Alko product name into a Vivino search query. */
export function toSearchQuery(name: string): string {
  return normalize(name)
    .replace(new RegExp(VINTAGE_RE.source, 'g'), ' ')
    .replace(PACKAGING_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generic words that appear in many producer and wine names. They are ignored
 * when scoring matches so "Quinta do Crasto" does not look like "Quinta do Javali".
 */
export const STOPWORDS = new Set([
  'chateau', 'ch', 'domaine', 'dom', 'bodega', 'bodegas', 'tenuta', 'cantina', 'cantine',
  'quinta', 'weingut', 'cave', 'caves', 'casa', 'clos', 'maison', 'castello', 'fattoria',
  'vina', 'vinedos', 'estate', 'estates', 'winery', 'wines', 'vineyards', 'cellars',
  'family', 'de', 'del', 'della', 'di', 'da', 'do', 'dos', 'das', 'du', 'des', 'la', 'le',
  'les', 'el', 'los', 'las', 'il', 'lo', 'von', 'van', 'der', 'den', 'the', 'and', 'et',
  'e', 'y', 'und', 'st', 'saint', 'sainte', 'san', 'santa',
]);

export function significantTokens(s: string): string[] {
  return tokens(s).filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/**
 * Alko country names (Finnish, Swedish and English site locales) mapped to the
 * lowercase ISO codes Vivino uses.
 */
const COUNTRY_CODES: Record<string, string> = {
  // Finnish
  italia: 'it', ranska: 'fr', espanja: 'es', portugali: 'pt', saksa: 'de', itavalta: 'at',
  unkari: 'hu', kreikka: 'gr', yhdysvallat: 'us', chile: 'cl', argentiina: 'ar',
  australia: 'au', 'uusi seelanti': 'nz', 'etela afrikka': 'za', kanada: 'ca',
  slovenia: 'si', kroatia: 'hr', georgia: 'ge', libanon: 'lb', israel: 'il', moldova: 'md',
  romania: 'ro', bulgaria: 'bg', sveitsi: 'ch', englanti: 'gb', 'iso britannia': 'gb',
  uruguay: 'uy', brasilia: 'br', kiina: 'cn', japani: 'jp', turkki: 'tr', slovakia: 'sk',
  tsekki: 'cz', serbia: 'rs', 'pohjois makedonia': 'mk', armenia: 'am', luxemburg: 'lu',
  suomi: 'fi', meksiko: 'mx', kypros: 'cy', malta: 'mt',
  // Swedish
  frankrike: 'fr', spanien: 'es', tyskland: 'de', osterrike: 'at', ungern: 'hu',
  grekland: 'gr', usa: 'us', argentina: 'ar', 'nya zeeland': 'nz', sydafrika: 'za',
  schweiz: 'ch', england: 'gb', storbritannien: 'gb', finland: 'fi',
  // English
  italy: 'it', france: 'fr', spain: 'es', portugal: 'pt', germany: 'de', austria: 'at',
  hungary: 'hu', greece: 'gr', 'united states': 'us', 'new zealand': 'nz',
  'south africa': 'za', canada: 'ca', switzerland: 'ch', 'united kingdom': 'gb',
};

export function countryCode(country: string | undefined): string | undefined {
  if (!country) return undefined;
  return COUNTRY_CODES[normalize(country)];
}

/** True for Alko categories that are wines (in any of Alko's site locales). */
export function isWineCategory(category: string | undefined): boolean {
  if (!category) return false;
  const c = normalize(category);
  if (/viinijuom|glog|wine drink|vindryck|alkoholiton|alkoholfri|non alcoholic/.test(c)) {
    return false;
  }
  return /viin|samppanj|wine|champagne|vin/.test(c);
}
