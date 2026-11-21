import { el, stars, STARS_CSS } from './dom';
import { countryName, formatCount, formatRating, labels, typeName } from './i18n';
import type { FoundResult } from './types';

export interface PopoverDeps {
  /** Resolves a Vivino image URL to something the page may load (a data: URL). */
  loadImage: (url: string) => Promise<string>;
  /** Resolves Vivino grape ids to names. */
  loadGrapes: (ids: number[]) => Promise<string[]>;
}

const STYLE = `
:host { all: initial; }
${STARS_CSS}
.panel {
  /* Reset the UA popover styles; position is set from script next to the badge. */
  position: fixed; inset: auto; margin: 0; padding: 20px 22px 20px 18px; border: 0;
  width: min(440px, calc(100vw - 24px)); box-sizing: border-box;
  max-height: calc(100vh - 24px); overflow: auto;
  background: #f7f3ef; color: #1d1d1b; border-radius: 14px;
  box-shadow: 0 18px 48px rgba(30, 10, 15, .22), 0 2px 6px rgba(30, 10, 15, .12);
  font: 400 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
  display: grid; grid-template-columns: 96px 1fr; gap: 18px; align-items: start;
}
.panel:not(:popover-open) { display: none; }
.panel.no-image { grid-template-columns: 1fr; }
.bottle {
  height: 216px; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; background: radial-gradient(ellipse at 50% 85%, #ece4dd 0 45%, transparent 70%);
}
.bottle img { max-width: 96px; max-height: 216px; object-fit: contain; opacity: 0; transition: opacity .2s; }
.bottle img.loaded { opacity: 1; }
.no-image .bottle { display: none; }
.info { min-width: 0; padding-right: 18px; }
.winery { margin: 0; font-size: 16px; font-weight: 600; }
.wine { margin: 2px 0 10px; font-size: 22px; line-height: 1.2; font-weight: 700; overflow-wrap: anywhere; }
.facts { margin: 0 0 14px; color: #4a4a48; }
.facts span + span::before { content: " · "; color: #9a9a97; }
.rating { display: flex; align-items: center; gap: 10px; }
.score { font-size: 40px; line-height: 1; font-weight: 300; font-variant-numeric: tabular-nums; }
.rating .stars { font-size: 18px; }
.count { display: block; color: #4a4a48; }
.scope { margin: 6px 0 0; color: #6b6b68; font-size: 12px; }
.too-few { margin: 0; color: #6b6b68; }
.grapes { margin: 12px 0 0; color: #4a4a48; }
.grapes strong { color: #1d1d1b; font-weight: 600; }
.cta {
  display: inline-block; margin-top: 16px; padding: 8px 16px; border-radius: 999px;
  background: #8c1c34; color: #fff; text-decoration: none; font-weight: 600;
}
.cta:hover { background: #a3223f; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 16px; }
.actions .cta { margin-top: 0; }
.search { color: #6b6b68; font-size: 13px; text-decoration: underline; text-underline-offset: 2px; }
.search:hover { color: #8c1c34; }
.close {
  position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; border: 0; border-radius: 50%;
  background: transparent; color: #6b6b68; font-size: 22px; line-height: 1; cursor: pointer;
}
.close:hover { background: #ece4dd; color: #1d1d1b; }
.cta:focus-visible, .search:focus-visible, .close:focus-visible { outline: 2px solid #8c1c34; outline-offset: 2px; }
`;

export function supportsPopover(): boolean {
  return typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;
}

/** Positions the panel below the anchor, or above it when there's no room below. */
export function placeNear(
  anchor: DOMRect,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 8,
): { top: number; left: number } {
  const margin = 12;
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - panel.width - margin));
  let top = anchor.bottom + gap;
  if (top + panel.height > viewport.height - margin && anchor.top - gap - panel.height >= margin) {
    top = anchor.top - gap - panel.height;
  }
  return { top, left };
}

/**
 * One popover per page, re-filled for whichever badge was clicked. It shows
 * the wine the way Vivino's own page header does: bottle, producer, name,
 * where it's from, and the rating.
 */
