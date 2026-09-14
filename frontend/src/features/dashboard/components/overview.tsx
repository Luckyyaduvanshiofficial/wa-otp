'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getUsage, listKeys, errorMessage, API_URL } from '@/lib/api';
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

  const { plan, used, limit, reset_utc } = data;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const resetDate = new Date(reset_utc);
  const resetLabel = Number.isNaN(resetDate.getTime())
    ? reset_utc
    : resetDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          Monthly usage
          <Badge variant={pct >= 100 ? 'destructive' : 'secondary'} className='capitalize'>
            {plan}
          </Badge>
        </CardTitle>
        <CardDescription className='text-2xl font-semibold tabular-nums'>
          {used.toLocaleString('en-IN')} / {limit.toLocaleString('en-IN')} OTPs
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={pct} aria-label={`${pct}% of monthly quota used`} />
        <p className='text-muted-foreground mt-3 text-sm'>
          Resets on <span className='text-foreground font-medium'>{resetLabel}</span>
        </p>
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
      <UsageCard />
      <RecentKeysCard />
      <div className='md:col-span-2'>
        <QuickStartCard />
      </div>
    </div>
  );
}
