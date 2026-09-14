import { Suspense } from 'react';
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

export const metadata = { title: 'Reset password' };

export default function ResetPasswordPage() {
  return (
    <section className='lm-auth__card'>
      <div className='lm-auth__head'>
        <p className='lm-eyebrow'>reset</p>
        <h1 className='lm-auth__title'>choose a new password.</h1>
        <p className='lm-auth__lede'>pick something you have not used here before.</p>
      </div>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </section>
  );
}
