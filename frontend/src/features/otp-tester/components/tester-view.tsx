'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  sendOtp,
  verifyOtp,
  errorMessage,
  type SendOtpResult,
  type VerifyOtpResult
} from '@/lib/api';
import { takePlaintextKey } from '@/lib/key-handoff';
import { CopyButton } from '@/components/copy-button';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingButton } from '@/components/ui/loading-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

function JsonBlock({ data }: { data: unknown }) {
  const text = JSON.stringify(data, null, 2);
  return (
    <div className='bg-muted/60 relative rounded-lg border pr-20'>
      <pre className='overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed'>{text}</pre>
      <CopyButton value={text} className='absolute top-2 right-2 h-7 px-2 text-xs' />
    </div>
  );
}

export function TesterView() {
  // Send form state
  const [apiKey, setApiKey] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [channel, setChannel] = React.useState<'whatsapp' | 'telegram'>('whatsapp');
  const [customCode, setCustomCode] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sendResult, setSendResult] = React.useState<SendOtpResult | null>(null);
  const [sendError, setSendError] = React.useState<Record<string, unknown> | null>(null);

  // Verify form state
  const [verifyPhone, setVerifyPhone] = React.useState('');
  const [verifyCode, setVerifyCode] = React.useState('');
  const [verifying, setVerifying] = React.useState(false);
  const [verifyResult, setVerifyResult] = React.useState<VerifyOtpResult | null>(null);
  const [verifyError, setVerifyError] = React.useState<Record<string, unknown> | null>(null);

  // Prefill the key from a key created this session (sessionStorage handoff).
  React.useEffect(() => {
    const handoff = takePlaintextKey();
    if (handoff) setApiKey(handoff.api_key);
  }, []);

  const codeInvalid = customCode !== '' && !/^[A-Za-z0-9]{4,10}$/.test(customCode);

  async function handleSend() {
    if (!apiKey.trim()) {
      toast.error('Paste your API key first (create one on the Keys page).');
      return;
    }
    if (!/^91\d{10}$/.test(phone.trim())) {
      toast.error('Enter the phone in E.164 format without +, e.g. 919876543210.');
      return;
    }
    if (codeInvalid) {
      toast.error('Custom code must be 4–10 letters/numbers.');
      return;
    }
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      const result = await sendOtp(apiKey.trim(), {
        to: phone.trim(),
        channel,
        ...(customCode.trim() ? { code: customCode.trim() } : {})
      });
      setSendResult(result);
      toast.success(`OTP sent on ${channel}`);
    } catch (e) {
      setSendError({ ok: false, ...(e instanceof Error ? { error: e.message } : {}) });
      toast.error(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (!verifyPhone.trim() || !verifyCode.trim()) {
      toast.error('Enter the phone and the code the user received.');
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    setVerifyError(null);
    try {
      const result = await verifyOtp(apiKey.trim(), {
        to: verifyPhone.trim(),
        code: verifyCode.trim()
      });
      setVerifyResult(result);
      if (result.verified) toast.success('Code verified ✓');
      else
        toast.error(
          `Wrong code${result.attempts_left !== undefined ? ` — ${result.attempts_left} attempt(s) left` : ''}`
        );
    } catch (e) {
      setVerifyError({ ok: false, ...(e instanceof Error ? { error: e.message } : {}) });
      toast.error(errorMessage(e));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className='grid gap-4'>
      <Alert>
        <Icons.info />
        <AlertTitle>Sandbox mode</AlertTitle>
        <AlertDescription>
          While the backend runs with <span className='font-mono'>WAOTP_MOCK_DELIVERY=1</span>,
          messages are not really delivered — the API still behaves exactly like production.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Icons.send className='size-4' />
            Send an OTP
          </CardTitle>
          <CardDescription>
            Uses your plaintext key — the same call your backend would make. No key?{' '}
            <Link href='/dashboard/keys' className='text-primary underline underline-offset-4'>
              Create one
            </Link>{' '}
            and copy it.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <div className='grid gap-2'>
            <Label htmlFor='tester-key'>API key</Label>
            <Input
              id='tester-key'
              type='password'
              placeholder='waotp_… (prefilled if you just created one)'
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete='off'
            />
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='tester-phone'>Phone</Label>
              <Input
                id='tester-phone'
                inputMode='numeric'
                placeholder='919876543210'
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label>Channel</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as 'whatsapp' | 'telegram')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='whatsapp'>whatsapp</SelectItem>
                  <SelectItem value='telegram'>telegram</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='grid gap-2 md:w-1/2'>
            <Label htmlFor='tester-code'>
              Custom code <span className='text-muted-foreground'>(optional)</span>
            </Label>
            <Input
              id='tester-code'
              placeholder='4–10 letters/numbers, e.g. 424242'
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              aria-invalid={codeInvalid || undefined}
            />
            {codeInvalid && (
              <p className='text-destructive text-sm'>Must be 4–10 letters/numbers.</p>
            )}
          </div>
          <div>
            <LoadingButton loading={sending} disabled={sending} onClick={() => void handleSend()}>
              <Icons.send className='size-4' />
              Send OTP
            </LoadingButton>
          </div>

          {sendResult && (
            <div className='grid gap-2'>
              <p className='text-sm font-medium'>Response</p>
              <JsonBlock data={sendResult} />
              <p className='text-muted-foreground text-sm'>
                Code expires in {sendResult.expires_in ?? '?'} seconds. Move to Verify below.
              </p>
            </div>
          )}
          {sendError && (
            <div className='grid gap-2'>
              <p className='text-destructive text-sm font-medium'>Error response</p>
              <JsonBlock data={sendError} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Icons.check className='size-4' />
            Verify an OTP
          </CardTitle>
          <CardDescription>Check the code your user received.</CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='verify-phone'>Phone</Label>
              <Input
                id='verify-phone'
                inputMode='numeric'
                placeholder='919876543210'
                value={verifyPhone}
                onChange={(e) => setVerifyPhone(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='verify-code'>Code</Label>
              <Input
                id='verify-code'
                placeholder='123456'
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
              />
            </div>
          </div>
          <div>
            <LoadingButton
              loading={verifying}
              disabled={verifying}
              onClick={() => void handleVerify()}
            >
              Verify code
            </LoadingButton>
          </div>

          {verifyResult && (
            <div className='grid gap-2'>
              <p className='text-sm font-medium'>Response</p>
              <JsonBlock data={verifyResult} />
            </div>
          )}
          {verifyError && (
            <div className='grid gap-2'>
              <p className='text-destructive text-sm font-medium'>Error response</p>
              <JsonBlock data={verifyError} />
            </div>
          )}
        </CardContent>
      </Card>

      <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
        <Icons.book className='size-3.5' />
        Full request/response reference in the{' '}
        <Link href='/docs' className='text-primary underline underline-offset-4'>
          API docs
        </Link>
        .
      </p>
    </div>
  );
}
