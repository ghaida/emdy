import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    // On document, so Escape works wherever focus is and comes before App's
    // window-level Escape, which closes find; stopping it here leaves find open.
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !onEscapeRef.current) return;
      e.stopPropagation();
      onEscapeRef.current();
    };
    if (onEscapeRef.current) document.addEventListener('keydown', handleEscape);
    const removeEscape = () => document.removeEventListener('keydown', handleEscape);

    const container = containerRef.current;
    if (!container) return removeEscape;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      removeEscape();
      container.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [active, containerRef]);
}
