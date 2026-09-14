import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GithubSlugger from 'github-slugger';
import { DocsToc, type TocHeading } from './docs-toc';

/**
 * Walk the source once and slug every h2/h3 in document order. A dedicated
 * slugger instance, so two docs pages (or two renders) never share state.
 */
function extractHeadings(markdown: string): TocHeading[] {
  const slugger = new GithubSlugger();
  const headings: TocHeading[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line.trim());
    if (match) {
      const text = match[2].replace(/`/g, '');
      headings.push({
        id: slugger.slug(text),
        text,
        level: match[1].length as 2 | 3
      });
    }
  }
  return headings;
}

/**
 * Flatten a heading's children to plain text, descending through elements.
 *
 * This has to agree *exactly* with the text `extractHeadings` slugged, or the
 * lookup below misses. Three headings in the reference wrap a word in backticks
 * (`### the `detail` field …`), which react-markdown renders as a nested <code>
 * element — a string-only flatten would silently drop the word and hand back a
 * different id than the one in the table of contents.
 */
function headingText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(headingText).join('');
  if (React.isValidElement(node)) {
    return headingText((node.props as { children?: React.ReactNode }).children);
  }
  return '';
}

/**
 * Server Component: renders full markdown at build time so no heavy markdown
 * parsers are sent in the client bundle. The interactive TOC observer is
 * handled by the client DocsToc component.
 */
export function DocsView({ markdown }: { markdown: string }) {
  const headings = extractHeadings(markdown);
  const idFor = new Map<string, string>();
  for (const h of headings) {
    if (!idFor.has(h.text)) idFor.set(h.text, h.id);
  }

  const headingId = (children: React.ReactNode): string => {
    const text = headingText(children);
    const known = idFor.get(text);
    if (known) return known;
    return new GithubSlugger().slug(text);
  };

  return (
    <div className='lm-docs__grid'>
      <article className='lm-prose'>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => <h2 id={headingId(children)}>{children}</h2>,
            h3: ({ children }) => <h3 id={headingId(children)}>{children}</h3>,
            a: ({ href, children }) => {
              const external = href?.startsWith('http') ?? false;
              return (
                <a
                  href={href}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noreferrer' : undefined}
                >
                  {children}
                </a>
              );
            },
            /* Scrolled rather than allowed to burst the article column — the
               error and limits tables are the widest content on the page. */
            table: ({ children }) => (
              <div className='lm-prose__scroll'>
                <table>{children}</table>
              </div>
            )
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>

      <aside className='lm-docs__toc' aria-labelledby='toc-label'>
        <p className='lm-docs__toc-label' id='toc-label'>
          on this page
        </p>
        <DocsToc headings={headings} />
      </aside>
    </div>
  );
}
