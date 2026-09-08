import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { InsertSharedFinance, SharedFinance } from '../types';

export const financesService = {
  async getFinances(householdId: string): Promise<SharedFinance[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('shared_finances')
        .select('*')
        .eq('household_id', householdId)
        .order('date', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  async toggleReimbursed(financeId: string, isReimbursed: boolean): Promise<SharedFinance> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('shared_finances')
      .update({
        is_reimbursed: isReimbursed,
      })
      .eq('id', financeId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createExpense(expense: InsertSharedFinance): Promise<SharedFinance> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('shared_finances')
      .insert(expense)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteExpense(financeId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('shared_finances')
      .delete()
      .eq('id', financeId);

    if (error) throw error;
  },
};
