'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAppForm } from '@/lib/form';
import { pb, pbUsers, type WaotpUser } from '@/lib/pb';
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
  const [user, setUser] = React.useState<WaotpUser | null>(
    (pb.authStore.record as unknown as WaotpUser | null) ?? null
  );
  const [saving, setSaving] = React.useState(false);

  const form = useAppForm({
    defaultValues: { name: user?.name ?? '' },
    validators: { onSubmit: profileSchema },
    onSubmit: async ({ value }) => {
      const currentId = pb.authStore.record?.id;
      if (!currentId) {
        toast.error('Session expired. Please sign in again.');
        return;
      }
      setSaving(true);
      try {
        await pbUsers().update(currentId, { name: value.name.trim() });
        await pbUsers().authRefresh();
        const updated = pb.authStore.record as unknown as WaotpUser | null;
        setUser(updated);
        toast.success('Profile updated');
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Could not update profile. Please try again.';
        toast.error(message);
      } finally {
        setSaving(false);
      }
    }
  });

  React.useEffect(() => {
    const record = pb.authStore.record as unknown as WaotpUser | null;
    if (record) {
      setUser(record);
      form.reset({ name: record.name ?? '' });
    }

    const unsub = pb.authStore.onChange((_token, model) => {
      const updated = model as unknown as WaotpUser | null;
      setUser(updated);
      if (updated) {
        form.reset({ name: updated.name ?? '' });
      }
    });

    return () => {
      unsub();
    };
  }, [form]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Signed in as {user?.email || '…'}</CardDescription>
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
  const [saving, setSaving] = React.useState(false);

  const form = useAppForm({
    defaultValues: { oldPassword: '', password: '', passwordConfirm: '' },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value }) => {
      const currentId = pb.authStore.record?.id;
      if (!currentId) {
        toast.error('Session expired. Please sign in again.');
        return;
      }
      setSaving(true);
      try {
        await pbUsers().update(currentId, {
          oldPassword: value.oldPassword,
          password: value.password,
          passwordConfirm: value.passwordConfirm
        });
        await pbUsers().authRefresh();
        toast.success('Password changed successfully');
        form.reset({ oldPassword: '', password: '', passwordConfirm: '' });
      } catch (err: unknown) {
        const pbErr = err as { data?: { message?: string }; message?: string };
        const msg =
          pbErr?.data?.message ||
          pbErr?.message ||
          'Could not change password — is your current password correct?';
        toast.error(msg);
      } finally {
        setSaving(false);
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
            <form.SubmitButton disabled={saving}>Change password</form.SubmitButton>
          </form>
        </form.AppForm>
      </CardContent>
    </Card>
  );
}

function AccountInfoCard() {
  const [user, setUser] = React.useState<WaotpUser | null>(
    (pb.authStore.record as unknown as WaotpUser | null) ?? null
  );

  React.useEffect(() => {
    const record = pb.authStore.record as unknown as WaotpUser | null;
    if (record) setUser(record);

    const unsub = pb.authStore.onChange((_token, model) => {
      setUser(model as unknown as WaotpUser | null);
    });
    return () => unsub();
  }, []);

  // `suspended` is enforced on the backend (every key the account owns stops
  // working), so showing a green badge for it would misreport a real outage.
  const suspended = user?.status === 'suspended';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Details</CardTitle>
        <CardDescription>Your operator credentials for this installation</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-3 text-sm'>
        <div className='flex items-center justify-between border-b pb-2'>
          <span className='text-muted-foreground'>Account ID</span>
          <span className='font-mono text-xs'>{user?.id || '—'}</span>
        </div>
        <div className='flex items-center justify-between border-b pb-2'>
          <span className='text-muted-foreground'>Registered Email</span>
          <span className='font-medium'>{user?.email || '—'}</span>
        </div>
        <div className='flex items-center justify-between border-b pb-2'>
          <span className='text-muted-foreground'>Role</span>
          <span className='bg-primary/10 text-primary rounded px-2 py-0.5 text-xs font-semibold uppercase'>
            Operator
          </span>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground'>Account Status</span>
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              suspended ? 'text-amber-500' : 'text-emerald-500'
            }`}
          >
            <span className={`size-2 rounded-full ${suspended ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {suspended ? 'Suspended' : 'Active'}
          </span>
        </div>
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
      <AccountInfoCard />
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
