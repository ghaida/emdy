import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FileContextMenu } from './FileContextMenu';

const itemNames = () => screen.getAllByRole('menuitem').map((item) => item.textContent);

describe('FileContextMenu', () => {
  it('offers Copy and Download as PDF for the open file', () => {
    render(
      <FileContextMenu x={0} y={0} filePath="/r/a.md" isOpenFile onClose={vi.fn()} onCopyHTML={vi.fn()} onExportPDF={vi.fn()} />,
    );
    expect(itemNames()).toEqual(['Copy to Clipboard', 'Download as PDF', 'Show in Finder', 'Open in New Window']);
  });

  it('offers only Show in Finder and Open in New Window for another file', () => {
    // Copy and PDF would act on the open document, not on this one.
    const { container } = render(
      <FileContextMenu x={0} y={0} filePath="/r/a.md" isOpenFile={false} onClose={vi.fn()} onCopyHTML={vi.fn()} onExportPDF={vi.fn()} />,
    );
    expect(itemNames()).toEqual(['Show in Finder', 'Open in New Window']);
    expect(container.querySelector('.context-menu-separator')).toBeNull();
  });
});
