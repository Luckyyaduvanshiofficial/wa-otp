'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAppForm } from '@/lib/form';
import { pbUsers } from '@/lib/pb';
import { SubmitButton } from '@/components/forms/submit-button';
import { GoogleAuthButton } from '@/features/auth/components/google-auth-button';
import { readableAuthError } from '@/features/auth/utils/pb-errors';
import { z } from 'zod';

const signupSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: z.email('Enter a valid email address'),
    password: z.string().min(8, 'Use at least 8 characters'),
    passwordConfirm: z.string().min(1, 'Confirm your password')
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Passwords do not match'
  });

export function SignupForm() {
  const router = useRouter();

  const form = useAppForm({
    defaultValues: { name: '', email: '', password: '', passwordConfirm: '' },
    validators: { onSubmit: signupSchema },
    onSubmit: async ({ value }) => {
      try {
        await pbUsers().create({
          email: value.email,
          password: value.password,
          passwordConfirm: value.passwordConfirm,
          name: value.name,
          // Set explicitly so a signup and a `scripts/seed_dev.py` account are
          // indistinguishable in the PocketBase back office. `plan` is what
          // /v1/usage reports; `status` is what resolve_api_key gates on.
          plan: 'free',
          status: 'active'
        });
      } catch (e) {
        // Nothing was created, so this is the only failure the user can act on:
        // a duplicate email, a password under the minimum length, a missing
        // collection. Report it and stay on the form.
        toast.error(readableAuthError(e));
        return;
      }

      // The account exists from here on. If the follow-up sign-in fails, do NOT
      // leave the user staring at a form that will now reject their email as
      // already taken — the credentials they just chose are valid, so send them
      // to /login instead of stranding an account nobody can reach.
      try {
        await pbUsers().authWithPassword(value.email, value.password);
        toast.success('Account created — welcome!');
        router.replace('/dashboard');
      } catch {
        toast.success('Account created — please sign in.');
        router.replace('/login');
      }
    }
  });

  return (
    <div className='grid gap-6'>
      <form.AppForm>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className='grid gap-4'
        >
          <form.AppField
            name='name'
            children={(field) => <field.TextField label='Name' placeholder='Your name' required />}
          />
          <form.AppField
            name='email'
            children={(field) => (
              <field.TextField label='Email' type='email' placeholder='you@example.com' required />
            )}
          />
          <form.AppField
            name='password'
            children={(field) => (
              <field.TextField
                label='Password'
                type='password'
                placeholder='At least 8 characters'
                description='Minimum 8 characters.'
                required
              />
            )}
          />
          <form.AppField
            name='passwordConfirm'
            children={(field) => (
              <field.TextField label='Confirm password' type='password' required />
            )}
          />
          <SubmitButton>Create account</SubmitButton>
        </form>
      </form.AppForm>

      <div className='relative'>
        <div className='absolute inset-0 flex items-center'>
          <span className='border-t' />
        </div>
        <div className='relative flex justify-center text-xs uppercase'>
          <span className='bg-background text-muted-foreground px-2'>or</span>
        </div>
      </div>

      <GoogleAuthButton label='Sign up with Google' />
    </div>
  );
}
