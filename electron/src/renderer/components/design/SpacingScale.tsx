import type { CSSProperties } from 'react';
import { cssLength } from '../../lib/design-md';

// The bar's full width rides along as --bar-width, so the stylesheet can mark a
// bar that's wider than its track instead of silently cutting it to fit.
export function SpacingScale({ spacing }: { spacing: Record<string, string> }) {
  return (
    <div className="design-scale">
      {Object.entries(spacing).map(([name, value]) => {
        const px = cssLength(value);
        return (
          <div className="design-scale-row" key={name}>
            <div className="design-token-name">{name}</div>
            <div className="design-token-value">{value}</div>
            {px !== null && (
              <div className="design-spacing-track">
                <div
                  className="design-spacing-bar"
                  style={{ width: `${px}px`, '--bar-width': `${px}px` } as CSSProperties}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
