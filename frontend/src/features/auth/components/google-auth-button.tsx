'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClientResponseError } from 'pocketbase';
import { toast } from 'sonner';
import { LoadingButton } from '@/components/ui/loading-button';
import { pbUsers } from '@/lib/pb';

/**
 * "Continue with Google" via PocketBase OAuth2. The provider may not be
 * configured on the server yet — failures show a readable toast and never
 * block email/password auth.
 */
export function GoogleAuthButton({ label = 'Continue with Google' }: { label?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);

  const next = searchParams.get('next') ?? '/dashboard';

  async function handleGoogle() {
    setLoading(true);
    try {
      await pbUsers().authWithOAuth2({ provider: 'google' });
      toast.success('Signed in with Google');
      router.replace(next);
    } catch (e) {
      // Popup closed by the user — stay quiet.
      if (e instanceof ClientResponseError && e.status === 0) return;
      toast.error("Google sign-in isn't set up on the server yet. Use email & password for now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LoadingButton
      type='button'
      variant='outline'
      className='w-full'
      loading={loading}
      disabled={loading}
      onClick={handleGoogle}
    >
      <svg viewBox='0 0 24 24' className='size-4' aria-hidden='true'>
        <path
          fill='currentColor'
          d='M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10c5.35 0 9.25-3.67 9.25-9.09c0-1.15-.15-1.81-.15-1.81'
        />
      </svg>
      {label}
    </LoadingButton>
  );
}
