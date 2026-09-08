import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { InsertShoppingItem, ShoppingItem, UpdateShoppingItem } from '../types';

export const shoppingService = {
  async getItems(householdId: string): Promise<ShoppingItem[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('household_id', householdId)
        .order('is_purchased', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  async togglePurchased(itemId: string, isPurchased: boolean): Promise<ShoppingItem> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('shopping_items')
      .update({
        is_purchased: isPurchased,
        purchased_at: isPurchased ? new Date().toISOString() : null,
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addItem(item: InsertShoppingItem): Promise<ShoppingItem> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('shopping_items')
      .insert(item)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteItem(itemId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('shopping_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  },
};
