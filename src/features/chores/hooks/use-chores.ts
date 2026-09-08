'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { choresService } from '../services/chores.service';
import { useSupabaseSubscription } from '@/lib/hooks/use-supabase-subscription';
import type { Chore, InsertChore } from '../types';

export const CHORES_QUERY_KEY = ['chores'] as const;

export function useChores(householdId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = [...CHORES_QUERY_KEY, householdId];

  // 1. Fetch chores
  const choresQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!householdId) return Promise.resolve([]);
      return choresService.getChores(householdId);
    },
    enabled: Boolean(householdId),
  });

  // 2. Realtime Subscription across couple devices
  useSupabaseSubscription<Chore>({
    table: 'chores',
    filter: householdId ? `household_id=eq.${householdId}` : undefined,
    queryKey,
    enabled: Boolean(householdId),
  });

  // 3. Optimistic Mutation: Toggle chore completion
  const toggleCompletedMutation = useMutation({
    mutationFn: ({ choreId, isCompleted }: { choreId: string; isCompleted: boolean }) =>
      choresService.toggleCompleted(choreId, isCompleted),

    onMutate: async ({ choreId, isCompleted }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousChores = queryClient.getQueryData<Chore[]>(queryKey);

      if (previousChores) {
        queryClient.setQueryData<Chore[]>(
          queryKey,
          previousChores.map((chore) =>
            chore.id === choreId
              ? {
                  ...chore,
                  is_completed: isCompleted,
                  completed_at: isCompleted ? new Date().toISOString() : null,
                }
              : chore
          )
        );
      }

      return { previousChores };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousChores) {
        queryClient.setQueryData(queryKey, context.previousChores);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 4. Create Chore Mutation
  const createChoreMutation = useMutation({
    mutationFn: (newChore: InsertChore) => choresService.createChore(newChore),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    chores: choresQuery.data ?? [],
    isLoading: choresQuery.isLoading,
    isError: choresQuery.isError,
    error: choresQuery.error,
    toggleCompleted: toggleCompletedMutation.mutate,
    isToggling: toggleCompletedMutation.isPending,
    createChore: createChoreMutation.mutate,
  };
}
