import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface UseSupabaseSubscriptionOptions<T extends { [key: string]: any }> {
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string; // e.g. `household_id=eq.${householdId}`
  queryKey?: QueryKey;
  onPayload?: (payload: RealtimePostgresChangesPayload<T>) => void;
  enabled?: boolean;
}

/**
 * Generic Realtime subscription hook that synchronizes Supabase table changes
 * with TanStack Query cache across couples' devices in real time.
 */
export function useSupabaseSubscription<T extends { [key: string]: any }>({
  table,
  schema = 'public',
  event = '*',
  filter,
  queryKey,
  onPayload,
  enabled = true,
}: UseSupabaseSubscriptionOptions<T>) {
  const queryClient = useQueryClient();
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    // Only subscribe to Realtime WebSocket if explicitly enabled AND valid Supabase URL is configured
    // Prevents "channel error: transport failure" in local/demo environment
    if (!enabled || !isConfigured) return;

    try {
      const supabase = createClient();
      const channelName = `realtime:${table}${filter ? `:${filter}` : ''}`;
      const channel = supabase.channel(channelName);

      const subscriptionConfig: {
        event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
        schema: string;
        table: string;
        filter?: string;
      } = {
        event,
        schema,
        table,
      };

      if (filter) {
        subscriptionConfig.filter = filter;
      }

      channel
        .on(
          'postgres_changes',
          subscriptionConfig as any,
          (payload: RealtimePostgresChangesPayload<T>) => {
            if (queryKey) {
              queryClient.invalidateQueries({ queryKey });
            }
            if (onPayload) {
              onPayload(payload);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn(`[Realtime Notice] Reconnecting subscription for ${table}...`);
          }
        });

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch {
          // cleanup safe
        }
      };
    } catch {
      // safe fallback
    }
  }, [enabled, isConfigured, table, schema, event, filter, queryKey, onPayload, queryClient]);
}
