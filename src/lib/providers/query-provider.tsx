'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Mobile devices benefit from slightly longer stale time to conserve battery & network
            staleTime: 1000 * 60 * 2, // 2 minutes
            gcTime: 1000 * 60 * 15, // 15 minutes
            refetchOnWindowFocus: true, // Auto-refetch when user brings app back from background
            refetchOnReconnect: true,
            retry: 2,
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
