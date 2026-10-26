/**
 * Lazy getter for the parent document.
 * Plugins run in an iframe; `parent` is the Logseq main window.
 * Called lazily (not at module scope) so the access happens after
 * the SDK handshake, not during ES module evaluation.
 */
export function getParentDoc(): Document {
  return parent.document;
}

export interface Position {
  top: number;
  left: number;
}

export type Placement = 'top' | 'bottom' | 'left' | 'right';

export interface PositionOptions {
  placement?: Placement;
  offset?: number;
}

export function calculatePosition(anchor: HTMLElement, options: PositionOptions = {}): Position {
  const { placement = 'bottom', offset = 8 } = options;
  const rect = anchor.getBoundingClientRect();

  let top: number;
  let left: number;

  switch (placement) {
    case 'top':
      top = rect.top - offset;
      left = rect.left;
      break;
    case 'bottom':
      top = rect.bottom + offset;
      left = rect.left;
      break;
    case 'left':
      top = rect.top;
      left = rect.left - offset;
      break;
    case 'right':
      top = rect.top;
      left = rect.right + offset;
      break;
    default:
      top = rect.bottom + offset;
      left = rect.left;
  }

  return { top, left };
}

/**
 * Adjust position to keep element within viewport.
 * Uses top window dimensions since plugins run in an iframe.
 */
export function adjustForViewport(
  position: Position,
  elementWidth: number,
  elementHeight: number,
  padding = 16,
): Position {
  const viewport = parent;
  const { innerWidth, innerHeight } = viewport;
  let { top: posTop, left } = position;

  // Adjust horizontal position
  if (left + elementWidth > innerWidth - padding) {
    left = innerWidth - elementWidth - padding;
  }

  if (left < padding) {
    left = padding;
  }

  // Adjust vertical position
  if (posTop + elementHeight > innerHeight - padding) {
    posTop = innerHeight - elementHeight - padding;
  }

  if (posTop < padding) {
    posTop = padding;
  }

  return { top: posTop, left };
}

/**
 * Position an element relative to an anchor with viewport adjustment
 */
export function positionElement(
  element: HTMLElement,
  anchor: HTMLElement,
  options: PositionOptions = {},
): void {
  const position = calculatePosition(anchor, options);
  const rect = element.getBoundingClientRect();

  const adjusted = adjustForViewport(position, rect.width, rect.height);

  element.style.left = `${adjusted.left}px`;
  element.style.top = `${adjusted.top}px`;
}

/**
 * Remove an element by ID if it exists.
 * Uses parent.document since plugins run in an iframe.
 */
export function removeElementById(id: string): void {
  getParentDoc().getElementById(id)?.remove();
}
