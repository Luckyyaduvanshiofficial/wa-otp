/**
 * Default theme that loads when no user preference is set.
 *
 * `lumen` is the product's primary design system — the same palette the
 * landing page and auth screens render through `.lm` — so a developer
 * signing up and landing in the dashboard never crosses a visual seam.
 * Any value here must also exist in THEMES below, or `layout.tsx` will
 * reject the cookie and fall back to it anyway.
 */
export const DEFAULT_THEME = 'lumen';

export const THEMES = [
  {
    name: 'Lumen',
    value: 'lumen'
  },
  {
    name: 'Claude',
    value: 'claude'
  },
  {
    name: 'Discord',
    value: 'discord'
  },
  {
    name: 'Supabase',
    value: 'supabase'
  },
  {
    name: 'Vercel',
    value: 'vercel'
  },
  {
    name: 'Mono',
    value: 'mono'
  },
  {
    name: 'Notebook',
    value: 'notebook'
  },
  {
    name: 'Light Green',
    value: 'light-green'
  },
  {
    name: 'Zen',
    value: 'zen'
  },
  {
    name: 'Astro Vista',
    value: 'astro-vista'
  },
  {
    name: 'WhatsApp',
    value: 'whatsapp'
  }
];
