import type { AlkoProduct } from './types';

/** Direct text of an element, split at child elements (Alko separates fields with empty spans). */
function textParts(el: Element | null | undefined): string[] {
  if (!el) return [];
  return [...el.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent?.trim() ?? '')
    .filter(Boolean);
}

/** Reads a product from a listing/search card (`article#product-<id>`). */
export function readCard(card: Element): AlkoProduct | undefined {
  const id = card.id.match(/^product-(\d+)$/)?.[1];
  if (!id) return undefined;
  const heading = card.querySelector(`#card-heading-${id}`);
  const name = heading?.textContent?.trim();
  if (!heading || !name) return undefined;

  // Sibling of the heading holding "Punaviinit | Portugali".
  const meta = [...(heading.parentElement?.children ?? [])].find((el) => el !== heading);
  const [category, country] = textParts(meta);
  return { id, name, category, country };
}

interface JsonLdProduct {
  '@type'?: string;
  name?: string;
  sku?: string;
  category?: string;
}

/** Products live under a localized path: /fi/tuotteet, /sv/produkter, /en/products. */
const PRODUCTS_PATH = '(?:tuotteet|produkter|products)';
const PRODUCT_PAGE_RE = new RegExp(`/${PRODUCTS_PATH}/(\\d+)(?:/|$)`);
const CATEGORY_COUNTRY_RE = new RegExp(`^/[a-z]{2}/${PRODUCTS_PATH}/([^/]+)/([^/]+)/?$`);

/**
 * Reads the product shown on a product page (`/fi/tuotteet/<id>/<slug>`).
 * Returns the product together with the visible headings to decorate.
 */
export function readProductPage(
  doc: Document,
  path: string,
): { product: AlkoProduct; headings: HTMLHeadingElement[] } | undefined {
  const id = path.match(PRODUCT_PAGE_RE)?.[1];
  if (!id) return undefined;

  let ld: JsonLdProduct | undefined;
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(script.textContent ?? '') as JsonLdProduct;
      if (data['@type'] === 'Product' && data.sku === id) ld = data;
    } catch {
      // Ignore unrelated or malformed structured data.
    }
  }
  // After client-side navigation the old page's data can linger, so require a matching SKU.
  if (!ld?.name) return undefined;
  const name = ld.name.trim();

  // Alko renders the product header more than once for different layouts.
  // Waiting until a heading shows this product also means the rest of the page
  // (like the breadcrumb) has caught up after client-side navigation.
  const headings = [...doc.querySelectorAll('h1')].filter((h) => h.textContent?.trim() === name);
  if (headings.length === 0) return undefined;

  // The breadcrumb ends in a "/<products>/<category>/<country>" link.
  let country: string | undefined;
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('nav a[href]')) {
    const m = a.getAttribute('href')?.match(CATEGORY_COUNTRY_RE);
    if (m && ld.category && m[1] === ld.category.toLowerCase()) country = a.textContent?.trim();
  }

  return { product: { id, name, category: ld.category, country }, headings };
}
