import { Icons } from '@/components/icons';

/**
 * The repository URL comes from `NEXT_PUBLIC_GITHUB_REPO`, so a fork points at
 * its own repo without a code change. Every GitHub surface on this page is
 * env-driven and renders **nothing** when the variable is unset. No placeholder
 * URL, no invented star count.
 */
export const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? '';

export const GITHUB_URL = GITHUB_REPO ? `https://github.com/${GITHUB_REPO}` : null;

/**
 * Live star count, cached for an hour. Returns null on any failure — an absent
 * number is honest, a fabricated one is not. Awaited by the page rather than by
 * the component below, so the component stays synchronous.
 */
export async function fetchStars(): Promise<number | null> {
  if (!GITHUB_REPO) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: unknown };
    const n = data?.stargazers_count;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

export function GithubStar({ stars }: { stars: number | null }) {
  if (!GITHUB_URL) return null;

  return (
    <a
      href={GITHUB_URL}
      target='_blank'
      rel='noreferrer'
      className='lm-nav__link lm-nav__link--gh'
      aria-label={stars === null ? 'github repository' : `${stars} stars on github`}
    >
      <Icons.github className='size-4' aria-hidden='true' />
      <span className='lm-nav__gh-count'>{stars === null ? 'github' : compact(stars)}</span>
    </a>
  );
}
