'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getUsage, listKeys, errorMessage, getReadiness, webhookUrl, API_URL } from '@/lib/api';
import { CopyButton } from '@/components/copy-button';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

function UsageCard() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['usage'],
    queryFn: getUsage,
    retry: 1
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-4 w-32' />
          <Skeleton className='h-8 w-48' />
        </CardHeader>
        <CardContent className='space-y-3'>
          <Skeleton className='h-2 w-full' />
          <Skeleton className='h-4 w-40' />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Icons.warning className='size-4 text-destructive' />
            Couldn&apos;t load usage
          </CardTitle>
          <CardDescription>{errorMessage(error)}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant='outline' size='sm' onClick={() => void refetch()} disabled={isFetching}>
            <Icons.refresh className='size-3.5' />
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // `limit` is this installation's own monthly send cap. 0 means the operator
  // set none, which is a legitimate configuration on a self-hosted box — not a
  // quota of zero — so it must not render as "0 / 0".
  const { used, limit, reset_utc } = data;
  const capped = limit > 0;
  const pct = capped ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const resetDate = new Date(reset_utc);
  const resetLabel = Number.isNaN(resetDate.getTime())
    ? reset_utc
    : resetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          Monthly WhatsApp sends
          <Badge variant={capped && pct >= 100 ? 'destructive' : 'secondary'}>
            {capped ? 'capped' : 'no cap'}
          </Badge>
        </CardTitle>
        <CardDescription className='text-2xl font-semibold tabular-nums'>
          {used.toLocaleString('en-IN')}
          {capped ? ` / ${limit.toLocaleString('en-IN')}` : ''} OTPs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {capped ? (
          <Progress value={pct} aria-label={`${pct}% of monthly send cap used`} />
        ) : (
          <p className='text-muted-foreground text-sm'>
            No monthly cap is set for this installation. Set one on the Meta settings
            page if you want a runaway-spend guard.
          </p>
        )}
        <p className='text-muted-foreground mt-3 text-sm'>
          Resets on <span className='text-foreground font-medium'>{resetLabel}</span>
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * The most important card on a self-hosted install: can this box actually
 * deliver anything? On hosted SaaS the answer was always yes, so this did not
 * need saying. Here the operator owns the Meta account, the bot and the
 * database, and any of the three can be missing on a fresh clone.
 *
 * Every state below is derived from GET /health/ready, which reports *names* of
 * missing variables and never their values.
 */
function ChannelRow({
  label,
  configured,
  detail,
  icon
}: {
  label: string;
  configured: boolean;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className='flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0'>
      <div className='flex items-start gap-2'>
        <span className='text-muted-foreground mt-0.5'>{icon}</span>
        <div>
          <p className='text-sm font-medium'>{label}</p>
          <p className='text-muted-foreground text-xs'>{detail}</p>
        </div>
      </div>
      <Badge variant={configured ? 'secondary' : 'outline'}>
        {configured ? 'configured' : 'not configured'}
      </Badge>
    </div>
  );
}

