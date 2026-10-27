import { getPlatform } from '../../core/platform';
import { getParentDoc, positionElement, removeElementById } from '../../lib/dom';
import { renderPopover } from './renderers';

const POPOVER_ID = 'pretty-logseq-popover';
const SHOW_DELAY = 300;
const HIDE_DELAY = 150;

let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let currentAnchor: HTMLElement | null = null;
// The anchor whose popover is currently in the DOM (may lag currentAnchor during a fetch)
let popoverAnchor: HTMLElement | null = null;
let popoverListenersCleanup: (() => void) | null = null;

function clearShowTimer(): void {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
}

function clearHideTimer(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function getPopover(): HTMLElement | null {
  return getParentDoc().getElementById(POPOVER_ID);
}

function cleanupPopoverListeners(): void {
  popoverListenersCleanup?.();
  popoverListenersCleanup = null;
}

function hidePopover(): void {
  clearShowTimer();
  clearHideTimer();
  cleanupPopoverListeners();
  removeElementById(POPOVER_ID);
  currentAnchor = null;
  popoverAnchor = null;
}

function scheduleHide(): void {
  clearHideTimer();
  hideTimer = setTimeout(hidePopover, HIDE_DELAY);
}

function attachPopoverListeners(popover: HTMLElement): void {
  const onEnter = () => clearHideTimer();
  const onLeave = () => scheduleHide();

  const onClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const titleLink = target.closest('.pretty-popover__title') as HTMLElement | null;
    if (titleLink?.dataset.pageName) {
      e.preventDefault();
      hidePopover();
      logseq.App.pushState('page', { name: titleLink.dataset.pageName });
    }
  };

  popover.addEventListener('mouseenter', onEnter);
  popover.addEventListener('mouseleave', onLeave);
  popover.addEventListener('click', onClick);

  popoverListenersCleanup = () => {
    popover.removeEventListener('mouseenter', onEnter);
    popover.removeEventListener('mouseleave', onLeave);
    popover.removeEventListener('click', onClick);
  };
}

async function showPopover(anchor: HTMLElement, pageName: string): Promise<void> {
  const pageData = await getPlatform().api.getPageData(pageName);
  if (!pageData) return;

  // Use the resolved page name for blocks (handles aliases)
  const blocks = await getPlatform().api.getPageBlocks(pageData.name);
  pageData.blocks = blocks;

  // If anchor changed while we were fetching, abort
  if (currentAnchor !== anchor) return;

  // Remove any existing popover
  cleanupPopoverListeners();
  removeElementById(POPOVER_ID);

  const content = renderPopover(pageData);

  const doc = getParentDoc();
  const popover = doc.createElement('div');
  popover.id = POPOVER_ID;
  popover.className = 'pretty-popover';
  popover.appendChild(content);

  doc.body.appendChild(popover);
  positionElement(popover, anchor, { placement: 'bottom', offset: 8 });
  attachPopoverListeners(popover);
  popoverAnchor = anchor;
}

function getPageNameFromRef(element: HTMLElement): string | null {
  const ref = element.getAttribute('data-ref');
  if (ref) return ref;
  const text = element.textContent?.trim();
  return text ? text.replace(/^#/, '') : null;
}

/**
 * Set up hover event listeners for page reference popovers.
 * Uses capturing phase mouseenter to intercept events before
 * Logseq's own preview handlers.
 * Returns a cleanup function that removes all listeners.
 */
export function setupPopovers(): () => void {
  const doc = getParentDoc();
  let anchorLeaveCleanup: (() => void) | null = null;

  const cleanupAnchorLeave = () => {
    anchorLeaveCleanup?.();
    anchorLeaveCleanup = null;
  };

  const handleEnter = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const pageRef = target.closest?.(getPlatform().selectors.pageRef) as HTMLElement | null;
    if (!pageRef) return;

    // Don't trigger popovers for refs inside an existing popover
    if (pageRef.closest('.pretty-popover')) return;

    // If already showing for this anchor, just cancel any pending hide
    if (currentAnchor === pageRef && getPopover()) {
      clearHideTimer();
      return;
    }

    // A popover left over from another anchor no longer has a hover owning it
    if (popoverAnchor && popoverAnchor !== pageRef) hidePopover();

    clearShowTimer();
    clearHideTimer();
    cleanupAnchorLeave();
    currentAnchor = pageRef;

    // Attach mouseleave to this specific anchor
    const onAnchorLeave = () => {
      clearShowTimer();
      if (popoverAnchor === pageRef && getPopover()) scheduleHide();
      else currentAnchor = null;
      anchorLeaveCleanup = null;
    };

    pageRef.addEventListener('mouseleave', onAnchorLeave, { once: true });

    anchorLeaveCleanup = () => pageRef.removeEventListener('mouseleave', onAnchorLeave);

    showTimer = setTimeout(() => {
      const pageName = getPageNameFromRef(pageRef);
      if (pageName && currentAnchor === pageRef) showPopover(pageRef, pageName);
    }, SHOW_DELAY);
  };

  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest?.(getPlatform().selectors.pageRef)) hidePopover();
  };

  // Capturing phase intercepts before Logseq's own handlers
  doc.addEventListener('mouseenter', handleEnter, true);
  doc.addEventListener('click', handleClick, true);

  return () => {
    doc.removeEventListener('mouseenter', handleEnter, true);
    doc.removeEventListener('click', handleClick, true);
    cleanupAnchorLeave();
    hidePopover();
  };
}
