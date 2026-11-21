import type { LookupResult } from './types';

export type BadgeState =
  | { kind: 'loading' }
  | { kind: 'result'; result: LookupResult }
  | { kind: 'error'; message: string };

const STYLE = `
:host { all: initial; display: block; position: relative; z-index: 11; }
a, span.box {
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #1d1d1b; text-decoration: none;
  padding: 3px 8px 3px 6px; border-radius: 999px;
  background: #f6eef0; border: 1px solid #e6d3d8;
}
a:hover { background: #f0e1e5; border-color: #c9a2ad; }
a:focus-visible { outline: 2px solid #8c1c34; outline-offset: 2px; }
.logo {
  font-weight: 700; font-size: 10px; letter-spacing: .06em; text-transform: uppercase;
  color: #8c1c34;
}
.stars { position: relative; display: inline-block; color: #d9c6cb; letter-spacing: 1px; }
.stars .fill {
  position: absolute; inset: 0 auto 0 0; overflow: hidden; white-space: nowrap; color: #b5203f;
}
.score { font-weight: 700; font-variant-numeric: tabular-nums; }
.muted { color: #6b6b6b; font-weight: 400; }
:host([data-size="large"]) a, :host([data-size="large"]) span.box { font-size: 15px; padding: 5px 12px 5px 9px; }
:host([data-size="large"]) .score { font-size: 18px; }
.loading .muted::after { content: "…"; }
`;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string } = {},
  ...children: Node[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text) node.textContent = props.text;
  node.append(...children);
  return node;
}

function stars(rating: number): HTMLElement {
  const fill = el('span', { className: 'fill', text: '★★★★★' });
  fill.style.width = `${Math.max(0, Math.min(100, (rating / 5) * 100))}%`;
  const wrap = el('span', { className: 'stars', text: '★★★★★' }, fill);
  wrap.setAttribute('aria-hidden', 'true');
  return wrap;
}

function formatCount(n: number, lang: string): string {
  return new Intl.NumberFormat(lang, { notation: n >= 10000 ? 'compact' : 'standard' }).format(n);
}

/**
 * The language Alko is showing: the first segment of the path (/fi/, /sv/, /en/).
 * `<html lang>` is not reliable, because it keeps its old value when the
 * language is switched without a page reload.
 */
export function pageLanguage(path: string = location.pathname): string {
  return path.match(/^\/(fi|sv|en)(?:\/|$)/)?.[1] ?? (document.documentElement.lang || 'fi');
}

/** Labels in the Alko page language (fi is the default, sv and en are also served). */
function labels(lang: string) {
  if (lang.startsWith('sv')) {
    return { ratings: 'betyg', allVintages: 'alla årgångar', notFound: 'hittades inte', tooFew: 'för få betyg', error: 'inte tillgänglig', loading: 'söker' };
  }
  if (lang.startsWith('en')) {
    return { ratings: 'ratings', allVintages: 'all vintages', notFound: 'not found', tooFew: 'too few ratings', error: 'unavailable', loading: 'searching' };
  }
  return { ratings: 'arviota', allVintages: 'kaikki vuosikerrat', notFound: 'ei löytynyt', tooFew: 'liian vähän arvioita', error: 'ei saatavilla', loading: 'haetaan' };
}

export function createBadge(size: 'small' | 'large' = 'small', lang: string = pageLanguage()): {
  host: HTMLElement;
  render: (state: BadgeState) => void;
} {
  const host = document.createElement('span');
  host.dataset.vivalko = 'badge';
  host.dataset.size = size;
  const root = host.attachShadow({ mode: 'open' });
  const style = el('style', { text: STYLE });
  const t = labels(lang);

  function render(state: BadgeState) {
    const logo = el('span', { className: 'logo', text: 'Vivino' });
    let content: HTMLElement;

    if (state.kind === 'loading') {
      content = el('span', { className: 'box loading' }, logo, el('span', { className: 'muted', text: t.loading }));
    } else if (state.kind === 'error') {
      content = el('span', { className: 'box' }, logo, el('span', { className: 'muted', text: t.error }));
      content.title = state.message;
    } else if (state.result.status === 'not-found') {
      content = el('a', {}, logo, el('span', { className: 'muted', text: t.notFound }));
      (content as HTMLAnchorElement).href = state.result.searchUrl;
    } else {
      const r = state.result;
      const parts: Node[] = [logo];
      if (r.rating === null) {
        parts.push(el('span', { className: 'muted', text: t.tooFew }));
      } else {
        const score = r.rating.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        parts.push(stars(r.rating), el('span', { className: 'score', text: score }));
        const detail = `${formatCount(r.ratingsCount, lang)} ${t.ratings}${r.scope === 'wine' ? ` · ${t.allVintages}` : ''}`;
        parts.push(el('span', { className: 'muted', text: detail }));
      }
      content = el('a', {}, ...parts);
      const a = content as HTMLAnchorElement;
      a.href = r.url;
      a.title = `Vivino: ${r.wineName}`;
    }

    if (content instanceof HTMLAnchorElement) {
      content.target = '_blank';
      content.rel = 'noopener noreferrer';
      // Keep Alko's card click handlers from also navigating to the product.
      content.addEventListener('click', (e) => e.stopPropagation());
    }
    root.replaceChildren(style, content);
  }

  render({ kind: 'loading' });
  return { host, render };
}
