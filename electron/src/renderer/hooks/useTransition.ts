import { useState, useEffect } from 'react';

const DURATION = 150; // ms — matches --transition-normal

export function useTransition(visible: boolean) {
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Delay one frame so the initial render happens at opacity 0
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true));
      });
    } else {
      setActive(false);
      const timer = setTimeout(() => setMounted(false), DURATION);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return { mounted, active };
}
