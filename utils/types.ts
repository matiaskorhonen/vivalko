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

export type LookupResult =
  | {
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
    }
  | { status: 'not-found'; searchUrl: string };

export interface LookupRequest {
  type: 'vivalko:lookup';
  product: AlkoProduct;
}

export type LookupResponse =
  | { ok: true; result: LookupResult }
  | { ok: false; error: string };
