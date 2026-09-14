'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAppForm } from '@/lib/form';
import { pb, pbUsers } from '@/lib/pb';
import { SubmitButton } from '@/components/forms/submit-button';
import { ThemeModeToggle } from '@/components/themes/theme-mode-toggle';
import { ThemeSelector } from '@/components/themes/theme-selector';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(64, 'Too long')
});

function ProfileCard() {
  const record = pb.authStore.record;
  const [saving, setSaving] = React.useState(false);
  const [email, setEmail] = React.useState('');

  React.useEffect(() => {
    setEmail((pb.authStore.record?.email as string | undefined) ?? '');
  }, []);

  const form = useAppForm({
    defaultValues: { name: (record?.name as string | undefined) ?? '' },
    validators: { onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      if (!record?.id) return;
      setSaving(true);
      try {
        await pbUsers().update(record.id, { name: value.name });
        await pbUsers().authRefresh();
        toast.success('Profile updated');
      } catch {
        toast.error('Could not update profile. Please try again.');
      } finally {
        setSaving(false);
      }
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Signed in as {email || '…'}</CardDescription>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className='grid max-w-sm gap-4'
          >
            <form.AppField
              name='name'
              children={(field) => (
                <field.TextField label='Name' placeholder='Your name' required />
              )}
            />
            <form.SubmitButton disabled={saving}>Save changes</form.SubmitButton>
          </form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Current password is required'),
    password: z.string().min(8, 'Use at least 8 characters'),
    passwordConfirm: z.string().min(1, 'Confirm your new password')
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Passwords do not match'
  });

function PasswordCard() {
  const record = pb.authStore.record;

  const form = useAppForm({
    defaultValues: { oldPassword: '', password: '', passwordConfirm: '' },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value }) => {
      if (!record?.id) return;
      try {
        await pbUsers().update(record.id, {
          oldPassword: value.oldPassword,
          password: value.password,
          passwordConfirm: value.passwordConfirm
        });
        toast.success('Password changed');
        form.reset({ oldPassword: '', password: '', passwordConfirm: '' });
      } catch {
        toast.error('Could not change password — is the current password correct?');
      }
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Enter your current password to confirm the change.</CardDescription>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className='grid max-w-sm gap-4'
          >
            <form.AppField
              name='oldPassword'
              children={(field) => (
                <field.TextField label='Current password' type='password' required />
              )}
            />
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
            <SubmitButton>Change password</SubmitButton>
          </form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

function AppearanceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Theme mode and colour theme</CardDescription>
      </CardHeader>
      <CardContent className='flex items-center gap-3'>
        <ThemeModeToggle />
        <ThemeSelector />
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  const router = useRouter();

  async function signOut() {
    pb.authStore.clear();
    toast.success('Signed out');
    router.push('/login');
  }

  return (
    <div className='grid max-w-3xl gap-4'>
      <ProfileCard />
      <PasswordCard />
      <AppearanceCard />
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Sign out of the dashboard on this device</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant='outline' onClick={() => void signOut()}>
            <Icons.logout className='size-4' />
            Sign out
          </Button>
        </CardContent>
      </Card>
      <Separator className='my-2' />
    </div>
  );
}
