import { NavGroup } from '@/types';

/**
 * Sidebar + Cmd+K navigation for the WA OTP dashboard.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Platform',
    items: [
      {
        title: 'Overview',
        url: '/dashboard',
        icon: 'dashboard',
        shortcut: ['d', 'o'],
        isActive: false,
        items: []
      },
      {
        title: 'API Keys',
        url: '/dashboard/keys',
        icon: 'key',
        shortcut: ['d', 'k'],
        isActive: false,
        items: []
      },
      {
        title: 'OTP Tester',
        url: '/dashboard/tester',
        icon: 'flask',
        shortcut: ['d', 't'],
        isActive: false,
        items: []
      }
    ]
  },
  {
    label: 'Resources',
    items: [
      {
        title: 'Documentation',
        url: '/docs',
        icon: 'book',
        shortcut: ['d', 'd'],
        isActive: false,
        items: []
      }
    ]
  },
  {
    label: 'Account',
    items: [
      {
        title: 'Settings',
        url: '/dashboard/settings',
        icon: 'settings',
        shortcut: ['d', 's'],
        isActive: false,
        items: []
      }
    ]
  }
];
