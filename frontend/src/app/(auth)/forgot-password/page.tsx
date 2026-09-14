import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';

export const metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <section className='lm-auth__card'>
      <div className='lm-auth__head'>
        <p className='lm-eyebrow'>reset</p>
        <h1 className='lm-auth__title'>forgot the password?</h1>
        <p className='lm-auth__lede'>
          give us the address you signed up with and we will email a reset link.
        </p>
      </div>
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </section>
  );
}
