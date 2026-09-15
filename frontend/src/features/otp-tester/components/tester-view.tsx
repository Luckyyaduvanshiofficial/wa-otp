'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  sendOtp,
  verifyOtp,
  createKey,
  isApiError,
  errorMessage,
  type SendOtpResult,
  type VerifyOtpResult
} from '@/lib/api';
import { takePlaintextKey } from '@/lib/key-handoff';
import { CopyButton } from '@/components/copy-button';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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

const TESTER_KEY_STORAGE = 'waotp_tester_key';

function cleanAndNormalizePhone(raw: string): string {
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    digits = '91' + digits;
  }
  return digits;
}

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
  const [generatingKey, setGeneratingKey] = React.useState(false);
  const [sendResult, setSendResult] = React.useState<SendOtpResult | null>(null);
  const [sendError, setSendError] = React.useState<Record<string, unknown> | null>(null);
  const [telegramLinkUrl, setTelegramLinkUrl] = React.useState<string | null>(null);

  // Verify form state
  const [verifyPhone, setVerifyPhone] = React.useState('');
  const [verifyCode, setVerifyCode] = React.useState('');
  const [verifying, setVerifying] = React.useState(false);
  const [verifyResult, setVerifyResult] = React.useState<VerifyOtpResult | null>(null);
  const [verifyError, setVerifyError] = React.useState<Record<string, unknown> | null>(null);

  // Load key from sessionStorage handoff or localStorage
  React.useEffect(() => {
    const handoff = takePlaintextKey();
    if (handoff?.api_key) {
      setApiKey(handoff.api_key);
      try {
        localStorage.setItem(TESTER_KEY_STORAGE, handoff.api_key);
      } catch {}
      return;
    }

    try {
      const saved = localStorage.getItem(TESTER_KEY_STORAGE);
      if (saved) setApiKey(saved);
    } catch {}
  }, []);

  function handleApiKeyChange(val: string) {
    setApiKey(val);
    try {
      localStorage.setItem(TESTER_KEY_STORAGE, val.trim());
    } catch {}
  }

  async function handleQuickGenerateKey() {
    setGeneratingKey(true);
    try {
      const created = await createKey('Tester Quick Key');
      setApiKey(created.api_key);
      try {
        localStorage.setItem(TESTER_KEY_STORAGE, created.api_key);
      } catch {}
      toast.success('New API key generated and loaded!');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setGeneratingKey(false);
    }
  }

  const codeInvalid = customCode !== '' && !/^[A-Za-z0-9]{4,10}$/.test(customCode);

  async function handleSend() {
    const key = apiKey.trim();
    if (!key) {
      toast.error('API key is required. Paste one or click "Generate key".');
      return;
    }

    const normalized = cleanAndNormalizePhone(phone);
    if (!normalized || normalized.length < 10 || normalized.length > 15) {
      toast.error('Enter a valid phone number (e.g. 919876543210 or 9876543210).');
      return;
    }

    if (codeInvalid) {
      toast.error('Custom code must be 4–10 letters/numbers.');
      return;
    }

    setSending(true);
    setSendResult(null);
    setSendError(null);
    setTelegramLinkUrl(null);

    try {
      const result = await sendOtp(key, {
        to: normalized,
        channel,
        ...(customCode.trim() ? { code: customCode.trim() } : {})
      });
      setSendResult(result);
      setVerifyPhone(normalized);
      if (customCode.trim()) setVerifyCode(customCode.trim());
      toast.success(`OTP dispatched on ${channel}`);
    } catch (e: unknown) {
      if (isApiError(e)) {
        setSendError({
          ok: false,
          error: e.code,
          ...e.extra
        });
        if (e.code === 'user_not_linked' && e.extra.link_url) {
          setTelegramLinkUrl(String(e.extra.link_url));
          toast.error('Telegram bot linking required. Click the link button below!');
        } else {
          toast.error(errorMessage(e));
        }
      } else {
        setSendError({
          ok: false,
          error: e instanceof Error ? e.message : 'Unknown error'
        });
        toast.error('Failed to send OTP.');
      }
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    const key = apiKey.trim();
    if (!key) {
      toast.error('API key is required to verify OTP. Please paste or generate one above.');
      return;
    }

    const normalized = cleanAndNormalizePhone(verifyPhone);
    if (!normalized || !verifyCode.trim()) {
      toast.error('Enter the phone and the verification code.');
      return;
    }

    setVerifying(true);
    setVerifyResult(null);
    setVerifyError(null);

    try {
      const result = await verifyOtp(key, {
        to: normalized,
        code: verifyCode.trim()
      });
      setVerifyResult(result);
      if (result.verified) {
        toast.success('Code verified successfully ✓');
      } else {
        const left = result.attempts_left;
        toast.error(`Wrong code${left !== undefined ? ` — ${left} attempt(s) left` : ''}`);
      }
    } catch (e: unknown) {
      if (isApiError(e)) {
        setVerifyError({
          ok: false,
          error: e.code,
          ...e.extra
        });
        if (e.code === 'wrong_code') {
          const left = e.extra.attempts_left;
          toast.error(`Wrong code${left !== undefined ? ` — ${left} attempt(s) left` : ''}`);
        } else if (e.code === 'code_expired') {
          toast.error('Code expired or already used. Please request a new code.');
        } else {
          toast.error(errorMessage(e));
        }
      } else {
        setVerifyError({
          ok: false,
          error: e instanceof Error ? e.message : 'Verification failed'
        });
        toast.error('Verification failed.');
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className='grid gap-4'>
      <Alert className='border-primary/20 bg-primary/5'>
        <Icons.info className='text-primary' />
        <AlertTitle className='font-medium text-primary'>OTP Dispatch & Live Channels</AlertTitle>
        <AlertDescription className='text-muted-foreground text-sm leading-relaxed'>
          <strong>Telegram OTP:</strong> sent through the bot token configured on this
          installation. If your number is not linked yet, you will get a 1-click link button to
          pair with that bot.
          <br />
          <strong>WhatsApp OTP:</strong> sent through this installation&apos;s own Meta Cloud API
          credentials. If running with sandbox credentials or mock mode, messages behave
          realistically for end-to-end integration testing.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Icons.send className='size-4' />
            Send an OTP
          </CardTitle>
          <CardDescription>
            Uses your plaintext API key — exactly how your production backend calls the gateway.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <div className='grid gap-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='tester-key'>API key</Label>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 text-xs text-primary'
                onClick={() => void handleQuickGenerateKey()}
                disabled={generatingKey}
              >
                <Icons.add className='mr-1 size-3.5' />
                {generatingKey ? 'Generating…' : 'Generate test key'}
              </Button>
            </div>
            <Input
              id='tester-key'
              type='password'
              placeholder='waotp_… (saved locally or generate a quick one)'
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              autoComplete='off'
            />
          </div>

          <div className='grid gap-4 md:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='tester-phone'>Recipient Phone</Label>
              <Input
                id='tester-phone'
                inputMode='tel'
                placeholder='919876543210, +91 98765 43210, or 9876543210'
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className='text-muted-foreground text-xs'>
                Formatted automatically: 10-digit Indian numbers auto-prefix 91.
              </p>
            </div>
            <div className='grid gap-2'>
              <Label>Delivery Channel</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as 'whatsapp' | 'telegram')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='telegram'>Telegram (Bot API)</SelectItem>
                  <SelectItem value='whatsapp'>WhatsApp (Meta Cloud API)</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>
                Telegram needs only a bot token. WhatsApp needs an approved Meta business account.
              </p>
            </div>
          </div>

          <div className='grid gap-2 md:w-1/2'>
            <Label htmlFor='tester-code'>
              Custom code <span className='text-muted-foreground'>(optional)</span>
            </Label>
            <Input
              id='tester-code'
              placeholder='4–10 alphanumeric characters, e.g. 424242'
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

          {telegramLinkUrl && (
            <Alert className='border-amber-500/30 bg-amber-500/10'>
              <Icons.info className='text-amber-500' />
              <AlertTitle className='font-semibold text-amber-600 dark:text-amber-400'>
                Telegram Bot Link Required
              </AlertTitle>
              <AlertDescription className='mt-2 flex flex-col gap-3 text-sm'>
                <span>
                  This phone number is not linked to your Telegram account yet. Click the button
                  below to open our Telegram bot and link your number with 1 click:
                </span>
                <a
                  href={telegramLinkUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex w-fit items-center gap-2 rounded-md bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500 shadow-sm'
                >
                  <Icons.send className='size-4' />
                  Open Telegram Bot & Link Number
                </a>
              </AlertDescription>
            </Alert>
          )}

          {sendResult && (
            <div className='grid gap-2'>
              <p className='text-sm font-medium'>Response</p>
              <JsonBlock data={sendResult} />
              <p className='text-muted-foreground text-sm'>
                Dispatched successfully! Code expires in {sendResult.expires_in ?? '?'} seconds. You
                can now verify below.
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
          <CardDescription>
            Check the verification code received by the user. Codes burn after successful
            verification or maximum guesses.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <div className='grid gap-4 md:grid-cols-2'>
            <div className='grid gap-2'>
              <Label htmlFor='verify-phone'>Phone</Label>
              <Input
                id='verify-phone'
                inputMode='tel'
                placeholder='919876543210'
                value={verifyPhone}
                onChange={(e) => setVerifyPhone(e.target.value)}
              />
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='verify-code'>Verification Code</Label>
              <Input
                id='verify-code'
                placeholder='e.g. 123456'
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
              <Icons.check className='size-4' />
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
        Full endpoint documentation, request headers, and error codes in the{' '}
        <Link href='/docs' className='text-primary underline underline-offset-4'>
          API documentation
        </Link>
        .
      </p>
    </div>
  );
}
