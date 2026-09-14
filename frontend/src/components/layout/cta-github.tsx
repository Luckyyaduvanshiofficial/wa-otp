import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

/**
 * Header link to this project's repository. Env-driven, like every other GitHub
 * surface — renders nothing when `NEXT_PUBLIC_GITHUB_REPO` is unset, rather than
 * sending people to somebody else's repo.
 */
export default function CtaGithub() {
  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO;
  if (!repo) return null;

  return (
    <Button
      variant='ghost'
      size='sm'
      className='group hidden sm:flex'
      nativeButton={false}
      aria-label='View source on GitHub'
      render={
        <a
          aria-label='View source on GitHub'
          href={`https://github.com/${repo}`}
          rel='noopener noreferrer'
          target='_blank'
          className='text-muted-foreground hover:text-foreground transition-colors duration-300'
        />
      }
    >
      <Icons.github className='transition-transform duration-300 group-hover:animate-bounce' />
    </Button>
  );
}
