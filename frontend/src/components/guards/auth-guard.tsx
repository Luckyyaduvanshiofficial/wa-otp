'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { pb } from '@/lib/pb';

/**
 * Client-side route protection for /dashboard/*.
 *
 * The PocketBase auth token lives in localStorage, so the server (middleware /
 * layout) cannot see it — the check has to happen on the client after mount.
 * v1 limitation; documented in the README.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(false);

  React.useEffect(() => {
    if (!pb.authStore.isValid) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?next=${next}`);
      return;
    }
    setChecked(true);
  }, [router]);

  if (!checked) {
    return (
      <div className='flex h-[60vh] items-center justify-center'>
        <Spinner className='size-6' />
      </div>
    );
  }

  return <>{children}</>;
}
