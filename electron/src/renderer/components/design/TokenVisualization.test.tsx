import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TokenVisualization } from './TokenVisualization';
import type { DesignTokens } from '../../lib/design-md';

const tokens: DesignTokens = {
  name: 'X',
  colors: { primary: '#1A1C1E' },
  typography: { h1: { fontSize: '3rem' } },
  spacing: { sm: '8px', weird: 'auto' },
  rounded: { md: '8px' },
  components: { button: { backgroundColor: '#1A1C1E', padding: '12px' } },
};

describe('TokenVisualization', () => {
  it('dispatches colors to SwatchGrid', () => {
    render(<TokenVisualization category="colors" tokens={tokens} />);
    expect(document.querySelector('.design-swatches')).not.toBeNull();
  });

  it('dispatches typography to TypeSpecimens', () => {
    render(<TokenVisualization category="typography" tokens={tokens} />);
    expect(document.querySelector('.design-specimens')).not.toBeNull();
  });

  it('renders spacing bars sized from values, skipping bars for unparseable ones', () => {
    render(<TokenVisualization category="spacing" tokens={tokens} />);
    const bars = document.querySelectorAll('.design-spacing-bar');
    expect(bars).toHaveLength(1);
    expect((bars[0] as HTMLElement).style.width).toBe('8px');
    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('renders radius squares with the literal radius applied', () => {
    render(<TokenVisualization category="rounded" tokens={tokens} />);
    const sq = document.querySelector('.design-radius-square') as HTMLElement;
    expect(sq.style.borderRadius).toBe('8px');
  });

  it('renders components as a property/value table with mini swatches for colors', () => {
    render(<TokenVisualization category="components" tokens={tokens} />);
    expect(screen.getByText('button')).toBeInTheDocument();
    expect(screen.getByText('backgroundColor')).toBeInTheDocument();
    expect(screen.getByText('12px')).toBeInTheDocument();
    expect(document.querySelectorAll('.design-mini-swatch')).toHaveLength(1);
  });

  it('returns null when the category has no tokens', () => {
    const { container } = render(<TokenVisualization category="colors" tokens={{ name: 'X' }} />);
    expect(container.firstChild).toBeNull();
  });
});
