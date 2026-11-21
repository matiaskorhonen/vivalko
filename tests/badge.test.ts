// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createBadge } from '../utils/badge';
import { pageLanguage } from '../utils/i18n';
import type { LookupResult } from '../utils/types';

const found: LookupResult = {
  status: 'found', wineId: 97224, wineName: 'Château Malmaison Moulis-en-Médoc', url: 'https://www.vivino.com/w/97224',
  rating: 3.8, ratingsCount: 4325, scope: 'wine',
};
const notFound: LookupResult = { status: 'not-found', searchUrl: 'https://www.vivino.com/search/wines?q=x' };

function text(lang: string, result: LookupResult): string {
  const badge = createBadge('small', lang);
  badge.render({ kind: 'result', result });
  return badge.host.shadowRoot!.querySelector('a')!.textContent!.replace(/\s+/g, ' ');
}

describe('pageLanguage', () => {
  afterEach(() => document.documentElement.removeAttribute('lang'));

  it('reads the language from the path, not <html lang>', () => {
    // Alko leaves <html lang="fi"> in place after switching language without a reload.
    document.documentElement.lang = 'fi';
    expect(pageLanguage('/sv/produkter/913415/chateau-malmaison-2017')).toBe('sv');
    expect(pageLanguage('/en/products/red-wine')).toBe('en');
    expect(pageLanguage('/fi/tuotteet')).toBe('fi');
    expect(pageLanguage('/')).toBe('fi');
  });
});

describe('badge text follows the Alko language', () => {
  it('uses Finnish by default', () => {
    expect(text('fi', found)).toContain('3,8');
    expect(text('fi', found)).toContain('arviota · kaikki vuosikerrat');
    expect(text('fi', notFound)).toContain('ei löytynyt');
  });

  it('uses Swedish on /sv/ pages', () => {
    expect(text('sv', found)).toContain('3,8');
    expect(text('sv', found)).toContain('betyg · alla årgångar');
    expect(text('sv', notFound)).toContain('hittades inte');
  });

  it('uses English on /en/ pages', () => {
    expect(text('en', found)).toContain('3.8');
    expect(text('en', found)).toContain('4,325 ratings · all vintages');
    expect(text('en', notFound)).toContain('not found');
  });
});
