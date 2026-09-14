import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import { DocsView } from '@/components/docs/docs-view';
import { CopyButton } from '@/features/landing/components/copy-button';
import { GITHUB_URL } from '@/features/landing/components/github-star';
import { SiteNav } from '@/features/landing/components/site-nav';

export const metadata: Metadata = {
  title: 'docs — wa otp integration reference',
  description:
    'the whole wa otp contract in one file. copy the agent briefing straight into your agent, or fetch it at /agent-briefing.md — two http calls, every field, every error code and the retry decision for each.'
};

/*
 * One file, two jobs: `public/` makes it fetchable at /agent-briefing.md, and
 * reading it here lets the page show the exact payload the button copies. If
 * they were two files they would eventually disagree.
 */
const BRIEFING_PATH = '/agent-briefing.md';

export default function DocsPage() {
  const markdown = fs.readFileSync(path.join(process.cwd(), 'content', 'docs.md'), 'utf8');
  const briefing = fs.readFileSync(
    path.join(process.cwd(), 'public', 'agent-briefing.md'),
    'utf8'
  );

  return (
    <div className='lm lm-shell'>
      <div className='lm-blueprint' aria-hidden='true' />

      <SiteNav />

      <header className='lm-docs__hero'>
        <div className='lm-head'>
          <p className='lm-eyebrow'>docs · v0.1.0</p>
          <h1 className='lm-display'>
            <em>hand</em> this page to your agent.
          </h1>
          <p className='lm-lede'>
            two http calls, one self-contained briefing. copy it into your agent, or point the agent
            at the raw file.
          </p>
        </div>
        <div className='lm-actions'>
          <CopyButton
            value={briefing}
            label='copy for agent'
            className='lm-copy lm-copy--primary'
          />
          <a href={BRIEFING_PATH} className='lm-actions__ghost'>
            raw markdown
          </a>
        </div>
      </header>

      <main>
        <section className='lm-section' aria-labelledby='briefing-h'>
          <div className='lm-head'>
            <p className='lm-eyebrow'>01 · the briefing</p>
            <h2 className='lm-h2' id='briefing-h'>
              everything an agent needs, in one file.
            </h2>
            <p className='lm-lede'>
              this is exactly what the button copies and what {BRIEFING_PATH} serves, shown in full
              so nothing about the payload is a surprise.
            </p>
          </div>
          <pre className='lm-code lm-code--tall'>{briefing}</pre>
        </section>

        <section className='lm-section' aria-labelledby='reference-h'>
          <div className='lm-head'>
            <p className='lm-eyebrow'>02 · full reference</p>
            <h2 className='lm-h2' id='reference-h'>
              the same contract, with the reasoning.
            </h2>
          </div>
          <DocsView markdown={markdown} />
        </section>
      </main>

      <footer className='lm-foot'>
        <p className='lm-foot__stmt'>two calls. one file. no surprises.</p>
        <div className='lm-foot__meta'>
          <span>wa otp</span>
          <span>built in india</span>
          <span>open source</span>
          {GITHUB_URL ? (
            <a href={GITHUB_URL} target='_blank' rel='noreferrer'>
              github
            </a>
          ) : null}
          <Link href='/'>home</Link>
        </div>
      </footer>
    </div>
  );
}
