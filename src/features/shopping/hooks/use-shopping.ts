'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shoppingService } from '../services/shopping.service';
import { useSupabaseSubscription } from '@/lib/hooks/use-supabase-subscription';
import type { InsertShoppingItem, ShoppingItem } from '../types';

export const SHOPPING_QUERY_KEY = ['shopping_items'] as const;

export function useShopping(householdId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = [...SHOPPING_QUERY_KEY, householdId];

  // 1. Fetch Shopping List
  const itemsQuery = useQuery({
    queryKey,
    queryFn: () => {
      if (!householdId) return Promise.resolve([]);
      return shoppingService.getItems(householdId);
    },
    enabled: Boolean(householdId),
  });

  // 2. Realtime Synchronization for the couple
  useSupabaseSubscription<ShoppingItem>({
    table: 'shopping_items',
    filter: householdId ? `household_id=eq.${householdId}` : undefined,
    queryKey,
    enabled: Boolean(householdId),
  });

  // 3. Optimistic Mutation: Toggle Purchased status
  const togglePurchasedMutation = useMutation({
    mutationFn: ({ itemId, isPurchased }: { itemId: string; isPurchased: boolean }) =>
      shoppingService.togglePurchased(itemId, isPurchased),

    // Optimistic Update Hook
    onMutate: async ({ itemId, isPurchased }) => {
      // Cancel outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous state
      const previousItems = queryClient.getQueryData<ShoppingItem[]>(queryKey);

      // Optimistically update the cache
      if (previousItems) {
        queryClient.setQueryData<ShoppingItem[]>(
          queryKey,
          previousItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  is_purchased: isPurchased,
                  purchased_at: isPurchased ? new Date().toISOString() : null,
                }
              : item
          )
        );
      }

      return { previousItems };
    },

    // Rollback on failure
    onError: (_err, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKey, context.previousItems);
      }
    },

    // Refetch in background after settling
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 4. Add Item Mutation
  const addItemMutation = useMutation({
    mutationFn: (newItem: InsertShoppingItem) => shoppingService.addItem(newItem),
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<ShoppingItem[]>(queryKey);

      if (previousItems && householdId) {
        const optimisticItem: ShoppingItem = {
          id: `temp-${Date.now()}`,
          household_id: householdId,
          title: newItem.title,
          category: newItem.category || 'grocery',
          quantity: newItem.quantity || '1',
          list_id: null,
          note: newItem.note || null,
          is_purchased: false,
          purchased_at: null,
          added_by: newItem.added_by || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        queryClient.setQueryData<ShoppingItem[]>(queryKey, [optimisticItem, ...previousItems]);
      }

      return { previousItems };
    },
    onError: (_err, _newVal, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKey, context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // 5. Delete Item Mutation
  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => shoppingService.deleteItem(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey });
      const previousItems = queryClient.getQueryData<ShoppingItem[]>(queryKey);

      if (previousItems) {
        queryClient.setQueryData<ShoppingItem[]>(
          queryKey,
          previousItems.filter((item) => item.id !== itemId)
        );
      }

      return { previousItems };
    },
    onError: (_err, _itemId, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(queryKey, context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    items: itemsQuery.data ?? [],
    isLoading: itemsQuery.isLoading,
    isError: itemsQuery.isError,
    error: itemsQuery.error,
    togglePurchased: togglePurchasedMutation.mutate,
    isToggling: togglePurchasedMutation.isPending,
    addItem: addItemMutation.mutate,
    isAdding: addItemMutation.isPending,
    deleteItem: deleteItemMutation.mutate,
  };
}
