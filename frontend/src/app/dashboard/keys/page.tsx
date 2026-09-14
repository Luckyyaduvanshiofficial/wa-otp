import PageContainer from '@/components/layout/page-container';
import { KeysView } from '@/features/keys/components/keys-view';

export default function KeysPage() {
  return (
    <PageContainer pageTitle='API Keys' pageDescription='Create, rotate and deactivate your keys'>
      <KeysView />
    </PageContainer>
  );
}
