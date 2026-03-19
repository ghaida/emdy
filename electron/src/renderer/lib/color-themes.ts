export type ColorThemeName = 'warm' | 'cool' | 'fresh' | 'neon';

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

// Fresh: Playful Precision — bright orange accent, electric blue, cream/navy backgrounds
export const fresh: ColorTheme = {
  light: {
    bgPrimary: '#FFFBF0',
    bgContent: '#FFFFFF',
    bgCode: '#FFF3E0',
    bgSecondary: '#FFF0D6',
    bgTertiary: '#FFE4B8',
    border: '#E8D8C0',
    borderSubtle: '#D8C8B0',
    textMuted: '#887860',
    textSecondary: '#5C4E38',
    textPrimary: '#1A1A1A',
    textHeading: '#0A1628',
    accent: '#FF6B00',
    accentHover: '#E05E00',
    success: '#3A8A4A',
    info: '#2B5CE6',
    error: '#D42B2B',
    codeKeyword: '#2B5CE6',       // electric blue for keywords
    codeString: '#FF6B00',        // bright orange for strings
    codeComment: '#8A8478',
    codeNumber: '#9B5DE5',        // purple for numbers
    codePunctuation: '#5C564A',
    codeFunction: '#3A8A4A',      // green for functions
    minimapHeading: '#FF6B00',
    minimapText: '#2B5CE6',
    minimapCode: '#9B5DE5',
    minimapBlockquote: '#FFD23F',
    minimapTable: '#3A8A4A',
    minimapTableHeader: '#2A6A3A',
    minimapUl: '#FF6B00',
    minimapOl: '#2B5CE6',
    minimapImage: '#D42B2B',
    minimapHr: '#D4CFC4',
    minimapLink: '#2B5CE6',
    minimapViewport: '#FF6B00',
  },
  dark: {
    bgPrimary: '#0A1628',
    bgContent: '#111E32',
    bgCode: '#081020',
    bgSecondary: '#0E1A2E',
    bgTertiary: '#162438',
    border: '#1E3050',
    borderSubtle: '#2A3E5E',
    textMuted: '#6A7A94',
    textSecondary: '#8A9AB4',
    textPrimary: '#D8DDE8',
    textHeading: '#F5F2EB',
    accent: '#FF6B00',
    accentHover: '#FF8530',
    success: '#5ABE6A',
    info: '#5A8EFF',
    error: '#F05050',
    codeKeyword: '#5A8EFF',       // bright blue for keywords
    codeString: '#FF6B00',        // bright orange for strings
    codeComment: '#6A7A94',
    codeNumber: '#B47EFF',        // brighter purple for numbers
    codePunctuation: '#8A9AB4',
    codeFunction: '#5ABE6A',      // green for functions
    minimapHeading: '#FF6B00',
    minimapText: '#5A8EFF',
    minimapCode: '#B47EFF',
    minimapBlockquote: '#FFD23F',
    minimapTable: '#5ABE6A',
    minimapTableHeader: '#3A9A4A',
    minimapUl: '#FF8530',
    minimapOl: '#5A8EFF',
    minimapImage: '#F05050',
    minimapHr: '#2A3E5E',
    minimapLink: '#5A8EFF',
    minimapViewport: '#FF6B00',
  },
};

// Neon: cyberpunk/neon — hot pink accent, electric cyan, deep purple-black darks
export const neon: ColorTheme = {
  light: {
    bgPrimary: '#F5F5F4',
    bgContent: '#FFFFFF',
    bgCode: '#EDEDEC',
    bgSecondary: '#EDEDEC',
    bgTertiary: '#E3E3E2',
    border: '#CCCCC8',
    borderSubtle: '#B8B8B4',
    textMuted: '#848480',
    textSecondary: '#585854',
    textPrimary: '#222220',
    textHeading: '#141414',
    accent: '#00B8D4',             // electric cyan
    accentHover: '#009AB0',
    success: '#00CC66',            // neon green
    info: '#00C8E0',               // electric cyan
    error: '#FF2D55',              // neon red
    codeKeyword: '#00B8D4',        // cyan keywords
    codeString: '#D428A0',         // pink strings
    codeComment: '#848480',
    codeNumber: '#8030C0',         // purple
    codePunctuation: '#585854',
    codeFunction: '#00A050',       // neon green functions
    minimapHeading: '#00B8D4',
    minimapText: '#D428A0',
    minimapCode: '#8030C0',
    minimapBlockquote: '#00CC66',
    minimapTable: '#E06000',
    minimapTableHeader: '#C05000',
    minimapUl: '#D428A0',
    minimapOl: '#00B8D4',
    minimapImage: '#FF2D55',
    minimapHr: '#00C8E0',
    minimapLink: '#00B8D4',
    minimapViewport: '#D428A0',
  },
  dark: {
    bgPrimary: '#0D0A14',
    bgContent: '#1A1724',
    bgCode: '#100C1A',
    bgSecondary: '#161220',
    bgTertiary: '#201C2C',
    border: '#2E2840',
    borderSubtle: '#3C3454',
    textMuted: '#7A6E94',
    textSecondary: '#A098B8',
    textPrimary: '#D8D0E8',
    textHeading: '#F2E8FA',
    accent: '#FF36B0',             // bright neon pink
    accentHover: '#FF60C4',
    success: '#30F080',            // bright neon green
    info: '#20E0FF',               // bright electric cyan
    error: '#FF4070',              // bright neon red
    codeKeyword: '#FF36B0',        // neon pink keywords
    codeString: '#20E0FF',         // cyan strings
    codeComment: '#7A6E94',
    codeNumber: '#B060FF',         // bright purple
    codePunctuation: '#A098B8',
    codeFunction: '#A050FF',       // vivid purple functions
    minimapHeading: '#FF36B0',
    minimapText: '#A080E0',
    minimapCode: '#20E0FF',
    minimapBlockquote: '#30F080',
    minimapTable: '#B060FF',
    minimapTableHeader: '#8840E0',
    minimapUl: '#FF8030',
    minimapOl: '#FF36B0',
    minimapImage: '#FF4070',
    minimapHr: '#20E0FF',
    minimapLink: '#FF36B0',
    minimapViewport: '#A050FF',
  },
};

export const themes: Record<ColorThemeName, ColorTheme> = { warm, cool, fresh, neon };
