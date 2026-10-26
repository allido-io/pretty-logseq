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
// Keys with the same name (e.g. a page open in both main and sidebar) share one
// lookup, so a single failure is counted and logged once, not once per element.
const pendingLookups = new Map<string, Promise<PageData | null>>();

function lookupPage(keyName: string): Promise<PageData | null> {
  const pending = pendingLookups.get(keyName);
  if (pending) return pending;

  const lookup = getPlatform()
    .api.getPageData(keyName, { throwOnError: true })
    .then(
      page => {
        failedLookups.delete(keyName);
        return page;
      },
      err => {
        failedLookups.set(keyName, (failedLookups.get(keyName) ?? 0) + 1);
        console.error(`[Pretty Logseq] Property icon lookup failed for "${keyName}":`, err);
        throw err;
      },
    )
    .finally(() => pendingLookups.delete(keyName));
  pendingLookups.set(keyName, lookup);
  return lookup;
}

async function processPropertyKey(keyEl: Element, isLive: () => boolean): Promise<void> {
  if (keyEl.hasAttribute(RESOLVED_ATTR)) return;
  keyEl.setAttribute(RESOLVED_ATTR, '');

  const keyName = keyEl.textContent?.trim();
  if (!keyName) return;
  if ((failedLookups.get(keyName) ?? 0) >= MAX_LOOKUP_ATTEMPTS) return;

  let page: PageData | null;
  try {
    page = await lookupPage(keyName);
  } catch {
    // Unmark so a later scan retries; a null result (no such page) stays marked.
    keyEl.removeAttribute(RESOLVED_ATTR);
    return;
  }
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
