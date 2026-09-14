'use client';

import * as React from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function CopyButton({
  value,
  className,
  children
}: {
  value: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can be blocked — fall back to a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      className={className}
      onClick={() => void copy()}
    >
      {copied ? <Icons.check className='size-3.5' /> : <Icons.copy className='size-3.5' />}
      {children}
    </Button>
  );
}
