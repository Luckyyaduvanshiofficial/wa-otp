/**
 * Default theme that loads when no user preference is set.
 * WhatsApp is the on-brand default — green, and the channel the product is
 * named after. Any value here must also exist in THEMES below, or
 * `layout.tsx` will reject the cookie and fall back to it anyway.
 */
export const DEFAULT_THEME = 'whatsapp';

export const THEMES = [
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
