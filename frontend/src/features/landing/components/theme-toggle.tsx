'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Icons } from '@/components/icons';

/**
 * Colour-mode toggle for the public surfaces.
 *
 * `mounted` guards the icon and label: next-themes resolves the theme on the
 * client only, so the server render and the first client render have to agree
 * or React throws a hydration mismatch. Before mount we always offer "switch
 * to dark mode" with the moon — which is the truth, because the dark register
 * is what wins when no `html.light` class is present.
 *
 * The icon shows the destination, not the current state: a sun means "press
 * this to get light". The <button> carries the meaning for assistive tech and
 * the glyph is hidden from it (gate 33).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const next = mounted && resolvedTheme === 'dark' ? 'light' : 'dark';
  const label = `switch to ${next} mode`;

  return (
    <button
      type='button'
      className='lm-nav__icon'
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
    >
      {next === 'light' ? (
        <Icons.sun className='size-4' aria-hidden='true' />
      ) : (
        <Icons.moon className='size-4' aria-hidden='true' />
      )}
    </button>
  );
}
