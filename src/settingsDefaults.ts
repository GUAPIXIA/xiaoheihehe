import type { Community } from './data';
import type { Keybindings } from './Shortcuts';

export interface Preferences {
  theme: 'light' | 'dark' | 'system';
  zoom: number;
  exit: 'close' | 'tray';
  shortcuts: boolean;
  animations: boolean;
  showSidebar?: boolean;
  keybindings?: Keybindings;
  windowHeight?: number;
  windowWidth?: number;
}

export interface Filter {
  mode: 'all' | 'include' | 'exclude';
  included: number[];
  excluded: number[];
  unknown: boolean;
}

// Project defaults captured from the user's saved settings. Existing saved values take priority.
export const defaultPreferences: Preferences = {
  theme: 'system', zoom: 100, exit: 'close', shortcuts: true,
  animations: true, showSidebar: false, windowHeight: 1020, windowWidth: 640,
};

export const defaultCommunityFilter: Filter = {
  mode: 'exclude', included: [], excluded: [], unknown: true,
};
export const defaultBlockedKeywords: string[] = [];

export const defaultHomeCommunities: Community[] = [];
