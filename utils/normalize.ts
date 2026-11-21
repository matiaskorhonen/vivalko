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
  // Drop availability notes like "(erittäin rajallinen saatavuus, 1plo/asiakas)" and
  // alcohol strengths like "8%" before normalizing away the punctuation that marks them.
  const cleaned = name.replace(/\([^)]*\)/g, ' ').replace(/\b\d+(?:[.,]\d+)?\s*%/g, ' ');
  return normalize(cleaned)
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
  // Company forms, common in Alko's producer field.
  'oy', 'ab', 'ltd', 'sa', 'spa', 'srl', 'sarl', 'sas', 'gmbh', 'ag', 'inc', 'co', 'llc',
  'group', 'groupe', 'company', 'compagnie', 'vinicole', 'vins', 'vini', 'vinos',
]);

export function significantTokens(s: string): string[] {
  return tokens(s).filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

/**
 * Grape, colour and style words. Many unrelated wines share them, so they
 * cannot tell two wines from the same producer apart.
 */
const GRAPE_WORDS = new Set([
  'cabernet', 'sauvignon', 'merlot', 'pinot', 'noir', 'grigio', 'gris', 'chardonnay',
  'riesling', 'syrah', 'shiraz', 'tempranillo', 'malbec', 'zinfandel', 'primitivo',
  'sangiovese', 'nebbiolo', 'barbera', 'grenache', 'garnacha', 'carmenere', 'viognier',
  'chenin', 'gewurztraminer', 'gruner', 'veltliner', 'albarino', 'verdejo', 'moscato',
  'muscat', 'monastrell', 'mourvedre', 'cinsault', 'pinotage', 'semillon', 'carignan',
  'mataro', 'aglianico', 'negroamaro', 'montepulciano', 'vermentino', 'trollinger',
  'spatburgunder', 'grauburgunder', 'weissburgunder', 'colombard',
]);

const STYLE_WORDS = new Set([
  'franc', 'red', 'white', 'rose', 'rosso', 'rosato', 'rosado', 'rouge', 'blanc', 'blanco',
  'bianco', 'branco', 'tinto', 'weiss', 'rot', 'dry', 'sec', 'secco', 'brut', 'extra', 'nature',
  'trocken', 'organic', 'organico', 'bio', 'reserve', 'reserva', 'riserva', 'crianza',
  'classic', 'selection', 'cuvee', 'vintage', 'millesime',
]);

/** Significant tokens that identify a particular wine rather than a grape or style. */
export function distinctiveTokens(s: string): string[] {
  return significantTokens(s).filter((t) => !GRAPE_WORDS.has(t) && !STYLE_WORDS.has(t));
}

/** Grape variety words in a name. */
export function grapeTokens(s: string): string[] {
  return significantTokens(s).filter((t) => GRAPE_WORDS.has(t));
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
  italien: 'it', australien: 'au', slovenien: 'si', kroatien: 'hr', georgien: 'ge',
  rumanien: 'ro', bulgarien: 'bg', moldavien: 'md', brasilien: 'br', kina: 'cn',
  turkiet: 'tr', slovakien: 'sk', tjeckien: 'cz', serbien: 'rs', nordmakedonien: 'mk',
  armenien: 'am', cypern: 'cy', belgien: 'be',
  // English
  italy: 'it', france: 'fr', spain: 'es', portugal: 'pt', germany: 'de', austria: 'at',
  hungary: 'hu', greece: 'gr', 'united states': 'us', 'new zealand': 'nz',
  'south africa': 'za', canada: 'ca', switzerland: 'ch', 'united kingdom': 'gb',
  lebanon: 'lb', croatia: 'hr', brazil: 'br', china: 'cn', japan: 'jp', turkey: 'tr',
  'czech republic': 'cz', czechia: 'cz', 'north macedonia': 'mk', luxembourg: 'lu',
  mexico: 'mx', cyprus: 'cy', belgium: 'be',
  // Finnish, missing above
  belgia: 'be',
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

/**
 * Vivino's wine type (1 red, 2 white, 3 sparkling, 4 rosé) for an Alko category,
 * or undefined for categories without a clear counterpart (dessert, fortified, ...).
 */
export function wineType(category: string | undefined): 1 | 2 | 3 | 4 | undefined {
  if (!category) return undefined;
  const c = normalize(category);
  if (/kuohu|samppanj|mousserande|sparkling|champagne/.test(c)) return 3;
  if (/^(rosee|rose)/.test(c)) return 4;
  if (/^(puna|rod|red)/.test(c)) return 1;
  if (/^(valko|vit|white)/.test(c)) return 2;
  return undefined;
}
