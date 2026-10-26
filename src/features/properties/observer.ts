import { getObserverRoot, getPlatform } from '../../core/platform';
import { cleanPropertyValue } from '../../lib/api';
import { getParentDoc } from '../../lib/dom';

const ICON_CLASS = 'pl-property-icon';
const RESOLVED_ATTR = 'data-pl-icon-resolved';

async function processPropertyKey(keyEl: Element, isLive: () => boolean): Promise<void> {
  if (keyEl.hasAttribute(RESOLVED_ATTR)) return;
  keyEl.setAttribute(RESOLVED_ATTR, '');

  const keyName = keyEl.textContent?.trim();
  if (!keyName) return;

  const page = await getPlatform().api.getPageData(keyName);
  // The observer may have been torn down while the lookup was in flight.
  if (!isLive()) return;
  if (!page?.properties?.icon) return;

  const icon = cleanPropertyValue(page.properties.icon);
  if (!icon) return;

  const span = getParentDoc().createElement('span');
  span.className = ICON_CLASS;
  span.textContent = icon;
  keyEl.prepend(span);
}

function scanProperties(isLive: () => boolean): void {
  const doc = getParentDoc();
  const keys = doc.querySelectorAll(getPlatform().selectors.propertyKey);
  for (const key of keys) {
    processPropertyKey(key, isLive);
  }
}

function cleanupAll(): void {
  const doc = getParentDoc();
  for (const el of doc.querySelectorAll(`.${ICON_CLASS}`)) {
    el.remove();
  }
  for (const el of doc.querySelectorAll(`[${RESOLVED_ATTR}]`)) {
    el.removeAttribute(RESOLVED_ATTR);
  }
}

export function setupPropertyObserver(): () => void {
  let live = true;
  const isLive = () => live;

  scanProperties(isLive);

  let rafId: number | null = null;

  const observer = new MutationObserver(() => {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        scanProperties(isLive);
        rafId = null;
      });
    }
  });

  observer.observe(getObserverRoot(), { childList: true, subtree: true });

  return () => {
    live = false;
    observer.disconnect();
    if (rafId !== null) cancelAnimationFrame(rafId);
    cleanupAll();
  };
}
