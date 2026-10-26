import { cleanPropertyValue } from '../../../lib/api';
import type { PageData } from '../../../types';
import {
  cleanAllValues,
  createAvatarSvg,
  createDescription,
  createDetailRow,
  createTagPills,
  createTitle,
  extractSnippet,
  extractUrl,
  formatUrlLabel,
  renderPropertyValue,
} from './helpers';
import { type PopoverConfig, resolveConfig } from './type-config';

export function renderPopover(pageData: PageData): HTMLElement {
  const config = resolveConfig(pageData);
  const content = document.createElement('div');
  content.className = 'pretty-popover__content';

  // 1. Header (photo card or simple title + subtitle)
  const { header, descriptionInHeader } = buildHeader(pageData, config);
  content.appendChild(header);

  // 2. Aliases (subtle "aka" line)
  const aliases = buildAliases(pageData);
  if (aliases) content.appendChild(aliases);

  // 3. Description (only if not already placed inside the photo card header)
  if (!descriptionInHeader && pageData.properties.description) {
    content.appendChild(createDescription(cleanPropertyValue(pageData.properties.description)));
  }

  // 4. Content snippet (for pages without rich properties)
  if (config.showSnippet) {
    const parts = extractSnippet(pageData);
    if (parts) {
      const el = document.createElement('div');
      el.className = 'pretty-popover__snippet';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.heading) {
          const strong = document.createElement('strong');
          strong.textContent = part.text;
          el.appendChild(strong);
        } else {
          el.appendChild(document.createTextNode(part.text));
        }
        if (i < parts.length - 1) el.appendChild(document.createTextNode('\n'));
      }

      content.appendChild(el);
    }
  }

  // 5. Detail rows (key-value pairs)
  const details = buildDetails(pageData, config);
  if (details) content.appendChild(details);

  // 6. Array properties (pill groups like stack)
  for (const prop of config.arrayProperties) {
    const items = cleanAllValues(pageData.properties[prop]);

    if (items.length > 0) {
      const group = createTagPills(items, 'pretty-popover__array-tags');
      if (group) content.appendChild(group);
    }
  }

  // 7. Link section (url property as prominent link)
  const linkSection = buildLinkSection(pageData);
  if (linkSection) content.appendChild(linkSection);

  // 8. Tags (type, status, area + extras)
  const tags = buildTags(pageData, config);
  if (tags) content.appendChild(tags);

  return content;
}

function buildHeader(
  pageData: PageData,
  config: PopoverConfig,
): { header: HTMLElement; descriptionInHeader: boolean } {
  const photoUrl = config.photoProperty
    ? extractUrl(pageData.properties[config.photoProperty])
    : null;

  if (photoUrl) {
    const card = document.createElement('div');
    card.className = 'pretty-popover__photo-card';

    const photoWrapper = document.createElement('div');
    photoWrapper.className = 'pretty-popover__photo';
    const img = document.createElement('img');
    img.src = photoUrl;
    img.alt = 'Photo';
    img.loading = 'lazy';
    // Some hosts (e.g. LinkedIn CDN) hotlink-protect by referer; dropping it can
    // let the image through. If it still fails (dead/expired URL), swap in a
    // CSP-safe inline-SVG avatar so the card keeps its shape instead of showing
    // a broken-image box.
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      const avatar = createAvatarSvg();
      avatar.classList.add('pretty-popover__photo-fallback');
      img.replaceWith(avatar);
    };
    photoWrapper.appendChild(img);
    card.appendChild(photoWrapper);

    const info = document.createElement('div');
    info.className = 'pretty-popover__header-info';
    info.appendChild(createTitle(pageData));
    appendSubtitle(info, config.subtitleText);

    const description = pageData.properties.description;
    if (description) {
      info.appendChild(createDescription(cleanPropertyValue(description)));
    }

    card.appendChild(info);

    return { header: card, descriptionInHeader: !!description };
  }

  // Simple header
  const header = document.createElement('div');
  header.className = 'pretty-popover__header';
  header.appendChild(createTitle(pageData));
  appendSubtitle(header, config.subtitleText);

  return { header, descriptionInHeader: false };
}

function appendSubtitle(parent: HTMLElement, subtitleText: string | null): void {
  if (!subtitleText) return;

  const el = document.createElement('div');
  el.className = 'pretty-popover__subtitle';
  el.textContent = subtitleText;
  parent.appendChild(el);
}

function buildAliases(pageData: PageData): HTMLElement | null {
  const aliases = cleanAllValues(pageData.properties.alias);
  if (aliases.length === 0) return null;

  const el = document.createElement('div');
  el.className = 'pretty-popover__aliases';
  el.textContent = `aka ${aliases.join(' \u00B7 ')}`;
  return el;
}

function buildDetails(pageData: PageData, config: PopoverConfig): HTMLElement | null {
  const rows: HTMLElement[] = [];

  for (const prop of config.detailProperties) {
    const value = pageData.properties[prop];
    if (!value) continue;

    const valueEl = renderPropertyValue(prop, value);
    const label = prop.charAt(0).toUpperCase() + prop.slice(1);
    rows.push(createDetailRow(label, valueEl));
  }

  if (rows.length === 0) return null;

  const container = document.createElement('div');
  container.className = 'pretty-popover__details';

  for (const row of rows) container.appendChild(row);

  return container;
}

function buildLinkSection(pageData: PageData): HTMLElement | null {
  const url = extractUrl(pageData.properties.url);
  if (!url) return null;

  const container = document.createElement('div');
  container.className = 'pretty-popover__link-section';

  const link = document.createElement('a');
  link.className = 'pretty-popover__external-link';
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = formatUrlLabel(url);
  container.appendChild(link);

  return container;
}

function buildTags(pageData: PageData, config: PopoverConfig): HTMLElement | null {
  const values: string[] = [];
  const { type, status, area } = pageData.properties;

  for (const val of [type, status, area]) {
    if (val) values.push(...cleanAllValues(val));
  }

  for (const prop of config.extraTags) {
    const val = pageData.properties[prop];
    if (val) values.push(...cleanAllValues(val));
  }

  return createTagPills(values);
}
