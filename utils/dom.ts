export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string } = {},
  ...children: (Node | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) node.className = props.className;
  if (props.text) node.textContent = props.text;
  node.append(...children.filter((c): c is Node => !!c));
  return node;
}

/** Five stars, filled in proportion to the rating. Decorative: the number is shown next to it. */
export function stars(rating: number): HTMLElement {
  const fill = el('span', { className: 'fill', text: '★★★★★' });
  fill.style.width = `${Math.max(0, Math.min(100, (rating / 5) * 100))}%`;
  const wrap = el('span', { className: 'stars', text: '★★★★★' }, fill);
  wrap.setAttribute('aria-hidden', 'true');
  return wrap;
}

export const STARS_CSS = `
.stars { position: relative; display: inline-block; color: #d9c6cb; letter-spacing: 1px; white-space: nowrap; }
.stars .fill { position: absolute; inset: 0 auto 0 0; overflow: hidden; white-space: nowrap; color: #b5203f; }
`;
