'use client';

import * as React from 'react';

export interface TocHeading {
  id: string;
  text: string;
  level: 2 | 3;
}

export function DocsToc({ headings }: { headings: TocHeading[] }) {
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
  );
}
