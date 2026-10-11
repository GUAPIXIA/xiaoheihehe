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
  theme: 'system', zoom: 125, exit: 'close', shortcuts: true,
  animations: true, showSidebar: false, windowHeight: 1020, windowWidth: 600,
};

export const defaultCommunityFilter: Filter = {
  mode: 'exclude', included: [], excluded: [], unknown: true,
};
export const defaultBlockedKeywords: string[] = [];

export const defaultHomeCommunities: Community[] = [
  {
    id: 425422, name: 'Steam', short: 'S', color: '#5c6c85', members: '社区',
    icon: 'https://cdn.max-c.com/mobile/app/icon/ccb3c23e275bef48aa7863ac5609ce8b.png',
  },
  {
    id: 43, name: 'CS2', short: 'C', color: '#5c6c85', members: '社区',
    icon: 'https://imgheybox.max-c.com/oa/2023/09/28/17490d786f2942df8ea361c907c49d9c.jpeg',
  },
  {
    id: 22946, name: '火影忍者', short: '火', color: '#5c6c85', members: '社区',
    icon: 'https://cdn.max-c.com/mobile/app/icon/4c36cbe52c6cfe2b9717b2a567dc5030.png',
  },
];
