import { Suspense, type ReactNode } from 'react';
import { MobileShell } from '@/components/layout/mobile-shell';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ErrorBoundary } from '@/components/layout/error-boundary';
import { PageSkeleton } from '@/components/layout/page-skeleton';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <MobileShell 
      bottomNav={<BottomNav />}
    >
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          {children}
        </Suspense>
      </ErrorBoundary>
      <NotificationPanel />
    </MobileShell>
  );
}
