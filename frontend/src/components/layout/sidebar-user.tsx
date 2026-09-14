'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { pb } from '@/lib/pb';
import { Icons } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { toast } from 'sonner';

export function SidebarUser() {
  const router = useRouter();
  const [record, setRecord] = React.useState(pb.authStore.record);

  React.useEffect(() => {
    setRecord(pb.authStore.record);
  }, []);

  async function signOut() {
    pb.authStore.clear();
    toast.success('Signed out');
    router.push('/login');
    router.refresh();
  }

  const name = (record?.name as string | undefined) ?? '';
  const email = (record?.email as string | undefined) ?? '';
  const initials = name
    ? name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : email.slice(0, 2).toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size='lg'
                className='data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground'
              />
            }
          >
            <Avatar className='size-8 rounded-lg'>
              <AvatarImage
                src={record?.avatar ? pb.files.getURL(record, record.avatar as string) : undefined}
                alt={name || email}
              />
              <AvatarFallback className='rounded-lg'>{initials || '?'}</AvatarFallback>
            </Avatar>
            <div className='grid flex-1 text-left text-sm leading-tight'>
              <span className='truncate font-medium'>{name || email || 'Account'}</span>
              {name && <span className='text-muted-foreground truncate text-xs'>{email}</span>}
            </div>
            <Icons.chevronsDown className='ml-auto size-4' />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--anchor-width) min-w-56 rounded-lg'
            side='bottom'
            align='end'
            sideOffset={4}
          >
            <DropdownMenuLabel className='p-0 font-normal'>
              <div className='flex items-center gap-2 px-1 py-1.5 text-left text-sm'>
                <span className='truncate'>{email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                render={
                  <Link href='/dashboard/settings'>
                    <Icons.settings />
                    Settings
                  </Link>
                }
              />
              <DropdownMenuItem
                render={
                  <Link href='/docs'>
                    <Icons.book />
                    Documentation
                  </Link>
                }
              />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <Icons.logout />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
