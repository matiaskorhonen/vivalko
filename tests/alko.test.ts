// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { readCard, readProductPage } from '../utils/alko';

// Trimmed from alko.fi markup (November 2026).
const CARD = `
<article aria-label="Tuote: Quinta do Crasto Reserva Old Vines Mathusalem 2017" id="product-939003">
  <a class="absolute inset-0 z-10" href="/fi/tuotteet/939003/quinta-do-crasto-reserva-old-vines-mathusalem-2017"></a>
  <div class="relative flex px-3 gap-4"><div class="order-2 flex w-full flex-col">
    <div class="flex flex-col">
      <div aria-level="3" role="heading" id="card-heading-939003">Quinta do Crasto Reserva Old Vines Mathusalem 2017</div>
      <div class="order-first flex gap-1">Punaviinit<span class="border"></span>Portugali</div>
    </div>
    <span class="sr-only">Hinta 408,00 €</span>
  </div></div>
</article>`;

const PRODUCT_PAGE = `
<nav aria-label="Murupolku">
  <a href="/fi/tuotteet">Tuotteet</a>
  <a href="/fi/tuotteet/punaviinit">Punaviinit</a>
  <a href="/fi/tuotteet/punaviinit/ranska">Ranska</a>
</nav>
<div class="flex flex-col mobile"><h1 class="order-3">Chateau Malmaison 2017</h1><a href="/fi/tuotteet/punaviinit">Punaviinit</a></div>
<div class="flex flex-col desktop"><h1 class="order-3">Chateau Malmaison 2017</h1><a href="/fi/tuotteet/punaviinit">Punaviinit</a></div>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Chateau Malmaison 2017","brand":{"@type":"Brand","name":"Chateau Malmaison"},"sku":"913415","category":"punaviinit"}</script>`;

describe('readCard', () => {
  it('reads id, name, category and country', () => {
    document.body.innerHTML = CARD;
    expect(readCard(document.querySelector('article')!)).toEqual({
      id: '939003',
      name: 'Quinta do Crasto Reserva Old Vines Mathusalem 2017',
      category: 'Punaviinit',
      country: 'Portugali',
    });
  });
});

describe('readProductPage', () => {
  beforeEach(() => {
    document.body.innerHTML = PRODUCT_PAGE;
  });

  it('reads the product from structured data and the breadcrumb', () => {
    const page = readProductPage(document, '/fi/tuotteet/913415/chateau-malmaison-2017');
    expect(page?.product).toEqual({ id: '913415', name: 'Chateau Malmaison 2017', category: 'punaviinit', country: 'Ranska' });
    expect(page?.headings).toHaveLength(2);
  });

  it('understands the Swedish and English product paths', () => {
    expect(readProductPage(document, '/sv/produkter/913415/chateau-malmaison-2017')?.product.id).toBe('913415');
    expect(readProductPage(document, '/en/products/913415/chateau-malmaison-2017')?.product.id).toBe('913415');
  });

  it('waits while the page still shows the previous product', () => {
    // Client-side navigation: URL has changed but the old page is still rendered.
    expect(readProductPage(document, '/fi/tuotteet/901614/michele-chiarlo-cipressi-nizza-2022')).toBeUndefined();
    document.querySelectorAll('h1').forEach((h) => (h.textContent = 'Something else'));
    expect(readProductPage(document, '/fi/tuotteet/913415/chateau-malmaison-2017')).toBeUndefined();
  });

  it('ignores pages that are not product pages', () => {
    expect(readProductPage(document, '/fi/tuotteet/punaviinit')).toBeUndefined();
  });
});
