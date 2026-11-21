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

/** Reads the product shown on a product page (`/<locale>/tuotteet/<id>/<slug>`). */
export function readProductPage(doc: Document, path: string): AlkoProduct | undefined {
  const id = path.match(/\/tuotteet\/(\d+)(?:\/|$)/)?.[1];
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

  // The title is "<name> - <country> - <category> | Alko".
  const titleParts = doc.title.replace(/\s*\|\s*Alko\s*$/, '').split(' - ');
  const country = titleParts.length >= 3 ? titleParts[titleParts.length - 2] : undefined;
  return { id, name: ld.name, category: ld.category, country };
}
