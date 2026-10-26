import { getObserverRoot, getPlatform } from '../../core/platform';
import { cleanPropertyValue } from '../../lib/api';
import { getParentDoc } from '../../lib/dom';
import type { PageData } from '../../types';

const ICON_CLASS = 'pl-property-icon';
const RESOLVED_ATTR = 'data-pl-icon-resolved';
// Scans run on every DOM mutation (i.e. per keystroke), so a lookup that keeps
// failing is retried a few times, then left resolved instead of re-queried forever.
const MAX_LOOKUP_ATTEMPTS = 3;
const failedLookups = new Map<string, number>();

async function processPropertyKey(keyEl: Element): Promise<void> {
  if (keyEl.hasAttribute(RESOLVED_ATTR)) return;
  keyEl.setAttribute(RESOLVED_ATTR, '');

  const keyName = keyEl.textContent?.trim();
  if (!keyName) return;

  let page: PageData | null;
  try {
    page = await getPlatform().api.getPageData(keyName, { throwOnError: true });
  } catch (err) {
    // Unmark so a later scan retries; a null result (no such page) stays marked.
    const attempts = (failedLookups.get(keyName) ?? 0) + 1;
    failedLookups.set(keyName, attempts);
    if (attempts < MAX_LOOKUP_ATTEMPTS) keyEl.removeAttribute(RESOLVED_ATTR);
    console.error(`[Pretty Logseq] Property icon lookup failed for "${keyName}":`, err);
    return;
  }
  if (!page?.properties?.icon) return;

  const icon = cleanPropertyValue(page.properties.icon);
  if (!icon) return;

  const span = getParentDoc().createElement('span');
  span.className = ICON_CLASS;
  span.textContent = icon;
  keyEl.prepend(span);
}

function scanProperties(): void {
  const doc = getParentDoc();
  const keys = doc.querySelectorAll(getPlatform().selectors.propertyKey);
  for (const key of keys) {
    processPropertyKey(key);
  }
}

function cleanupAll(): void {
  failedLookups.clear();
  const doc = getParentDoc();
  for (const el of doc.querySelectorAll(`.${ICON_CLASS}`)) {
    el.remove();
  }
  for (const el of doc.querySelectorAll(`[${RESOLVED_ATTR}]`)) {
    el.removeAttribute(RESOLVED_ATTR);
  }
}

export function setupPropertyObserver(): () => void {
  scanProperties();

  let rafId: number | null = null;

  const observer = new MutationObserver(() => {
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        scanProperties();
        rafId = null;
      });
    }
  });

  observer.observe(getObserverRoot(), { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    if (rafId !== null) cancelAnimationFrame(rafId);
    cleanupAll();
  };
}
