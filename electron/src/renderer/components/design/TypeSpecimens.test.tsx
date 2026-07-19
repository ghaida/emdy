import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypeSpecimens } from './TypeSpecimens';

describe('TypeSpecimens', () => {
  it('renders the token name as the specimen in its declared style', () => {
    render(
      <TypeSpecimens typography={{ h1: { fontFamily: 'Public Sans', fontSize: '3rem', fontWeight: '600' } }} />
    );
    const specimen = document.querySelector('.design-specimen') as HTMLElement;
    expect(specimen.textContent).toBe('h1');
    expect(specimen.style.fontSize).toBe('3rem');
    expect(specimen.style.fontFamily).toContain('Public Sans');
  });

  it('renders a metadata line from the declared fields only', () => {
    render(<TypeSpecimens typography={{ body: { fontFamily: 'Inter', fontSize: '1rem' } }} />);
    expect(screen.getByText('Inter · 1rem')).toBeInTheDocument();
  });
});
