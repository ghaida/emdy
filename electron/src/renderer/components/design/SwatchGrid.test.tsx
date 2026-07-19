import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SwatchGrid } from './SwatchGrid';

describe('SwatchGrid', () => {
  it('renders a swatch, name, and literal value per color token', () => {
    render(<SwatchGrid colors={{ primary: '#1A1C1E', tertiary: '#B8422E' }} />);
    expect(screen.getByText('primary')).toBeInTheDocument();
    expect(screen.getByText('#1A1C1E')).toBeInTheDocument();
    const swatches = document.querySelectorAll('.design-swatch');
    expect(swatches).toHaveLength(2);
    expect((swatches[0] as HTMLElement).style.backgroundColor).not.toBe('');
  });

  it('renders invalid color values as name/value rows without a swatch', () => {
    render(<SwatchGrid colors={{ broken: '{colors.missing}' }} />);
    expect(screen.getByText('broken')).toBeInTheDocument();
    expect(screen.getByText('{colors.missing}')).toBeInTheDocument();
    expect(document.querySelectorAll('.design-swatch')).toHaveLength(0);
  });
});
