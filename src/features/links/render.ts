import { getParentDoc } from '../../lib/dom';
import { createFaviconImg } from './favicons';
import type { LinkMetadata } from './types';

const POPOVER_FAVICON_STYLE = 'width:14px;height:14px;flex-shrink:0;margin:0;padding:0;border:none';

function createFavicon(src: string): HTMLImageElement {
  return createFaviconImg({
    src,
    size: 14,
    className: 'pretty-link-popover__favicon',
    style: POPOVER_FAVICON_STYLE,
  });
}

/**
 * Critical container styles applied inline.
 *
 * The rest of the popover is styled via `provideStyle()` CSS, but that CSS
 * doesn't reliably reach `top.document` elements (see styles.scss), so these
 * base styles are inlined to guarantee the popover is visible and positioned.
 */
export function applyPopoverBaseStyles(popover: HTMLElement): void {
  popover.style.cssText = [
    'position:fixed',
    'z-index:9999',
    'max-width:380px',
    'min-width:280px',
    'overflow:hidden',
    'border-radius:6px',
    'pointer-events:auto',
    'background:var(--ls-primary-background-color,#fff)',
    'border:1px solid var(--pl-accent-border,var(--ls-border-color,rgba(0,0,0,0.1)))',
    'border-left:3px solid var(--pl-accent,#8b5cf6)',
    'box-shadow:0 4px 6px -1px rgba(0,0,0,0.08),0 10px 15px -3px rgba(0,0,0,0.1)',
  ].join(';');
}

export function renderLinkPopover(metadata: LinkMetadata): HTMLElement {
  const doc = getParentDoc();
  const content = doc.createElement('div');
  content.className = 'pretty-link-popover__content';

  if (metadata.image) {
    const imgWrapper = doc.createElement('div');
    imgWrapper.className = 'pretty-link-popover__image';
    const img = doc.createElement('img');
    img.src = metadata.image;
    img.alt = metadata.title ?? '';
    img.loading = 'lazy';
    img.onerror = () => imgWrapper.remove();
    imgWrapper.appendChild(img);
    content.appendChild(imgWrapper);
  }

  // Header: favicon + title/site name
  const header = doc.createElement('div');
  header.className = 'pretty-link-popover__header';
  header.appendChild(createFavicon(metadata.faviconUrl));

  const titleText = metadata.title ?? metadata.siteName ?? metadata.domain;
  const title = doc.createElement('span');
  title.className = 'pretty-link-popover__title';
  title.textContent = titleText;
  header.appendChild(title);
  content.appendChild(header);

  if (metadata.error) {
    const error = doc.createElement('div');
    error.className = 'pretty-link-popover__error';
    error.textContent = metadata.error;
    content.appendChild(error);
  } else if (metadata.description) {
    const desc = doc.createElement('div');
    desc.className = 'pretty-link-popover__description';
    desc.textContent = metadata.description;
    content.appendChild(desc);
  }

  // Footer: full-width URL
  const footer = doc.createElement('div');
  footer.className = 'pretty-link-popover__footer';
  footer.textContent = metadata.url;
  content.appendChild(footer);

  return content;
}
