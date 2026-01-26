import { ThemeName, ThemeMode, AppSettings } from './types';

export const THEMES: Record<ThemeName, { light: Record<string, string>; dark: Record<string, string> }> = {
  [ThemeName.Lavender]: {
    light: {
      '--color-primary': '#8B5CF6',
      '--color-primary-fg': '#FFFFFF',
      '--color-background': '#F3F4F6',
      '--color-surface': '#FFFFFF',
      '--color-surface-fg': '#1F2937',
    },
    dark: {
      '--color-primary': '#A78BFA',
      '--color-primary-fg': '#1F2937',
      '--color-background': '#111827',
      '--color-surface': '#1F2937',
      '--color-surface-fg': '#F3F4F6',
    },
  },
  [ThemeName.Sage]: {
    light: {
      '--color-primary': '#65A30D',
      '--color-primary-fg': '#FFFFFF',
      '--color-background': '#ECFCCB',
      '--color-surface': '#FFFFFF',
      '--color-surface-fg': '#1F2937',
    },
    dark: {
      '--color-primary': '#A3E635',
      '--color-primary-fg': '#1F2937',
      '--color-background': '#14532D',
      '--color-surface': '#14532D',
      '--color-surface-fg': '#ECFCCB',
    },
  },
  [ThemeName.CosmicOrange]: {
    light: {
      '--color-primary': '#EA580C',
      '--color-primary-fg': '#FFFFFF',
      '--color-background': '#FFEDD5',
      '--color-surface': '#FFFFFF',
      '--color-surface-fg': '#1F2937',
    },
    dark: {
      '--color-primary': '#FB923C',
      '--color-primary-fg': '#1F2937',
      '--color-background': '#431407',
      '--color-surface': '#7C2D12',
      '--color-surface-fg': '#FFEDD5',
    },
  },
  [ThemeName.Emberflare]: {
    light: {
      '--color-primary': '#BE185D',
      '--color-primary-fg': '#FFFFFF',
      '--color-background': '#FCE7F3',
      '--color-surface': '#FFFFFF',
      '--color-surface-fg': '#1F2937',
    },
    dark: {
      '--color-primary': '#F472B6',
      '--color-primary-fg': '#1F2937',
      '--color-background': '#500724',
      '--color-surface': '#831843',
      '--color-surface-fg': '#FCE7F3',
    },
  },
  [ThemeName.Blue]: {
    light: {
      '--color-primary': '#2563EB',
      '--color-primary-fg': '#FFFFFF',
      '--color-background': '#DBEAFE',
      '--color-surface': '#FFFFFF',
      '--color-surface-fg': '#1F2937',
    },
    dark: {
      '--color-primary': '#60A5FA',
      '--color-primary-fg': '#1F2937',
      '--color-background': '#172554',
      '--color-surface': '#1E3A8A',
      '--color-surface-fg': '#DBEAFE',
    },
  },
  [ThemeName.Reddish]: {
    light: {
      '--color-primary': '#DC2626',
      '--color-primary-fg': '#FFFFFF',
      '--color-background': '#FEE2E2',
      '--color-surface': '#FFFFFF',
      '--color-surface-fg': '#1F2937',
    },
    dark: {
      '--color-primary': '#F87171',
      '--color-primary-fg': '#1F2937',
      '--color-background': '#450A0A',
      '--color-surface': '#7F1D1D',
      '--color-surface-fg': '#FEE2E2',
    },
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: ThemeName.Lavender,
  mode: 'light',
  autoSave: true,
  reduceMotion: false,
  showWordCount: true,
  fontScale: 16,
  cardDensity: 'comfortable',
  enableHaptics: true,
  enableAnalytics: false,
};

export const CARD_COLORS = [
  'transparent',
  '#FCA5A5', // Red
  '#FDBA74', // Orange
  '#FDE047', // Yellow
  '#86EFAC', // Green
  '#93C5FD', // Blue
  '#C4B5FD', // Purple
  '#F0ABFC', // Pink
  '#E5E7EB', // Gray
];