/**
 * Tests for DOM Utilities
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockAnchor, setViewport } from '../../test/utils/dom';
import {
  adjustForViewport,
  calculatePosition,
  type Placement,
  positionElement,
  removeElementById,
} from './dom';

describe('calculatePosition', () => {
  it('positions below anchor by default', () => {
    const anchor = createMockAnchor({
      top: 100,
      left: 200,
      bottom: 120,
      right: 300,
    });

    const pos = calculatePosition(anchor);

    expect(pos).toEqual({
      top: 128, // 120 + 8 (default offset)
      left: 200,
    });
  });

  it('positions below anchor when placement is "bottom"', () => {
    const anchor = createMockAnchor({
      top: 100,
      left: 200,
      bottom: 120,
      right: 300,
    });

    const pos = calculatePosition(anchor, { placement: 'bottom' });

    expect(pos).toEqual({
      top: 128, // 120 + 8
      left: 200,
    });
  });

  it('positions above anchor when placement is "top"', () => {
    const anchor = createMockAnchor({
      top: 100,
      left: 200,
      bottom: 120,
      right: 300,
    });

    const pos = calculatePosition(anchor, { placement: 'top' });

    expect(pos).toEqual({
      top: 92, // 100 - 8
      left: 200,
    });
  });

  it('positions to the left of anchor when placement is "left"', () => {
    const anchor = createMockAnchor({
      top: 100,
      left: 200,
      bottom: 120,
      right: 300,
    });

    const pos = calculatePosition(anchor, { placement: 'left' });

    expect(pos).toEqual({
      top: 100,
      left: 192, // 200 - 8
    });
  });

  it('positions to the right of anchor when placement is "right"', () => {
    const anchor = createMockAnchor({
      top: 100,
      left: 200,
      bottom: 120,
      right: 300,
    });

    const pos = calculatePosition(anchor, { placement: 'right' });

    expect(pos).toEqual({
      top: 100,
      left: 308, // 300 + 8
    });
  });

  it('uses custom offset', () => {
    const anchor = createMockAnchor({
      top: 100,
      left: 200,
      bottom: 120,
      right: 300,
    });

    const pos = calculatePosition(anchor, { offset: 20 });

    expect(pos).toEqual({
      top: 140, // 120 + 20
      left: 200,
    });
  });

  it('handles all placements with custom offset', () => {
    const anchor = createMockAnchor({
      top: 100,
      left: 200,
      bottom: 120,
      right: 300,
    });
    const offset = 16;

    const placements: Placement[] = ['top', 'bottom', 'left', 'right'];
    const expected = {
      top: { top: 84, left: 200 }, // 100 - 16
      bottom: { top: 136, left: 200 }, // 120 + 16
      left: { top: 100, left: 184 }, // 200 - 16
      right: { top: 100, left: 316 }, // 300 + 16
    };

    for (const placement of placements) {
      const pos = calculatePosition(anchor, { placement, offset });
      expect(pos).toEqual(expected[placement]);
    }
  });
});

describe('adjustForViewport', () => {
  beforeEach(() => {
    setViewport(1920, 1080);
  });

  it('does not adjust when element fits within viewport', () => {
    const position = { top: 100, left: 200 };
    const adjusted = adjustForViewport(position, 300, 200);

    expect(adjusted).toEqual(position);
  });

  it('constrains element when it overflows right edge', () => {
    const position = { top: 100, left: 1800 };
    const adjusted = adjustForViewport(position, 300, 200);

    expect(adjusted.left).toBeLessThanOrEqual(1920 - 300 - 16);
    expect(adjusted.top).toBe(100);
  });

  it('constrains element when it overflows bottom edge', () => {
    const position = { top: 1000, left: 200 };
    const adjusted = adjustForViewport(position, 300, 200);

    expect(adjusted.top).toBeLessThanOrEqual(1080 - 200 - 16);
    expect(adjusted.left).toBe(200);
  });

  it('constrains element when it overflows left edge', () => {
    const position = { top: 100, left: -50 };
    const adjusted = adjustForViewport(position, 300, 200);

    expect(adjusted.left).toBeGreaterThanOrEqual(16);
    expect(adjusted.top).toBe(100);
  });

  it('constrains element when it overflows top edge', () => {
    const position = { top: -50, left: 200 };
    const adjusted = adjustForViewport(position, 300, 200);

    expect(adjusted.top).toBeGreaterThanOrEqual(16);
    expect(adjusted.left).toBe(200);
  });

  it('constrains element when it overflows multiple edges', () => {
    const position = { top: -100, left: -100 };
    const adjusted = adjustForViewport(position, 300, 200);

    expect(adjusted.top).toBeGreaterThanOrEqual(16);
    expect(adjusted.left).toBeGreaterThanOrEqual(16);
  });

  it('uses custom padding', () => {
    const position = { top: 100, left: 1900 };
    const adjusted = adjustForViewport(position, 300, 200, 32);

    expect(adjusted.left).toBeLessThanOrEqual(1920 - 300 - 32);
  });

  it('handles very small viewport', () => {
    setViewport(800, 600);

    const position = { top: 500, left: 700 };
    const adjusted = adjustForViewport(position, 300, 200);

    expect(adjusted.top).toBeLessThanOrEqual(600 - 200 - 16);
    expect(adjusted.left).toBeLessThanOrEqual(800 - 300 - 16);
  });

  it('correctly positions at exact viewport boundaries', () => {
    const position = { top: 864, left: 1604 }; // 1080 - 200 - 16, 1920 - 300 - 16
    const adjusted = adjustForViewport(position, 300, 200);

    expect(adjusted).toEqual(position);
  });
});

describe('positionElement', () => {
  it('positions element relative to anchor', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    // Mock the element's getBoundingClientRect
    element.getBoundingClientRect = vi.fn(() => ({
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      bottom: 100,
      right: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as () => DOMRect;

    const anchor = createMockAnchor({
      top: 100,
      left: 200,
      bottom: 120,
      right: 300,
    });

    setViewport(1920, 1080);
    positionElement(element, anchor);

    expect(element.style.left).toBe('200px');
    expect(element.style.top).toBe('128px'); // 120 + 8
  });

  it('uses custom placement', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    element.getBoundingClientRect = vi.fn(() => ({
      width: 200,
      height: 100,
      top: 0,
      left: 0,
      bottom: 100,
      right: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as () => DOMRect;

    const anchor = createMockAnchor({
      top: 100,
      left: 200,
      bottom: 120,
      right: 300,
    });

    setViewport(1920, 1080);
    positionElement(element, anchor, { placement: 'top' });

    expect(element.style.left).toBe('200px');
    expect(element.style.top).toBe('92px'); // 100 - 8
  });

  it('adjusts for viewport boundaries', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    element.getBoundingClientRect = vi.fn(() => ({
      width: 300,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as () => DOMRect;

    const anchor = createMockAnchor({
      top: 1000,
      left: 1800,
      bottom: 1020,
      right: 1900,
    });

    setViewport(1920, 1080);
    positionElement(element, anchor);

    // Should be constrained within viewport
    const leftPx = Number.parseInt(element.style.left, 10);
    const topPx = Number.parseInt(element.style.top, 10);

    expect(leftPx).toBeLessThanOrEqual(1920 - 300 - 16);
    expect(topPx).toBeLessThanOrEqual(1080 - 200 - 16);
  });
});

describe('removeElementById', () => {
  it('removes element that exists', () => {
    const element = document.createElement('div');
    element.id = 'test-remove';
    document.body.appendChild(element);

    expect(document.getElementById('test-remove')).toBeTruthy();

    removeElementById('test-remove');

    expect(document.getElementById('test-remove')).toBeNull();
  });

  it('does not throw when element does not exist', () => {
    expect(() => removeElementById('non-existent')).not.toThrow();
  });

  it('handles multiple removals of same ID', () => {
    const element = document.createElement('div');
    element.id = 'test-multiple';
    document.body.appendChild(element);

    removeElementById('test-multiple');
    removeElementById('test-multiple'); // Should not throw

    expect(document.getElementById('test-multiple')).toBeNull();
  });

  it('removes element from document body', () => {
    const element = document.createElement('div');
    element.id = 'body-child';
    document.body.appendChild(element);

    expect(document.body.contains(element)).toBe(true);

    removeElementById('body-child');

    expect(document.body.contains(element)).toBe(false);
  });

  it('works with top.document (iframe context)', () => {
    // Setup: ensure top.document is available (set in test setup)
    const element = document.createElement('div');
    element.id = 'iframe-test';
    document.body.appendChild(element);

    removeElementById('iframe-test');

    expect(document.getElementById('iframe-test')).toBeNull();
  });
});
