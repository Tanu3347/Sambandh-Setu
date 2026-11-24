/**
 * Sambandh Setu Design System v2.0 tokens (from "Design system.png").
 * Sambandh Setu brand palette: Rose Pink primary, Mint Green secondary.
 */
export const colors = {
  // Brand colours
  primary: '#D06D94',       // Rose Pink
  primaryHover: '#B6537D',  // Derived darker Rose Pink
  primarySoft: '#FAC6D6',   // Blush Pink
  primaryLine: '#E9A9BE',   // Derived pink border
  navy: '#243B36',          // Dark Charcoal Green

  // Backgrounds and surfaces
  bg: '#C0E1CF',            // Mint Green
  bgTint: '#DFEBE1',        // Sage Mint
  surface: '#FDF4F2',       // Soft Cream

  // Borders
  border: '#DFEBE1',
  borderStrong: '#4D6257',

  // Text
  text: '#243B36',
  textSoft: '#4D6257',
  muted: '#4D6257',
  faint: '#71877B',
  disabled: '#C6D3CA',

  // Semantic colours
  success: '#4D6257',
  successSoft: '#DFEBE1',
  warning: '#C69245',
  warningSoft: '#FBF3E6',
  danger: '#B55353',
  dangerStrong: '#D93B3B',
  dangerSoft: '#FCEDED',
  online: '#22C55E',

  overlay: 'rgba(36, 59, 54, 0.45)',

  // Section icon tints
  tint: {
    blue: { fg: '#4D6257', bg: '#DFEBE1' },
    purple: { fg: '#B6537D', bg: '#FAC6D6' },
    green: { fg: '#4D6257', bg: '#DFEBE1' },
    orange: { fg: '#B6537D', bg: '#FDF4F2' },
    pink: { fg: '#B6537D', bg: '#FAC6D6' },
    teal: { fg: '#4D6257', bg: '#DFEBE1' },
    amber: { fg: '#4D6257', bg: '#DFEBE1' },
    red: { fg: '#B55353', bg: '#FCEDED' },
    slate: { fg: '#243B36', bg: '#FDF4F2' },
  },
};
export type TintName = keyof typeof colors.tint;

/** 8px soft grid. */
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, x3: 40, x4: 48 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const radius = { sm: 8, input: 10, card: 12, lg: 16, xl: 20, pill: 999 };

export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const type = {
  hero: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 40, color: colors.text },
  display: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 28, color: colors.text },
  section: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24, color: colors.text },
  bodyLg: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22, color: colors.textSoft },
  label: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.text },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, color: colors.muted },
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 16, letterSpacing: 0.8, color: colors.muted, textTransform: 'uppercase' as const },
};

export const shadow = {
  card: { shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  elevated: { shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  modal: { shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 32, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  button: { shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
};

export const MIN_TAP = 44;

/** Breakpoints from "12 · Screen Templates": mobile 390, tablet 768, desktop 1280. */
export const breakpoints = { tablet: 768, desktop: 1024 };