function InstallationStatusCard() {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['readiness'],
    queryFn: getReadiness,
    refetchInterval: 60_000,
    retry: 1
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className='h-4 w-40' />
          <Skeleton className='h-4 w-64' />
        </CardHeader>
        <CardContent className='space-y-2'>
          <Skeleton className='h-12 w-full' />
          <Skeleton className='h-12 w-full' />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.state === 'unreachable') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Icons.warning className='text-destructive size-4' />
            Installation status unknown
          </CardTitle>
          <CardDescription>
            {data?.state === 'unreachable'
              ? data.message
              : 'Could not reach the API to check this installation.'}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant='outline' size='sm' onClick={() => void refetch()} disabled={isFetching}>
            <Icons.refresh className='size-3.5' />
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (data.state === 'degraded') {
    return (
      <Card className='border-destructive/40'>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Icons.warning className='text-destructive size-4' />
            Control plane unreachable
          </CardTitle>
          <CardDescription>
            The API is running but PocketBase did not answer, so no OTP can be sent or verified
            until it is back. Check that PocketBase is up and that <code>PB_URL</code> in{' '}
            <code>backend/.env</code> points at it.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant='outline' size='sm' onClick={() => void refetch()} disabled={isFetching}>
            <Icons.refresh className='size-3.5' />
            Re-check
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const ready = data.data;
  if (!ready) return null;

  const { whatsapp, telegram, webhook, mock_delivery } = ready;
  const whatsappDetail = whatsapp.configured
    ? whatsapp.detail
    : whatsapp.missing.length > 0
      ? `Missing: ${whatsapp.missing.join(', ')}`
      : whatsapp.detail;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          Installation status
          <Button
            variant='ghost'
            size='sm'
            onClick={() => void refetch()}
            disabled={isFetching}
            className='h-7 px-2 text-xs'
          >
            <Icons.refresh className='size-3.5' />
            {isFetching ? 'Checking…' : 'Re-check'}
          </Button>
        </CardTitle>
        <CardDescription>
          Whether this installation can deliver an OTP, and what it is still missing.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        {/* Mock delivery means no real message is being sent. Hiding this would
            let an operator believe a green install was delivering for real. */}
        {mock_delivery ? (
          <div className='border-primary/30 bg-primary/5 rounded-lg border p-3'>
            <p className='text-primary flex items-center gap-2 text-sm font-medium'>
              <Icons.warning className='size-4' />
              Mock delivery is on
            </p>
            <p className='text-muted-foreground mt-1 text-xs'>
              Sends are faked: every database row is real but no WhatsApp or Telegram message leaves
              this machine. Set <code>WAOTP_MOCK_DELIVERY=0</code> and restart to deliver for real.
            </p>
          </div>
        ) : null}

        <div>
          <ChannelRow
            label='WhatsApp (Meta Cloud API)'
            icon={<Icons.whatsapp className='size-4' />}
            configured={whatsapp.configured}
            detail={whatsappDetail}
          />
          <ChannelRow
            label='Telegram (Bot API)'
            icon={<Icons.telegram className='size-4' />}
            configured={telegram.configured}
            detail={telegram.detail}
          />
        </div>

        <div className='bg-muted/40 rounded-lg p-3'>
          <p className='text-sm font-medium'>Meta webhook</p>
          <dl className='text-muted-foreground mt-1.5 space-y-1 text-xs'>
            <div className='flex items-center justify-between gap-4'>
              <dt>Verify token</dt>
              <dd className={webhook.verify_token_configured ? 'text-foreground' : 'text-amber-500'}>
                {webhook.verify_token_configured ? 'set' : 'not set — Meta cannot subscribe'}
              </dd>
            </div>
            <div className='flex items-center justify-between gap-4'>
              <dt>Signature check</dt>
              <dd
                className={webhook.signature_check_enabled ? 'text-foreground' : 'text-amber-500'}
              >
                {webhook.signature_check_enabled
                  ? 'enabled'
                  : 'disabled — set META_APP_SECRET to verify callbacks'}
              </dd>
            </div>
            <div className='flex items-center justify-between gap-4'>
              <dt>Callback URL</dt>
              <dd className='text-foreground max-w-[60%] truncate font-mono'>{webhookUrl()}</dd>
            </div>
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}

function CodeSnippet({ code }: { code: string }) {
  return (
    <div className='bg-muted/60 relative rounded-lg border pr-20'>
      <pre className='overflow-x-auto p-3 font-mono text-[12.5px] leading-relaxed'>{code}</pre>
      <CopyButton value={code} className='absolute top-2 right-2 h-7 px-2 text-xs' />
    </div>
  );
}

function QuickStartCard() {
  const steps = [
    {
      title: 'Create a key',
      body: 'Open the API Keys page and create your first key (shown once — copy it).',
      code: `curl -X POST ${API_URL}/v1/keys \\\n  -H "Authorization: Bearer $DASHBOARD_TOKEN" \\\n  -H "Content-Type: application/json" \\\n  -d '{"label": "prod"}'`
    },
    {
      title: 'Send an OTP',
      body: 'Call send from your backend with the key in the X-Api-Key header.',
      code: `curl -X POST ${API_URL}/v1/otp/send \\\n  -H "X-Api-Key: $WAOTP_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"to": "919876543210", "channel": "whatsapp"}'`
    },
    {
      title: 'Verify the code',
      body: 'Check what the user typed against the code that was sent.',
      code: `curl -X POST ${API_URL}/v1/otp/verify \\\n  -H "X-Api-Key: $WAOTP_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"to": "919876543210", "code": "123456"}'`
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick start</CardTitle>
        <CardDescription>Three steps from zero to verified user</CardDescription>
      </CardHeader>
      <CardContent className='space-y-6'>
        {steps.map((s, i) => (
          <div key={s.title}>
            <div className='mb-2 flex items-center gap-2'>
              <span className='bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-bold'>
                {i + 1}
              </span>
              <span className='font-medium'>{s.title}</span>
            </div>
            <p className='text-muted-foreground mb-2 text-sm'>{s.body}</p>
            <CodeSnippet code={s.code} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentKeysCard() {
  const { data, isLoading } = useQuery({ queryKey: ['keys'], queryFn: listKeys });

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          Recent keys
          <Button
            variant='ghost'
            size='sm'
            render={
              <Link href='/dashboard/keys'>
                Manage
                <Icons.arrowRight className='size-3.5' />
              </Link>
            }
          />
        </CardTitle>
        <CardDescription>Your most recently created API keys</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
          </div>
        ) : !data || data.keys.length === 0 ? (
          <div className='text-muted-foreground py-6 text-center text-sm'>
            No keys yet —{' '}
            <Link href='/dashboard/keys' className='text-primary underline underline-offset-4'>
              create your first key
            </Link>
          </div>
        ) : (
          <ul className='divide-y'>
            {data.keys.slice(0, 3).map((k) => (
              <li key={k.id} className='flex items-center justify-between py-2.5'>
                <div>
                  <p className='text-sm font-medium'>{k.label || 'Unnamed key'}</p>
                  <p className='text-muted-foreground font-mono text-xs'>waotp_••••{k.last4}</p>
                </div>
                <Badge variant={k.active ? 'secondary' : 'outline'}>
                  {k.active ? 'active' : 'inactive'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function Overview() {
  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {/* Status first: on a self-hosted install the first question is always
          "is this box actually wired up?", not "how many sends have I used?". */}
      <div className='md:col-span-2'>
        <InstallationStatusCard />
      </div>
      <UsageCard />
      <RecentKeysCard />
      <div className='md:col-span-2'>
        <QuickStartCard />
      </div>
      <Card className='md:col-span-2'>
        <CardHeader>
          <CardTitle>First-run checklist</CardTitle>
          <CardDescription>
            Seven steps from a fresh clone to a delivered OTP — including the one nobody can do for
            you: providing your own WhatsApp Business account.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            variant='outline'
            size='sm'
            render={
              <Link href='/dashboard/onboarding'>
                Open the checklist
                <Icons.arrowRight className='size-3.5' />
              </Link>
            }
          />
        </CardFooter>
      </Card>
    </div>
  );
}
