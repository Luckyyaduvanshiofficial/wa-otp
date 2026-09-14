import { Suspense } from 'react';
import Link from 'next/link';
import { LoginForm } from '@/features/auth/components/login-form';
import { RedirectIfAuthed } from '@/components/guards/redirect-if-authed';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <RedirectIfAuthed>
      <section className='lm-auth__card'>
        <div className='lm-auth__head'>
          <p className='lm-eyebrow'>sign in</p>
          <h1 className='lm-auth__title'>welcome back.</h1>
          <p className='lm-auth__lede'>your api keys and your monthly quota, in one place.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
      <p className='lm-auth__alt'>
        no account? <Link href='/signup'>sign up</Link>
      </p>
    </RedirectIfAuthed>
  );
}
