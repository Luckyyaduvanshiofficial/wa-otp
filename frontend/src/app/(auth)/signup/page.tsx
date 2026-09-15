import { Suspense } from 'react';
import Link from 'next/link';
import { SignupForm } from '@/features/auth/components/signup-form';
import { RedirectIfAuthed } from '@/components/guards/redirect-if-authed';

export const metadata = { title: 'Sign up' };

export default function SignupPage() {
  return (
    <RedirectIfAuthed>
      <section className='lm-auth__card'>
        <div className='lm-auth__head'>
          <p className='lm-eyebrow'>sign up</p>
          <h1 className='lm-auth__title'>start free.</h1>
          <p className='lm-auth__lede'>
            Instant developer access with unmetered Telegram OTP delivery and WhatsApp gateway.
          </p>
        </div>
        <Suspense>
          <SignupForm />
        </Suspense>
      </section>
      <p className='lm-auth__alt'>
        already have an account? <Link href='/login'>sign in</Link>
      </p>
    </RedirectIfAuthed>
  );
}
