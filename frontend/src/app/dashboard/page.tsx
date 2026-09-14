import PageContainer from '@/components/layout/page-container';
import { Overview } from '@/features/dashboard/components/overview';

export default function DashboardPage() {
  return (
    <PageContainer pageTitle='Overview' pageDescription='Your WhatsApp OTP usage and quick start'>
      <Overview />
    </PageContainer>
  );
}
