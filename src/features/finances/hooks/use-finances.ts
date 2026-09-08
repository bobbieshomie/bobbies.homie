'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { financesService } from '../services/finances.service';
import { useSupabaseSubscription } from '@/lib/hooks/use-supabase-subscription';
import type { InsertSharedFinance, SharedFinance } from '../types';

export const FINANCES_QUERY_KEY = ['shared_finances'] as const;

export function useFinances(householdId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = [...FINANCES_QUERY_KEY, householdId];

  // 1. Fetch expenses
  const financesQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!householdId) return Promise.resolve([]);
      return financesService.getFinances(householdId);
    },
    enabled: Boolean(householdId),
  });

  // 2. Realtime Synchronization
  useSupabaseSubscription<SharedFinance>({
    table: 'shared_finances',
    filter: householdId ? `household_id=eq.${householdId}` : undefined,
    queryKey,
    enabled: Boolean(householdId),
  });

  // 3. Optimistic Mutation: Toggle Reimbursed Status
  const toggleReimbursedMutation = useMutation({
    mutationFn: ({ financeId, isReimbursed }: { financeId: string; isReimbursed: boolean }) =>
      financesService.toggleReimbursed(financeId, isReimbursed),

    onMutate: async ({ financeId, isReimbursed }) => {
      await queryClient.cancelQueries({ queryKey });

      const previousFinances = queryClient.getQueryData<SharedFinance[]>(queryKey);

      if (previousFinances) {
        queryClient.setQueryData<SharedFinance[]>(
          queryKey,
          previousFinances.map((item) =>
            item.id === financeId
              ? {
                  ...item,
                  is_reimbursed: isReimbursed,
                  reimbursed_at: isReimbursed ? new Date().toISOString() : null,
                }
              : item
          )
        );
      }

      return { previousFinances };
    },

    onError: (_err, _variables, context) => {
      if (context?.previousFinances) {
        queryClient.setQueryData(queryKey, context.previousFinances);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 4. Create Expense Mutation
  const createExpenseMutation = useMutation({
    mutationFn: (expense: InsertSharedFinance) => financesService.createExpense(expense),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    finances: financesQuery.data ?? [],
    isLoading: financesQuery.isLoading,
    isError: financesQuery.isError,
    error: financesQuery.error,
    toggleReimbursed: toggleReimbursedMutation.mutate,
    isToggling: toggleReimbursedMutation.isPending,
    createExpense: createExpenseMutation.mutate,
  };
}
