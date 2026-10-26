import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TtlCache } from './cache';

describe('TtlCache', () => {
  const TTL = 1000;
  let cache: TtlCache<string>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    cache = new TtlCache<string>(TTL);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns undefined for a missing key', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('returns a value set within the TTL', () => {
    cache.set('a', 'one');

    vi.advanceTimersByTime(TTL - 1);

    expect(cache.get('a')).toBe('one');
  });

  it('treats an entry exactly TTL old as stale', () => {
    cache.set('a', 'one');

    vi.advanceTimersByTime(TTL);

    expect(cache.get('a')).toBeUndefined();
  });

  it('refreshes the timestamp when a key is set again', () => {
    cache.set('a', 'one');
    vi.advanceTimersByTime(TTL - 1);
    cache.set('a', 'two');
    vi.advanceTimersByTime(TTL - 1);

    expect(cache.get('a')).toBe('two');
  });

  it('keeps keys distinct and case-sensitive', () => {
    cache.set('Page', 'upper');
    cache.set('page', 'lower');

    expect(cache.get('Page')).toBe('upper');
    expect(cache.get('page')).toBe('lower');
  });

  it('deletes a single key', () => {
    cache.set('a', 'one');
    cache.set('b', 'two');

    cache.delete('a');

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('two');
  });

  it('does not throw when deleting a missing key', () => {
    expect(() => cache.delete('missing')).not.toThrow();
  });

  it('clears every entry', () => {
    cache.set('a', 'one');
    cache.set('b', 'two');

    cache.clear();

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });

  it('stores falsy values and still returns them while fresh', () => {
    const flags = new TtlCache<boolean>(TTL);
    flags.set('off', false);

    expect(flags.get('off')).toBe(false);
  });
});
