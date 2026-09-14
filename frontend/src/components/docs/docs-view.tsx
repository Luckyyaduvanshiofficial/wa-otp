'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import GithubSlugger from 'github-slugger';

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Walk the source once and slug every h2/h3 in document order. A dedicated
 * slugger instance, so two docs pages (or two renders) never share state.
 */
function extractHeadings(markdown: string): Heading[] {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
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
 * No utility classes live in the map below — every element is bare and Lumen
 * styles it by position, via the `.lm-prose` descendant rules. The three
 * overrides that survive are behaviour, not appearance: the heading ids the
 * table of contents and the observer key off, `rel` on outbound links, and the
 * scroll wrapper the wide tables need.
 */
export function DocsView({ markdown }: { markdown: string }) {
  /*
   * The id for a heading has to be the *same* string in the table of contents
   * and on the rendered element, or the observer watches nothing and every deep
   * link misses. Deriving both from one extraction pass guarantees that; a
   * shared mutable slugger would not, because it hands out `-1`, `-2` suffixes
   * on any second render of the same document.
   */
  const { headings, idFor } = React.useMemo(() => {
    const list = extractHeadings(markdown);
    const map = new Map<string, string>();
    for (const h of list) {
      if (!map.has(h.text)) map.set(h.text, h.id);
    }
    return { headings: list, idFor: map };
  }, [markdown]);

  const headingId = React.useCallback(
    (children: React.ReactNode): string => {
      const text = headingText(children);
      const known = idFor.get(text);
      if (known) return known;
      return new GithubSlugger().slug(text);
    },
    [idFor]
  );

  const [activeId, setActiveId] = React.useState<string>('');

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-10% 0px -75% 0px' }
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

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
        <nav>
          {headings.map((h) => (
            <a
              key={h.id}
              href={`#${h.id}`}
              data-level={h.level}
              data-active={activeId === h.id ? '' : undefined}
              aria-current={activeId === h.id ? 'true' : undefined}
            >
              {h.text}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}
