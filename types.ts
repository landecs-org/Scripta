
export interface Activity {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  linkedActivityIds: string[];
  archived: boolean;
  deleted: boolean;
  flatColor?: string;
}

export enum ThemeName {
  Lavender = 'Lavender',
  Sage = 'Sage',
  CosmicOrange = 'Cosmic Orange',
  Emberflare = 'Emberflare',
  Blue = 'Blue',
  Reddish = 'Reddish',
}

export type ThemeMode = 'light' | 'dark';

export interface AppSettings {
  theme: ThemeName;
  mode: ThemeMode;
  autoSave: boolean;
  reduceMotion: boolean;
  showWordCount: boolean;
  fontScale: number;
  cardDensity: 'comfortable' | 'compact';
  enableHaptics: boolean;
  enableAnalytics: boolean;
  livePreview: boolean;
}

export enum ViewName {
  Dashboard = 'Dashboard',
  Editor = 'Editor',
  Settings = 'Settings',
  Archive = 'Archive',
  Trash = 'Trash',
}
