import { CARD_COLORS } from '../constants';

export const getAdaptiveColor = (color: string | undefined, isDark: boolean): string => {
  if (!color || color === 'transparent') return 'transparent';
  if (!isDark) return color;

  // Manual mapping of the pastel palette to darker, high-contrast versions for dark mode
  const darkMap: Record<string, string> = {
    '#FCA5A5': '#450a0a', // Red-950/900 mix
    '#FDBA74': '#431407', // Orange-950
    '#FDE047': '#422006', // Yellow-950
    '#86EFAC': '#052e16', // Green-950
    '#93C5FD': '#172554', // Blue-950
    '#C4B5FD': '#2e1065', // Purple-950
    '#F0ABFC': '#500724', // Pink-950
    '#E5E7EB': '#1f2937', // Gray-800
  };

  return darkMap[color] || color;
};

// Helper to determine if we are in dark mode based on document class
export const isDarkMode = (): boolean => {
  return document.documentElement.classList.contains('dark');
};