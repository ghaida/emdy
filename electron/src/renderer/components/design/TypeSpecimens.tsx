import { useMemo } from 'react';
import type { TypographyToken } from '../../lib/design-md';
import { fontFamilies, isFontAvailable, withFallback } from '../../lib/font-availability';

function fontAvailable(value: string | undefined): boolean {
  const first = value ? fontFamilies(value)[0] : undefined;
  return !first || isFontAvailable(first);
}

export function TypeSpecimens({ typography }: { typography: Record<string, TypographyToken> }) {
  return (
    <div className="design-specimens">
      {Object.entries(typography).map(([name, t]) => (
        <SpecimenRow key={name} name={name} token={t} />
      ))}
    </div>
  );
}

function SpecimenRow({ name, token }: { name: string; token: TypographyToken }) {
  const available = useMemo(() => fontAvailable(token.fontFamily), [token.fontFamily]);
  const meta = [token.fontFamily, token.fontSize, token.fontWeight, token.lineHeight, token.letterSpacing]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="design-specimen-row">
      <div
        className="design-specimen"
        style={{
          fontFamily: token.fontFamily && withFallback(token.fontFamily),
          fontSize: token.fontSize,
          fontWeight: token.fontWeight as React.CSSProperties['fontWeight'],
          lineHeight: token.lineHeight,
          letterSpacing: token.letterSpacing,
        }}
      >
        {name}
      </div>
      <div className="design-token-value">
        {meta}
        {!available && <span className="design-fallback-note"> — shown in fallback font</span>}
      </div>
    </div>
  );
}
