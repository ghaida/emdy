import { describe, it, expect } from 'vitest';
import { PRINT_PALETTE } from './print-palette';
import { contrast } from './mermaid-theme';
import { PRINT_COLORS } from '../../shared/print-colors';

describe('PRINT_PALETTE', () => {
  it('keeps every syntax color readable (4.5:1) on the gray print block', () => {
    const syntax = {
      text: PRINT_PALETTE.textPrimary,
      keyword: PRINT_PALETTE.codeKeyword,
      string: PRINT_PALETTE.codeString,
      number: PRINT_PALETTE.codeNumber,
      function: PRINT_PALETTE.codeFunction,
      comment: PRINT_PALETTE.codeComment,
      punctuation: PRINT_PALETTE.codePunctuation,
      error: PRINT_PALETTE.error,
    };
    for (const [role, color] of Object.entries(syntax)) {
      expect(contrast(color, PRINT_COLORS.block), role).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('sits on the same surfaces as the print stylesheet', () => {
    expect(PRINT_PALETTE.bgCode).toBe(PRINT_COLORS.block);
    expect(PRINT_PALETTE.textPrimary).toBe(PRINT_COLORS.text);
  });
});
