import PageContainer from '@/components/layout/page-container';
import { TesterView } from '@/features/otp-tester/components/tester-view';

export default function TesterPage() {
  return (
    <PageContainer
      pageTitle='OTP Tester'
      pageDescription='Try sending and verifying an OTP on your own phone'
    >
      <TesterView />
    </PageContainer>
  );
}
