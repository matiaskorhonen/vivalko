/** A wine as read from an Alko.fi page. */
export interface AlkoProduct {
  /** Alko product number, e.g. "901614". */
  id: string;
  /** Full product name as shown by Alko, e.g. "Michele Chiarlo Cipressi Nizza 2022". */
  name: string;
  /** Country name in the page locale, e.g. "Italia". */
  country?: string;
  /** Category in the page locale, e.g. "Punaviinit". */
  category?: string;
  /** Producer from Alko's catalog. Sometimes the importer or brand owner instead. */
  producer?: string;
}

/** What the popover shows about a matched wine, as Vivino lists it. */
export interface WineDetails {
  winery?: string;
  /** The wine's own name, without the producer, e.g. "L' Americano Organic Brut Nature". */
  wine: string;
  /** Lowercase ISO country code, e.g. "es". */
  countryCode?: string;
  region?: string;
  /** 1 red, 2 white, 3 sparkling, 4 rosé, 7 dessert, 24 fortified. */
  typeId?: number;
  /** Vivino grape ids; names are looked up separately. */
  grapeIds?: number[];
  /** https URL of a bottle shot, or of a label photo when there is no bottle shot. */
  imageUrl?: string;
}

export type FoundResult = {
  status: 'found';
  wineId: number;
  /** Vivino's full name for the matched wine, shown in the tooltip. */
  wineName: string;
  url: string;
  /** Average rating, or null when Vivino has too few ratings to show one. */
  rating: number | null;
  ratingsCount: number;
  /** Whether the rating is for the requested vintage or across all vintages. */
  scope: 'vintage' | 'wine';
  year?: number;
  details?: WineDetails;
  /** Vivino search for the Alko name, for when the match is the wrong wine. */
  searchUrl?: string;
};

export type LookupResult = FoundResult | { status: 'not-found'; searchUrl: string };

export interface LookupRequest {
  type: 'vivalko:lookup';
  product: AlkoProduct;
}

export type LookupResponse =
  | { ok: true; result: LookupResult }
  | { ok: false; error: string };

/** Fetches a Vivino image as a data: URL, since Alko's page doesn't allow Vivino images. */
export interface ImageRequest {
  type: 'vivalko:image';
  url: string;
}

/** Looks up Vivino grape names by id. */
export interface GrapesRequest {
  type: 'vivalko:grapes';
  ids: number[];
}

export type Message = LookupRequest | ImageRequest | GrapesRequest;
