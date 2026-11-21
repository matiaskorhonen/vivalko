import { describe, expect, it } from 'vitest';
import {
  countryCode,
  extractVintage,
  isWineCategory,
  normalize,
  toSearchQuery,
} from '../utils/normalize';
import { lookupProduct, pickBestHit, toResult, type VivinoHit } from '../utils/vivino';
import chiarlo from './fixtures/chiarlo.json';
import crasto from './fixtures/crasto.json';
import lafite from './fixtures/lafite.json';
import malmaison from './fixtures/malmaison.json';
import malvat from './fixtures/malvat.json';
import sangreazul from './fixtures/sangreazul.json';
import zensa from './fixtures/zensa.json';

describe('normalize', () => {
  it('strips accents, case and punctuation', () => {
    expect(normalize('Château Moulis-en-Médoc')).toBe('chateau moulis en medoc');
  });

  it('builds search queries without vintage or packaging words', () => {
    expect(toSearchQuery('Quinta do Crasto Reserva Old Vines Mathusalem 2017')).toBe(
      'quinta do crasto reserva old vines',
    );
    expect(toSearchQuery('Vegas del Rivilla Tinto kartonkitölkki')).toBe('vegas del rivilla tinto');
    expect(toSearchQuery('Foo Double Magnum 2019')).toBe('foo');
    expect(toSearchQuery('Château Lafite Rothschild (erittäin rajallinen saatavuus, 1plo/asiakas) 2000')).toBe(
      'chateau lafite rothschild',
    );
    expect(toSearchQuery('Setencostas Rosé 8% 2025')).toBe('setencostas rose');
  });

  it('extracts vintages', () => {
    expect(extractVintage('Château Malmaison 2017')).toBe(2017);
    expect(extractVintage('Vegas del Rivilla Tinto')).toBeUndefined();
  });

  it('maps country names', () => {
    expect(countryCode('Portugali')).toBe('pt');
    expect(countryCode('Etelä-Afrikka')).toBe('za');
    expect(countryCode('Nya Zeeland')).toBe('nz');
    expect(countryCode('Atlantis')).toBeUndefined();
  });

  it('recognizes wine categories', () => {
    for (const c of ['Punaviinit', 'Valkoviinit', 'Kuohuviinit & Samppanjat', 'Red wines', 'Rödviner']) {
      expect(isWineCategory(c), c).toBe(true);
    }
    for (const c of ['Glögit', 'Viinijuomat', 'Oluet', 'Viskit', undefined]) {
      expect(isWineCategory(c), String(c)).toBe(false);
    }
  });
});

describe('pickBestHit', () => {
  it('matches on producer even when Vivino uses another language', () => {
    const product = { id: '939003', name: 'Quinta do Crasto Reserva Old Vines Mathusalem 2017', country: 'Portugali' };
    expect(pickBestHit(product, crasto as VivinoHit[])?.name).toBe('Reserva Vinhas Velhas');
  });

  it('matches when Alko omits the appellation', () => {
    const product = { id: '913415', name: 'Château Malmaison 2017', country: 'Ranska' };
    expect(pickBestHit(product, malmaison as VivinoHit[])?.winery?.name).toBe('Château Malmaison');
  });

  it('rejects hits from an unrelated producer', () => {
    const product = { id: '1', name: 'Domaine Inconnu Cuvée Rare 2019', country: 'Ranska' };
    expect(pickBestHit(product, [...crasto, ...chiarlo] as VivinoHit[])).toBeUndefined();
  });

  it("prefers a château's grand vin over its second wine", () => {
    // Vivino names the grand vin after its appellation: "Pauillac (Premier Grand Cru Classé)".
    const product = {
      id: '888199',
      name: 'Château Lafite Rothschild (erittäin rajallinen saatavuus, 1plo/asiakas) 2000',
      country: 'Ranska',
    };
    expect(pickBestHit(product, lafite as VivinoHit[])?.name).toBe('Pauillac (Premier Grand Cru Classé)');
  });

  it('rejects a country mismatch', () => {
    expect(pickBestHit({ id: '1', name: 'Zensa Primitivo Organico', country: 'Italia' }, zensa as VivinoHit[])).toBeDefined();
    expect(pickBestHit({ id: '1', name: 'Zensa Primitivo Organico', country: 'Chile' }, zensa as VivinoHit[])).toBeUndefined();
  });

  it('matches a wine sold without its producer name when Algolia ranks it first', () => {
    // Vivino lists Château Malvat under its producer, Château Villars.
    const product = { id: '436367', name: 'Château Malvat 2018', country: 'Ranska' };
    expect(pickBestHit(product, malvat as VivinoHit[])?.name).toBe('Château Malvat Fronsac');
    // Further down the ranking, a name-only match is not trusted.
    expect(pickBestHit(product, (malvat as VivinoHit[]).slice(1))).toBeUndefined();
  });

  it('does not match on one shared producer word plus a grape', () => {
    // Real Vivino results for this query: "Azul y Garanza Tempranillo", "Sangre de Toro Tempranillo", ...
    const product = { id: '1', name: 'Sangre Azul Tempranillo', country: 'Espanja' };
    expect(pickBestHit(product, sangreazul as VivinoHit[])).toBeUndefined();
  });
});

describe('toResult', () => {
  const hit = (malmaison as VivinoHit[])[0]!;

  it('uses the vintage rating when Vivino has enough ratings for it', () => {
    expect(toResult(hit, 2017)).toMatchObject({ status: 'found', scope: 'vintage', rating: 4, ratingsCount: 47, year: 2017 });
  });

  it('falls back to the all-vintages rating when the vintage has too few ratings', () => {
    const r = toResult(hit, 2022);
    expect(r).toMatchObject({ status: 'found', scope: 'wine', rating: 3.8 });
    expect(r.status === 'found' && r.url).toBe(`https://www.vivino.com/w/${hit.id}?year=2022`);
  });

  it('uses the all-vintages rating for non-vintage wines', () => {
    expect(toResult(hit, undefined)).toMatchObject({ scope: 'wine', rating: 3.8, url: `https://www.vivino.com/w/${hit.id}` });
  });
});

describe('lookupProduct', () => {
  it('queries Vivino and returns the matched rating', async () => {
    let body: any;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ hits: chiarlo }));
    }) as typeof fetch;

    const result = await lookupProduct(
      { id: '901614', name: 'Michele Chiarlo Cipressi Nizza 2022', country: 'Italia' },
      fakeFetch,
    );
    expect(body.query).toBe('michele chiarlo cipressi nizza');
    expect(result).toMatchObject({ status: 'found', wineId: (chiarlo as VivinoHit[])[0]!.id });
  });

  it('returns a search link when nothing matches', async () => {
    const fakeFetch = (async () => new Response(JSON.stringify({ hits: [] }))) as unknown as typeof fetch;
    const result = await lookupProduct({ id: '1', name: 'Nothing Here 2020' }, fakeFetch);
    expect(result).toEqual({ status: 'not-found', searchUrl: 'https://www.vivino.com/search/wines?q=nothing+here' });
  });
});
