import type { Theme } from '../lib/types';

/**
 * The stored preference is authoritative: the app never follows the OS.
 * `color-scheme` is set to match so form controls and scrollbars agree with it.
 */
const TOKENS: Record<Theme, Record<string, string>> = {
  light: {
    bg: '#F4F4F1',
    card: '#FFFFFF',
    card2: '#FAFAF7',
    ink: '#111111',
    muted: '#4A4A46',
    muted2: '#5A5A56',
    muted3: '#8A8B86',
    line: '#E2E1DB',
    'line-strong': '#111111',
    // The dark strip the glance bar and the top bar sit on, in both themes.
    strip: '#111111',
    'on-strip': '#FFFFFF',
    'on-strip-muted': '#B4B4AE',
    // Brand amber. Fine on the strip; never a data mark on a light ground,
    // where it measures 1.56:1 against the surface.
    accent: '#FFC400',
    'on-accent': '#111111',
    // Scorebook blue, for section labels and links.
    blue: '#30619F',
    // Chart marks. Validated for this surface: lightness band, chroma floor,
    // CVD separation and 3:1 contrast all pass. See docs/DESIGN.md.
    'data-a': '#B5790A',
    'data-b': '#30619F',
    'data-flat': '#B9B7AE',
    'data-grid': '#EDECE6',
  },
  dark: {
    bg: '#1A1A19',
    card: '#232322',
    card2: '#1E1E1D',
    ink: '#F2F2F0',
    muted: '#C4C5C0',
    muted2: '#A9AAA5',
    muted3: '#858682',
    line: '#302F2D',
    'line-strong': '#D6D7D4',
    strip: '#000000',
    'on-strip': '#FFFFFF',
    'on-strip-muted': '#A8A8A3',
    accent: '#FFC400',
    'on-accent': '#111111',
    blue: '#7FA8DC',
    // Dark is its own set, stepped and validated against the dark surface
    // rather than flipped from light.
    'data-a': '#C08818',
    'data-b': '#5391D6',
    'data-flat': '#55554F',
    'data-grid': '#2A2A28',
  },
};

export function applyTheme(theme: Theme) {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(TOKENS[theme])) root.setProperty('--' + k, v);
  root.setProperty('color-scheme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#111111');
}
