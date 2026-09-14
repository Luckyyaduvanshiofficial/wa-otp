'use client';

import * as React from 'react';

/**
 * Copy-to-clipboard as a label swap — no toast, no confetti. The announcement
 * goes through a polite live region so a screen reader hears the same thing a
 * sighted user sees.
 *
 * `className` replaces the default hairline chip, which is how the docs page
 * turns this into its accent-pill primary action.
 */
export function CopyButton({
  value,
  label = 'copy',
  className = 'lm-copy'
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard blocked (insecure origin or a denied permission). The block
      // stays selectable, so there is nothing useful to say about it.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <>
      <button
        type='button'
        className={className}
        data-copied={copied ? '' : undefined}
        onClick={() => void copy()}
      >
        {copied ? 'copied' : label}
      </button>
      <span className='lm-sr' aria-live='polite'>
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </>
  );
}
