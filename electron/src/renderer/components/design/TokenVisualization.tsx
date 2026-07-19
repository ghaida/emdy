import type { DesignTokens, TokenCategory } from '../../lib/design-md';
import { SwatchGrid } from './SwatchGrid';
import { TypeSpecimens } from './TypeSpecimens';
import { SpacingScale } from './SpacingScale';
import { RadiusScale } from './RadiusScale';
import { ComponentTable } from './ComponentTable';

export function TokenVisualization({ category, tokens }: { category: TokenCategory; tokens: DesignTokens }) {
  switch (category) {
    case 'colors':
      return tokens.colors ? <SwatchGrid colors={tokens.colors} /> : null;
    case 'typography':
      return tokens.typography ? <TypeSpecimens typography={tokens.typography} /> : null;
    case 'spacing':
      return tokens.spacing ? <SpacingScale spacing={tokens.spacing} /> : null;
    case 'rounded':
      return tokens.rounded ? <RadiusScale rounded={tokens.rounded} /> : null;
    case 'components':
      return tokens.components ? <ComponentTable components={tokens.components} /> : null;
  }
}