export function createPopover(deps: PopoverDeps) {
  const host = document.createElement('div');
  host.dataset.vivalko = 'popover';
  const root = host.attachShadow({ mode: 'open' });
  const panel = el('div', { className: 'panel' });
  panel.setAttribute('popover', 'auto');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'vivalko-title');
  root.append(el('style', { text: STYLE }), panel);

  let anchor: HTMLElement | undefined;
  /** The badge pressed while its popover was open: that click should only close it. */
  let pressedWhileOpen: HTMLElement | undefined;
  // Light dismiss closes the popover during pointerdown, before the badge's click
  // handler runs, so record the state at the start of the press.
  document.addEventListener(
    'pointerdown',
    (event) => {
      const open = anchor && panel.matches(':popover-open');
      pressedWhileOpen = open && event.composedPath().includes(anchor!) ? anchor : undefined;
    },
    true,
  );

  function reposition() {
    if (!anchor) return;
    if (!anchor.isConnected) {
      // The page navigated and the badge is gone.
      close();
      return;
    }
    const { top, left } = placeNear(
      anchor.getBoundingClientRect(),
      { width: panel.offsetWidth, height: panel.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }

  panel.addEventListener('toggle', (event) => {
    if ((event as ToggleEvent).newState !== 'closed') return;
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
    anchor?.setAttribute('aria-expanded', 'false');
    // Return focus to the badge if it was inside the popover.
    if (root.activeElement || document.activeElement === document.body) anchor?.focus();
    anchor = undefined;
  });

  function close() {
    if (panel.matches(':popover-open')) panel.hidePopover();
  }

  function render(result: FoundResult, lang: string) {
    const t = labels(lang);
    const d = result.details;

    const img = el('img');
    img.alt = '';
    const bottle = el('div', { className: 'bottle' }, img);
    panel.classList.toggle('no-image', !d?.imageUrl);
    if (d?.imageUrl) {
      deps.loadImage(d.imageUrl).then(
        (src) => {
          img.src = src;
          img.classList.add('loaded');
        },
        () => panel.classList.add('no-image'),
      );
    }

    const title = el('h2', { className: 'wine', text: d?.wine ?? result.wineName });
    title.id = 'vivalko-title';
    if (result.year) title.append(` ${result.year}`);

    const facts = el(
      'p',
      { className: 'facts' },
      ...[countryName(d?.countryCode, lang), d?.region, typeName(d?.typeId, lang)]
        .filter((f): f is string => !!f)
        .map((f) => el('span', { text: f })),
    );

    let rating: HTMLElement;
    if (result.rating === null) {
      rating = el('p', { className: 'too-few', text: `${t.tooFew} (${formatCount(result.ratingsCount, lang)})` });
    } else {
      rating = el(
        'div',
        {},
        el(
          'div',
          { className: 'rating' },
          el('span', { className: 'score', text: formatRating(result.rating, lang) }),
          el('div', {}, stars(result.rating), el('span', { className: 'count', text: `${formatCount(result.ratingsCount, lang)} ${t.ratings}` })),
        ),
        el('p', {
          className: 'scope',
          text: result.scope === 'vintage' ? `${t.ratingForVintage} ${result.year}` : t.ratingForAllVintages,
        }),
      );
    }

    const grapes = el('p', { className: 'grapes' });
    grapes.hidden = true;
    if (d?.grapeIds?.length) {
      deps.loadGrapes(d.grapeIds).then(
        (names) => {
          if (names.length === 0) return;
          // Like Vivino: one grape is named in the facts line, several are a "Blend".
          facts.append(el('span', { text: names.length === 1 ? names[0] : t.blend }));
          if (names.length > 1) {
            grapes.replaceChildren(el('strong', { text: `${t.grapes}: ` }), names.join(', '));
            grapes.hidden = false;
          }
          reposition();
        },
        () => {},
      );
    }

    const cta = el('a', { className: 'cta', text: `${t.openOnVivino} ↗` });
    cta.href = result.url;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';

    let search: HTMLAnchorElement | null = null;
    if (result.searchUrl) {
      search = el('a', { className: 'search', text: `${t.wrongWine} ↗` });
      search.href = result.searchUrl;
      search.target = '_blank';
      search.rel = 'noopener noreferrer';
    }

    const closeButton = el('button', { className: 'close', text: '×' });
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', t.close);
    closeButton.addEventListener('click', close);

    panel.replaceChildren(
      closeButton,
      bottle,
      el(
        'div',
        { className: 'info' },
        d?.winery ? el('p', { className: 'winery', text: d.winery }) : null,
        title,
        facts,
        rating,
        grapes,
        el('div', { className: 'actions' }, cta, search),
      ),
    );
  }

  function open(target: HTMLElement, result: FoundResult, lang: string) {
    // Clicking the badge of an open popover closes it (light dismiss) and then
    // delivers the click; don't immediately reopen it.
    if (pressedWhileOpen === target) {
      pressedWhileOpen = undefined;
      close();
      return;
    }
    if (!host.isConnected) document.body.append(host);
    close();

    render(result, lang);
    anchor = target;
    anchor.setAttribute('aria-expanded', 'true');
    panel.showPopover();
    reposition();
    window.addEventListener('scroll', reposition, { capture: true, passive: true });
    window.addEventListener('resize', reposition, { passive: true });
    panel.querySelector<HTMLElement>('.cta')?.focus({ preventScroll: true });
  }

  return { host, open, close };
}
