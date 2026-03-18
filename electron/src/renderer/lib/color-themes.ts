export type ColorThemeName = 'warm' | 'cool';

export interface ColorScale {
  bgPrimary: string;
  bgContent: string;
  bgCode: string;
  bgSecondary: string;
  bgTertiary: string;
  border: string;
  borderSubtle: string;
  textMuted: string;
  textSecondary: string;
  textPrimary: string;
  textHeading: string;
  accent: string;
  accentHover: string;
  success: string;
  info: string;
  error: string;
  codeKeyword: string;
  codeString: string;
  codeComment: string;
  codeNumber: string;
  codePunctuation: string;
  codeFunction: string;
  minimapHeading: string;
  minimapText: string;
  minimapCode: string;
  minimapBlockquote: string;
  minimapTable: string;
  minimapTableHeader: string;
  minimapUl: string;
  minimapOl: string;
  minimapImage: string;
  minimapHr: string;
  minimapLink: string;
  minimapViewport: string;
}

export interface ColorTheme {
  light: ColorScale;
  dark: ColorScale;
}

// Warm: Dieter Rams / Braun — orange accent, olive green prominent
export const warm: ColorTheme = {
  light: {
    bgPrimary: '#F5F3EF',
    bgContent: '#FFFFFF',
    bgCode: '#ECEAE5',
    bgSecondary: '#ECEAE5',
    bgTertiary: '#E2DFD9',
    border: '#C8C4BC',
    borderSubtle: '#B8B4AC',
    textMuted: '#8A8680',
    textSecondary: '#6B6862',
    textPrimary: '#3A3732',
    textHeading: '#222019',
    accent: '#D47418',
    accentHover: '#B86210',
    success: '#5F6B2D',
    info: '#5A6D7A',
    error: '#BF1B1B',
    codeKeyword: '#5F6B2D',      // green for keywords
    codeString: '#D47418',        // orange for strings
    codeComment: '#8A8680',
    codeNumber: '#5A6D7A',
    codePunctuation: '#6B6862',
    codeFunction: '#5F6B2D',      // green for functions
    minimapHeading: '#5F6B2D',
    minimapText: '#BF7C2A',
    minimapCode: '#D47418',
    minimapBlockquote: '#8FA83E',
    minimapTable: '#5A6D7A',
    minimapTableHeader: '#3E5060',
    minimapUl: '#D4A030',
    minimapOl: '#5F6B2D',
    minimapImage: '#BF1B1B',
    minimapHr: '#D47418',
    minimapLink: '#D47418',
    minimapViewport: '#5F6B2D',
  },
  dark: {
    bgPrimary: '#1C1A16',
    bgContent: '#24211C',
    bgCode: '#16130F',
    bgSecondary: '#242118',
    bgTertiary: '#2C2920',
    border: '#3A362C',
    borderSubtle: '#4A453A',
    textMuted: '#7A7268',
    textSecondary: '#9C9488',
    textPrimary: '#D9D2C6',
    textHeading: '#F5F2ED',
    accent: '#D47418',
    accentHover: '#E88420',
    success: '#8FA83E',
    info: '#7A9BAD',
    error: '#E04545',
    codeKeyword: '#8FA83E',       // green for keywords
    codeString: '#D47418',        // orange for strings
    codeComment: '#7A7268',
    codeNumber: '#7A9BAD',
    codePunctuation: '#9C9488',
    codeFunction: '#8FA83E',      // green for functions
    minimapHeading: '#8FA83E',
    minimapText: '#D47418',
    minimapCode: '#BF7C2A',
    minimapBlockquote: '#8FA83E',
    minimapTable: '#7A9BAD',
    minimapTableHeader: '#5A7A90',
    minimapUl: '#D4A030',
    minimapOl: '#8FA83E',
    minimapImage: '#E04545',
    minimapHr: '#D47418',
    minimapLink: '#D47418',
    minimapViewport: '#8FA83E',
  },
};

// Cool: neutral gray backgrounds, slate blue accent, green for code/success
export const cool: ColorTheme = {
  light: {
    bgPrimary: '#F5F5F4',
    bgContent: '#FFFFFF',
    bgCode: '#EBEBEA',
    bgSecondary: '#EBEBEA',
    bgTertiary: '#E1E1E0',
    border: '#C6C6C4',
    borderSubtle: '#B6B6B4',
    textMuted: '#868684',
    textSecondary: '#646462',
    textPrimary: '#343432',
    textHeading: '#1C1C1A',
    accent: '#4A7196',            // slate blue
    accentHover: '#3C5E80',
    success: '#4A7A50',
    info: '#5A7486',
    error: '#B83030',
    codeKeyword: '#4A7196',       // blue keywords
    codeString: '#4A7A50',        // green strings
    codeComment: '#868684',
    codeNumber: '#5A7486',
    codePunctuation: '#646462',
    codeFunction: '#4A7A50',      // green functions
    minimapHeading: '#3A8A6A',
    minimapText: '#7A9AAA',
    minimapCode: '#5A7A9A',
    minimapBlockquote: '#3A8A6A',
    minimapTable: '#6A5A8A',
    minimapTableHeader: '#50407A',
    minimapUl: '#2A7A8A',
    minimapOl: '#5A6AAA',
    minimapImage: '#AA4060',
    minimapHr: '#5A7A9A',
    minimapLink: '#2A7A8A',
    minimapViewport: '#3A8A6A',
  },
  dark: {
    bgPrimary: '#1A1A19',
    bgContent: '#222224',
    bgCode: '#151517',
    bgSecondary: '#212120',
    bgTertiary: '#282827',
    border: '#363634',
    borderSubtle: '#42423E',
    textMuted: '#74746E',
    textSecondary: '#94948E',
    textPrimary: '#D0D0CA',
    textHeading: '#ECECEA',
    accent: '#6A9EC4',            // slate blue
    accentHover: '#80B0D4',
    success: '#6AAE70',
    info: '#6A8EA4',
    error: '#D45050',
    codeKeyword: '#6A9EC4',       // blue keywords
    codeString: '#6AAE70',        // green strings
    codeComment: '#74746E',
    codeNumber: '#6A8EA4',
    codePunctuation: '#94948E',
    codeFunction: '#6AAE70',      // green functions
    minimapHeading: '#50C080',
    minimapText: '#5A8AAA',
    minimapCode: '#4A7AA0',
    minimapBlockquote: '#50C080',
    minimapTable: '#8A70B0',
    minimapTableHeader: '#6A50A0',
    minimapUl: '#40A0B0',
    minimapOl: '#6A80C0',
    minimapImage: '#C05070',
    minimapHr: '#5A8AAA',
    minimapLink: '#40A0B0',
    minimapViewport: '#50C080',
  },
};

export const themes: Record<ColorThemeName, ColorTheme> = { warm, cool };
