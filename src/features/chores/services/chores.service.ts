import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { Chore, InsertChore } from '../types';

export const choresService = {
  async getChores(householdId: string): Promise<Chore[]> {
    if (!isSupabaseConfigured()) return [];
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('chores')
        .select('*')
        .eq('household_id', householdId)
        .order('is_completed', { ascending: true })
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  async toggleCompleted(choreId: string, isCompleted: boolean): Promise<Chore> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('chores')
      .update({
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      })
      .eq('id', choreId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async createChore(chore: InsertChore): Promise<Chore> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('chores')
      .insert(chore)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteChore(choreId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('chores')
      .delete()
      .eq('id', choreId);

    if (error) throw error;
  },
};
