import { cleanBlockContent, cleanPropertyValue } from '../../../lib/api';
import type { BlockData, PageData } from '../../../types';

/**
 * Extract a URL from a Logseq property value.
 * Handles markdown link format [text](url) and plain URLs.
 */
export function extractUrl(value: unknown): string | null {
  const raw = cleanPropertyValue(value);
  if (!raw) return null;

  const mdMatch = raw.match(/\[.*?\]\((.*?)\)/);
  if (mdMatch) return mdMatch[1];

  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  return null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Build a neutral person-silhouette avatar as an inline `<svg>` element.
 *
 * Used as the photo fallback when a page's photo URL fails to load (dead,
 * expired, or hotlink-blocked). Inline SVG is NOT subject to the host app's CSP
 * `img-src`, so it always renders — unlike a `data:`-URI image, which v2 blocks.
 */
export function createAvatarSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');

  const head = document.createElementNS(SVG_NS, 'circle');
  head.setAttribute('cx', '12');
  head.setAttribute('cy', '9');
  head.setAttribute('r', '3.5');
  svg.appendChild(head);

  const body = document.createElementNS(SVG_NS, 'path');
  body.setAttribute('d', 'M5.5 20a6.5 6.5 0 0 1 13 0');
  svg.appendChild(body);

  return svg;
}

/**
 * Derive a display label from a URL.
 * e.g. "https://github.com/user/repo" → "user/repo"
 */
export function formatUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/|\/$/g, '');

    if (path) return path;
    return parsed.hostname;
  } catch {
    return url;
  }
}

/**
 * Parse a property value into an array of cleaned strings.
 * Handles both single values and Logseq array properties.
 */
export function cleanAllValues(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const cleaned = cleanPropertyValue(value);
    return cleaned ? [cleaned] : [];
  }
  return value.map(v => cleanPropertyValue(v)).filter(v => v.length > 0);
}

/**
 * Create the standard clickable title element (icon + name).
 */
export function createTitle(pageData: PageData): HTMLElement {
  const { name, properties } = pageData;
  // Same guard + clean the properties-icon observer applies to this property:
  // a falsy raw value (`false`, `0`, missing) means "no icon", and a truthy one
  // may be `[[x]]`-wrapped or array-valued on either edition.
  const icon = properties.icon ? cleanPropertyValue(properties.icon) : '';

  const title = document.createElement('a');
  title.className = 'pretty-popover__title';
  title.textContent = icon ? `${icon} ${name}` : name;
  title.dataset.pageName = name;

  return title;
}

/**
 * Create a description element with line clamping via CSS.
 */
export function createDescription(description: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'pretty-popover__description';
  el.textContent = description;
  return el;
}

/**
 * Create a container of tag pill elements from an array of strings.
 * Returns null if the array is empty.
 */
export function createTagPills(
  values: string[],
  containerClass = 'pretty-popover__properties',
): HTMLElement | null {
  if (values.length === 0) return null;

  const container = document.createElement('div');
  container.className = containerClass;

  for (const value of values) {
    const tag = document.createElement('span');
    tag.className = 'pretty-popover__tag';
    tag.textContent = value;
    container.appendChild(tag);
  }

  return container;
}

/**
 * Create a key-value detail row.
 */
export function createDetailRow(label: string, valueEl: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'pretty-popover__detail-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'pretty-popover__detail-label';
  labelEl.textContent = label;

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

/**
 * Render a property value with smart formatting based on the property name.
 * email → mailto link, phone → tel link, url/repository → external link,
 * rating → star display, everything else → plain text.
 */
export function renderPropertyValue(key: string, value: unknown): HTMLElement {
  const cleaned = cleanAllValues(value).join(', ');

  switch (key) {
    case 'rating':
      return createRatingDisplay(value);

    case 'email': {
      const link = document.createElement('a');
      link.href = `mailto:${cleaned}`;
      link.textContent = cleaned;
      link.className = 'pretty-popover__detail-link';
      return link;
    }

    case 'phone': {
      const link = document.createElement('a');
      link.href = `tel:${cleaned}`;
      link.textContent = cleaned;
      link.className = 'pretty-popover__detail-link';
      return link;
    }

    case 'url':
    case 'repository': {
      const url = extractUrl(value);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = formatUrlLabel(url);
        link.className = 'pretty-popover__detail-link';
        return link;
      }
      const span = document.createElement('span');
      span.className = 'pretty-popover__detail-value';
      span.textContent = cleaned;
      return span;
    }

    default: {
      const span = document.createElement('span');
      span.className = 'pretty-popover__detail-value';
      span.textContent = cleaned;
      return span;
    }
  }
}

/**
 * Create a star rating display. e.g. 3 → "★★★☆☆"
 * Falls back to plain text for non-numeric values.
 */
export function createRatingDisplay(value: unknown): HTMLElement {
  const container = document.createElement('span');
  container.className = 'pretty-popover__rating';

  const num = Number.parseFloat(cleanPropertyValue(value));
  if (Number.isNaN(num)) {
    container.textContent = cleanPropertyValue(value);
    return container;
  }

  const maxStars = 5;
  const clamped = Math.max(0, Math.min(maxStars, num));
  const full = Math.floor(clamped);
  const empty = maxStars - full;

  container.textContent = '\u2605'.repeat(full) + '\u2606'.repeat(empty);
  container.title = `${num} / ${maxStars}`;

  return container;
}

/**
 * Extract a content snippet from page blocks.
 * Cleans each block's content, skips empty/property-only blocks,
 * and truncates to a character limit at a word boundary.
 */
export interface SnippetPart {
  text: string;
  heading: boolean;
}

/**
 * Extract a content snippet from page blocks.
 * Returns structured parts with heading metadata.
 * Skips query blocks and only traverses 2 levels deep.
 */
export function extractSnippet(pageData: PageData, maxLength = 560): SnippetPart[] | null {
  const { blocks } = pageData;
  if (!blocks || blocks.length === 0) return null;

  const parts: SnippetPart[] = [];
  collectBlockText(blocks, parts);

  if (parts.length === 0) return null;

  // Truncate to maxLength total characters
  const result: SnippetPart[] = [];
  let total = 0;

  for (const part of parts) {
    if (total >= maxLength) break;

    if (total + part.text.length <= maxLength) {
      result.push(part);
      total += part.text.length;
    } else {
      const remaining = maxLength - total;
      const truncated = part.text.slice(0, remaining);
      const lastSpace = truncated.lastIndexOf(' ');
      const cutoff = lastSpace > remaining * 0.6 ? lastSpace : remaining;
      result.push({ text: `${truncated.slice(0, cutoff)}\u2026`, heading: part.heading });
      break;
    }
  }

  return result.length > 0 ? result : null;
}

function collectBlockText(blocks: BlockData[], parts: SnippetPart[], depth = 0): void {
  if (depth >= 2) return;
  for (const block of blocks) {
    if (isQueryBlock(block.content)) continue;

    const heading = /^#+\s/.test(block.content);
    const cleaned = cleanBlockContent(block.content);
    if (cleaned) parts.push({ text: cleaned, heading });
    if (block.children) collectBlockText(block.children, parts, depth + 1);
  }
}

function isQueryBlock(content: string): boolean {
  return content.includes('{{query') || content.includes('#+BEGIN_QUERY');
}
