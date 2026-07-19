import { cssLength } from '../../lib/design-md';

export function SpacingScale({ spacing }: { spacing: Record<string, string> }) {
  return (
    <div className="design-scale">
      {Object.entries(spacing).map(([name, value]) => {
        const px = cssLength(value);
        return (
          <div className="design-scale-row" key={name}>
            <div className="design-token-name">{name}</div>
            {px !== null && <div className="design-spacing-bar" style={{ width: `${px}px` }} />}
            <div className="design-token-value">{value}</div>
          </div>
        );
      })}
    </div>
  );
}
