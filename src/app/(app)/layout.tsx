import { Suspense, type ReactNode } from 'react';
import { MobileShell } from '@/components/layout/mobile-shell';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { ErrorBoundary } from '@/components/layout/error-boundary';
import { PageSkeleton } from '@/components/layout/page-skeleton';

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
    </MobileShell>
  );
}
