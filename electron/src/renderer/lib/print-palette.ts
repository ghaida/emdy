// The palette for content that leaves the app: diagrams and syntax-highlighted
// code in Print and PDF, and diagrams in Copy RTF. It's the neutral light theme
// with the print stylesheet's grays, and it's theme-independent on purpose,
// like the rest of the print output: printing from a dark theme shouldn't put
// dark boxes or light-gray code on white paper.

import { neutral, type ColorScale } from './color-themes';
import { PRINT_COLORS } from '../../shared/print-colors';

export const PRINT_PALETTE: ColorScale = {
  ...neutral.light,
  bgCode: PRINT_COLORS.block,
  bgContent: '#FFFFFF',
  bgSecondary: '#F5F5F5',
  bgTertiary: '#E4E4E4',
  border: '#999999',
  borderSubtle: '#CCCCCC',
  textMuted: '#777777',
  textSecondary: '#555555',
  textPrimary: PRINT_COLORS.text,
  textHeading: PRINT_COLORS.heading,
  accent: PRINT_COLORS.link,
  highlightSubtle: '#FFF3C4',
  highlightStrong: '#E0C870',
  // Neutral light's syntax colors, with the three that fall short of 4.5:1 on
  // the gray print block darkened.
  codeString: '#C02A17',
  codeComment: '#6A6A6A',
  error: '#C0392B',
};
