'use client';

import * as React from 'react';
import { Icons } from '@/components/icons';
import { GITHUB_URL, GITHUB_REPO, compact } from '@/features/landing/components/github-star';

export function LiveStarsBadge({ initialStars }: { initialStars?: number | null }) {
  const [stars, setStars] = React.useState<number | null>(initialStars ?? null);

  React.useEffect(() => {
    if (stars !== null) return;
    let mounted = true;
    fetch(`https://api.github.com/repos/${GITHUB_REPO}`)
      .then((res) => res.json())
      .then((data: { stargazers_count?: unknown }) => {
        if (mounted && typeof data?.stargazers_count === 'number') {
          setStars(data.stargazers_count);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [stars]);

  return (
    <a
      href={GITHUB_URL}
      target='_blank'
      rel='noreferrer'
      className='inline-flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[var(--color-paper-elevated)] px-3 py-1 text-xs font-medium text-[var(--color-ink)] shadow-xs transition-all hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
    >
      <span className='flex size-2 rounded-full bg-amber-500 animate-pulse' />
      <Icons.github className='size-3.5' />
      <span>GitHub Stars</span>
      <span className='rounded bg-[var(--rule)] px-1.5 py-0.2 text-[11px] font-mono font-semibold'>
        {stars !== null ? compact(stars) : 'Star'}
      </span>
    </a>
  );
}
