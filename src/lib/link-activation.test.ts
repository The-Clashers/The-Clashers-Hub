import { describe, expect, it, vi } from 'vitest';
import { linkEnterActivation } from './link-activation';

// Table-driven (NFR-07). One axis is the key: only Enter fires. The other
// axis is the event shape: RN-typed events carry no key at all, and junk
// must degrade to "not Enter" rather than throw.

describe('linkEnterActivation', () => {
  it('fires onPress exactly once for the Enter key', () => {
    const onPress = vi.fn();
    linkEnterActivation(onPress)({ key: 'Enter' });
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(['enter', ' ', 'Spacebar', 'Tab', 'ArrowDown', 'Escape', 'a', ''])('ignores key %s', (key) => {
    const onPress = vi.fn();
    linkEnterActivation(onPress)({ key });
    expect(onPress).not.toHaveBeenCalled();
  });

  it.each([
    ['an RN-typed event with no key field', {}],
    ['a null event', null],
    ['a non-object event', 13],
    ['a non-string key', { key: 13 }],
  ])('ignores %s', (_name, event) => {
    const onPress = vi.fn();
    linkEnterActivation(onPress)(event);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('returns a fresh handler per call, so two rows never share one callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const firstHandler = linkEnterActivation(first);
    const secondHandler = linkEnterActivation(second);
    firstHandler({ key: 'Enter' });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
    secondHandler({ key: 'Enter' });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
