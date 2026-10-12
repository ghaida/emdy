import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypeSpecimens } from './TypeSpecimens';

vi.mock('../../lib/font-availability', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/font-availability')>()),
  isFontAvailable: (family: string) => family !== 'Missing Sans',
}));

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

  it("shows a missing font in Emdy's sans and says so", () => {
    render(<TypeSpecimens typography={{ body: { fontFamily: 'Missing Sans', fontSize: '1rem' } }} />);
    const specimen = document.querySelector('.design-specimen') as HTMLElement;
    expect(specimen.style.fontFamily).toContain('IBM Plex Sans');
    expect(document.querySelector('.design-fallback-note')).not.toBeNull();
  });

  it("uses the file's own fallback for a missing font when it lists one", () => {
    render(<TypeSpecimens typography={{ body: { fontFamily: "'Missing Sans', Georgia, serif" } }} />);
    const specimen = document.querySelector('.design-specimen') as HTMLElement;
    expect(specimen.style.fontFamily).not.toContain('IBM Plex Sans');
    expect(document.querySelector('.design-fallback-note')).not.toBeNull();
  });

  it('adds no note for an installed font', () => {
    render(<TypeSpecimens typography={{ body: { fontFamily: 'Inter, sans-serif' } }} />);
    expect(document.querySelector('.design-fallback-note')).toBeNull();
  });
});
