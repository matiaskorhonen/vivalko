import { el, stars, STARS_CSS } from './dom';
import { formatCount, formatRating, labels, pageLanguage } from './i18n';
import type { FoundResult, LookupResult } from './types';

export type BadgeState =
  | { kind: 'loading' }
  | { kind: 'result'; result: LookupResult }
  | { kind: 'error'; message: string };

/** Called when a rating badge is clicked without modifier keys. */
export type OpenDetails = (anchor: HTMLAnchorElement, result: FoundResult) => void;

const STYLE = `
:host { all: initial; display: block; position: relative; z-index: 11; }
${STARS_CSS}
a, span.box {
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 13px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: #1d1d1b; text-decoration: none;
  padding: 3px 8px 3px 6px; border-radius: 999px;
  background: #f6eef0; border: 1px solid #e6d3d8;
}
a:hover, a[aria-expanded="true"] { background: #f0e1e5; border-color: #c9a2ad; }
a:focus-visible { outline: 2px solid #8c1c34; outline-offset: 2px; }
.logo {
  font-weight: 700; font-size: 10px; letter-spacing: .06em; text-transform: uppercase;
  color: #8c1c34;
}
.score { font-weight: 700; font-variant-numeric: tabular-nums; }
.muted { color: #6b6b6b; font-weight: 400; }
:host([data-size="large"]) a, :host([data-size="large"]) span.box { font-size: 15px; padding: 5px 12px 5px 9px; }
:host([data-size="large"]) .score { font-size: 18px; }
.loading .muted::after { content: "…"; }
`;

export function createBadge(
  size: 'small' | 'large' = 'small',
  lang: string = pageLanguage(),
  openDetails?: OpenDetails,
): {
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
        parts.push(stars(r.rating), el('span', { className: 'score', text: formatRating(r.rating, lang) }));
        const detail = `${formatCount(r.ratingsCount, lang)} ${t.ratings}${r.scope === 'wine' ? ` · ${t.allVintages}` : ''}`;
        parts.push(el('span', { className: 'muted', text: detail }));
      }
      const a = el('a', {}, ...parts);
      a.href = r.url;
      a.title = `Vivino: ${r.wineName}`;
      if (openDetails) {
        a.setAttribute('aria-haspopup', 'dialog');
        a.setAttribute('aria-expanded', 'false');
        a.addEventListener('click', (e) => {
          // Modified clicks (new tab, new window) still follow the link to Vivino.
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          openDetails(a, r);
        });
      }
      content = a;
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
