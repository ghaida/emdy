import { isValidCssColor } from '../../lib/design-md';

export function SwatchGrid({ colors }: { colors: Record<string, string> }) {
  return (
    <div className="design-swatches">
      {Object.entries(colors).map(([name, value]) => {
        const valid = isValidCssColor(value);
        return (
          <div className="design-swatch-item" key={name}>
            {valid && <div className="design-swatch" style={{ backgroundColor: value }} />}
            <div className="design-token-name">{name}</div>
            <div className="design-token-value">{value}</div>
          </div>
        );
      })}
    </div>
  );
}
