import { describe, expect, it } from 'vitest';
import { wineType } from '../utils/normalize';
import { lookupProduct, pickBestHit, producerQuery, type VivinoHit } from '../utils/vivino';

// Small synthetic Vivino hits, shaped like real search results.
function hit(id: number, winery: string, name: string, extra: Partial<VivinoHit> = {}): VivinoHit {
  return {
    id,
    name,
    winery: { name: winery },
    region: { country: 'fr', name: 'Somewhere' },
    statistics: { status: 'Normal', ratings_count: 100, ratings_average: 4 },
    vintages: [],
    ...extra,
  };
}

describe('wineType', () => {
  it('maps Alko categories in all site languages', () => {
    expect(wineType('Punaviinit')).toBe(1);
    expect(wineType('valkoviinit')).toBe(2);
    expect(wineType('Kuohuviinit & Samppanjat')).toBe(3);
    expect(wineType('Roseeviinit')).toBe(4);
    expect(wineType('Rödviner')).toBe(1);
    expect(wineType('White wines')).toBe(2);
    expect(wineType('Jälkiruokaviinit')).toBeUndefined();
  });
});

describe('type, colour and grape checks', () => {
  it("rejects a white when Alko sells a red", () => {
    const product = { id: '1', name: 'Chateau de Jau JauJau 1er 2022', country: 'Ranska', category: 'punaviinit' };
    const hits = [hit(1, 'Château de Jau', 'JauJau 1er Blanc', { type_id: 2 })];
    expect(pickBestHit(product, hits)).toBeUndefined();
    expect(pickBestHit({ ...product, category: undefined }, hits)).toBeDefined();
  });

  it('picks the red when the producer makes a red and a white of the same name', () => {
    const product = { id: '1', name: 'The Green Road 2023', country: 'Chile', category: 'punaviinit', producer: 'Miguel Torres Chile' };
    const hits = [
      hit(1, 'Miguel Torres Chile', 'The Green Road Sauvignon Blanc', { type_id: 2, region: { country: 'cl' } }),
      hit(2, 'Miguel Torres Chile', 'The Green Road Cabernet Sauvignon', { type_id: 1, region: { country: 'cl' } }),
    ];
    expect(pickBestHit(product, hits)?.id).toBe(2);
  });

  it('accepts dessert wines and lightly sparkling styles filed as still', () => {
    const passito = { id: '1', name: 'Tenuta Fornace TuttoSole 2021', category: 'valkoviinit' };
    expect(pickBestHit(passito, [hit(1, 'Tenuta Fornace', 'Tutto Sole Moscato Passito', { type_id: 7 })])).toBeDefined();
    const asti = { id: '2', name: "Carlin De Paolo Moscato D'Asti 2024", category: 'valkoviinit' };
    expect(pickBestHit(asti, [hit(2, 'Carlin de Paolo', "Moscato d'Asti", { type_id: 3 })])).toBeDefined();
  });

  it("does not match a rosé to the producer's other wines", () => {
    const product = { id: '1', name: 'Charles Heidsieck Rosé Réserve Champagne Brut', category: 'kuohuviinit' };
    const hits = [
      hit(1, 'Charles Heidsieck', 'Brut Réserve', { type_id: 3 }),
      hit(2, 'Charles Heidsieck', 'Rosé Réserve', { type_id: 3 }),
    ];
    expect(pickBestHit(product, hits)?.id).toBe(2);
    expect(pickBestHit(product, [hits[0]!])).toBeUndefined();
  });

  it('prefers a hit that has ratings for the vintage Alko sells', () => {
    const product = { id: '1', name: 'Palmer & Co Collection Vintage Champagne Brut 1999', category: 'kuohuviinit' };
    const rated1999 = [{ id: 9, year: '1999', name: 'x 1999', statistics: { ratings_count: 91, ratings_average: 4.2 } }];
    const hits = [
      hit(1, 'Palmer & Co.', 'Brut Réserve Champagne', { type_id: 3 }),
      hit(2, 'Nicolas Feuillatte', 'Collection Vintage Brut Millésimé Champagne', { type_id: 3 }),
      hit(3, 'Palmer & Co.', 'Vintage Champagne', { type_id: 3, vintages: rated1999 }),
    ];
    expect(pickBestHit(product, hits)?.id).toBe(3);
  });
});

describe('catalog producer', () => {
  it("matches a wine named without its producer, below Algolia's top hit", () => {
    const product = { id: '1', name: 'Tanca Farrá 2017', country: 'Italia', producer: 'Sella & Mosca' };
    const hits = [
      hit(1, 'Farina', 'Tanca Rosso', { region: { country: 'it' } }),
      hit(2, 'Sella & Mosca', 'Tanca Farra Alghero', { region: { country: 'it', name: 'Alghero' } }),
    ];
    expect(pickBestHit(product, hits)?.id).toBe(2);
    expect(pickBestHit({ ...product, producer: undefined }, hits)).toBeUndefined();
  });

  it("needs every distinctive word and grape, since the producer may be a big group", () => {
    const frontera = { id: '1', name: 'Frontera Cabernet Sauvignon 2024', country: 'Chile', producer: 'Concha y Toro' };
    expect(pickBestHit(frontera, [hit(1, 'Concha y Toro', 'Casillero del Diablo Cabernet Sauvignon', { region: { country: 'cl' } })])).toBeUndefined();
    const lobetia = { id: '2', name: 'Lobetia Tempranillo Shiraz 2024', producer: 'Dominio de Punctum' };
    expect(pickBestHit(lobetia, [hit(2, 'Dominio de Punctum', 'Lobetia Tempranillo')])).toBeUndefined();
  });

  it('builds a producer query only when the producer adds new words', () => {
    expect(producerQuery('Sella & Mosca', 'tanca farra')).toBe('sella mosca tanca farra');
    expect(producerQuery('Domaine Billaud-Simon', 'domaine billaud simon chablis')).toBeUndefined();
    expect(producerQuery(undefined, 'x')).toBeUndefined();
  });

  it('searches again with the producer when the name only gives a weak match', async () => {
    const queries: string[] = [];
    const results: Record<string, VivinoHit[]> = {
      'special club premier cru brut': [hit(1, 'Marc Hébrart', 'Spécial Club Brut Champagne Premier Cru', { type_id: 3 })],
      'champagne gaston chiquet special club premier cru brut': [
        hit(2, 'Gaston Chiquet', 'Spécial Club Extra Brut Champagne Premier Cru', { type_id: 3 }),
      ],
    };
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      const { query } = JSON.parse(init.body as string);
      queries.push(query);
      return new Response(JSON.stringify({ hits: results[query] ?? [] }));
    }) as typeof fetch;

    const product = { id: '1', name: 'Special Club Premier Cru 2016 Brut 2016', category: 'kuohuviinit', producer: ' Champagne Gaston Chiquet' };
    const result = await lookupProduct(product, fakeFetch);
    expect(queries).toHaveLength(2);
    expect(result).toMatchObject({ status: 'found', wineId: 2 });
  });
});
