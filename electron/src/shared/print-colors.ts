// Neutral colors of the print and PDF stylesheet (main/pdf-export.ts). Diagrams
// rendered for print use the same values, so their own surfaces (label chips,
// chart panels) blend into the gray block they sit in.
export const PRINT_COLORS = {
  text: '#2C2C2C',
  heading: '#1A1A1A',
  link: '#3366AA',
  /** Background of code blocks and diagram blocks. */
  block: '#F0F0F0',
} as const;
