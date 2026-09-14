'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAppForm } from '@/lib/form';
import { pbUsers } from '@/lib/pb';
import { SubmitButton } from '@/components/forms/submit-button';
import { readableAuthError } from '@/features/auth/utils/pb-errors';
import { z } from 'zod';

const resetSchema = z
  .object({
    password: z.string().min(8, 'Use at least 8 characters'),
    passwordConfirm: z.string().min(1, 'Confirm your password')
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Passwords do not match'
  });

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const form = useAppForm({
    defaultValues: { password: '', passwordConfirm: '' },
    validators: { onSubmit: resetSchema },
    onSubmit: async ({ value }) => {
      try {
        await pbUsers().confirmPasswordReset(token, value.password, value.passwordConfirm);
        toast.success('Password updated — sign in with your new password');
        router.replace('/login');
      } catch (e) {
        toast.error(
          token
            ? readableAuthError(e)
            : 'This link is missing its token. Use the link from the reset email.'
        );
      }
    }
  });

  if (!token) {
    return (
      <div className='grid gap-3 text-center text-sm'>
        <p>
          This link looks incomplete. Open the reset link from your email, or request a new one.
        </p>
        <Link href='/forgot-password' className='text-primary underline-offset-4 hover:underline'>
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form.AppForm>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className='grid gap-4'
      >
        <form.AppField
          name='password'
          children={(field) => (
            <field.TextField
              label='New password'
              type='password'
              placeholder='At least 8 characters'
              required
            />
          )}
        />
        <form.AppField
          name='passwordConfirm'
          children={(field) => (
            <field.TextField label='Confirm new password' type='password' required />
          )}
        />
        <SubmitButton>Set new password</SubmitButton>
      </form>
    </form.AppForm>
  );
}
