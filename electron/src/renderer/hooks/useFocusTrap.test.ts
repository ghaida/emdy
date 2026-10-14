import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFocusTrap } from './useFocusTrap';

function pressEscape() {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

// A dialog that mounts through a transition is active for a render before its
// container exists.
describe.each([
  ['before its container exists', () => null],
  ['once its container exists', () => document.createElement('div')],
])('Escape %s', (_, container) => {
  function trap(onEscape: () => void) {
    const ref = { current: container() };
    return renderHook(({ active }) => useFocusTrap(ref, active, onEscape), { initialProps: { active: true } });
  }

  it('calls onEscape while the trap is active', () => {
    const onEscape = vi.fn();
    trap(onEscape);
    pressEscape();
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('stops when the trap turns inactive', () => {
    const onEscape = vi.fn();
    const { rerender } = trap(onEscape);
    rerender({ active: false });
    pressEscape();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('stops when the trap unmounts', () => {
    const onEscape = vi.fn();
    const { unmount } = trap(onEscape);
    unmount();
    pressEscape();
    expect(onEscape).not.toHaveBeenCalled();
  });
});

describe('Escape without an onEscape', () => {
  it('is left to the window, where the palette listens for it', () => {
    const windowKeydown = vi.fn();
    window.addEventListener('keydown', windowKeydown);
    try {
      const ref = { current: document.createElement('div') };
      renderHook(() => useFocusTrap(ref, true));
      pressEscape();
      expect(windowKeydown).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', windowKeydown);
    }
  });
});
