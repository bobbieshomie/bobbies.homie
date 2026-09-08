import type { Database } from '@/types/database.types';

export type Chore = Database['public']['Tables']['chores']['Row'];
export type InsertChore = Database['public']['Tables']['chores']['Insert'];
export type UpdateChore = Database['public']['Tables']['chores']['Update'];
