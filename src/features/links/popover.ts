import { getParentDoc, positionElement, removeElementById } from '../../lib/dom';
import { createFallbackMetadata, fetchMetadata } from './metadata';
import { applyPopoverBaseStyles, renderLinkPopover } from './render';
import type { LinkMetadata } from './types';

const LINK_POPOVER_ID = 'pretty-logseq-link-popover';
const SHOW_DELAY = 400;
const HIDE_DELAY = 150;

let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let currentAnchor: HTMLElement | null = null;
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
  return getParentDoc().getElementById(LINK_POPOVER_ID);
}

function cleanupPopoverListeners(): void {
  popoverListenersCleanup?.();
  popoverListenersCleanup = null;
}

function hidePopover(): void {
  clearShowTimer();
  clearHideTimer();
  cleanupPopoverListeners();
  removeElementById(LINK_POPOVER_ID);
  currentAnchor = null;
}

function scheduleHide(): void {
  clearHideTimer();
  hideTimer = setTimeout(hidePopover, HIDE_DELAY);
}

function attachPopoverListeners(popover: HTMLElement): void {
  const onEnter = () => clearHideTimer();
  const onLeave = () => scheduleHide();

  popover.addEventListener('mouseenter', onEnter);
  popover.addEventListener('mouseleave', onLeave);

  popoverListenersCleanup = () => {
    popover.removeEventListener('mouseenter', onEnter);
    popover.removeEventListener('mouseleave', onLeave);
  };
}

function renderAndShow(anchor: HTMLAnchorElement, metadata: LinkMetadata): void {
  cleanupPopoverListeners();
  removeElementById(LINK_POPOVER_ID);

  const doc = getParentDoc();
  const content = renderLinkPopover(metadata);
  const popover = doc.createElement('div');
  popover.id = LINK_POPOVER_ID;
  popover.className = 'pretty-link-popover';
  applyPopoverBaseStyles(popover);
  popover.appendChild(content);

  doc.body.appendChild(popover);
  positionElement(popover, anchor, { placement: 'bottom', offset: 8 });
  attachPopoverListeners(popover);
}

async function showLinkPopover(anchor: HTMLAnchorElement): Promise<void> {
  const url = anchor.href;
  if (!url) return;

  // Show immediately with URL-derived data so the popover always appears, even
  // when the metadata fetch is blocked (CSP/CORS in v2).
  renderAndShow(anchor, createFallbackMetadata(url));

  // Enrich once metadata resolves — unless the user has moved on.
  const metadata = await fetchMetadata(url);
  if (metadata && currentAnchor === anchor && getPopover()) {
    renderAndShow(anchor, metadata);
  }
}

export function setupLinkPopovers(): () => void {
  const doc = getParentDoc();
  let anchorLeaveCleanup: (() => void) | null = null;

  const cleanupAnchorLeave = () => {
    anchorLeaveCleanup?.();
    anchorLeaveCleanup = null;
  };

  const handleEnter = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const externalLink = target.closest?.('a.external-link') as HTMLAnchorElement | null;
    if (!externalLink) return;

    if (currentAnchor === externalLink && getPopover()) {
      clearHideTimer();
      return;
    }

    clearShowTimer();
    clearHideTimer();
    cleanupAnchorLeave();
    currentAnchor = externalLink;

    const onAnchorLeave = () => {
      clearShowTimer();
      if (getPopover()) {
        scheduleHide();
      } else {
        currentAnchor = null;
      }
      anchorLeaveCleanup = null;
    };
    externalLink.addEventListener('mouseleave', onAnchorLeave, { once: true });
    anchorLeaveCleanup = () => externalLink.removeEventListener('mouseleave', onAnchorLeave);

    showTimer = setTimeout(() => {
      if (currentAnchor === externalLink) {
        showLinkPopover(externalLink);
      }
    }, SHOW_DELAY);
  };

  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest?.('a.external-link')) {
      hidePopover();
    }
  };

  doc.addEventListener('mouseenter', handleEnter, true);
  doc.addEventListener('click', handleClick, true);

  return () => {
    doc.removeEventListener('mouseenter', handleEnter, true);
    doc.removeEventListener('click', handleClick, true);
    cleanupAnchorLeave();
    hidePopover();
  };
}
