import type { Theme } from '../lib/types';

/**
 * The stored preference is authoritative: the app never follows the OS.
 * `color-scheme` is set to match so form controls and scrollbars agree with it.
 */
const TOKENS: Record<Theme, Record<string, string>> = {
  light: {
    bg: '#F4F4F4',
    card: '#FFFFFF',
    card2: '#F7F7F7',
    ink: '#111111',
    muted: '#555555',
    muted2: '#777777',
    muted3: '#999999',
    line: '#E6E6E6',
    'line-strong': '#111111',
  },
  dark: {
    bg: '#2B2D30',
    card: '#3A3D41',
    card2: '#33363A',
    ink: '#F2F2F2',
    muted: '#C4C7CB',
    muted2: '#A9ADB2',
    muted3: '#8A8F95',
    line: '#4A4E53',
    'line-strong': '#D6D9DC',
  },
};

export function applyTheme(theme: Theme) {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(TOKENS[theme])) root.setProperty('--' + k, v);
  root.setProperty('color-scheme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#111111');
}
