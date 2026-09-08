import type { Database } from '@/types/database.types';

export type ShoppingCategory = Database['public']['Enums']['shopping_category'];
export type ShoppingItem = Database['public']['Tables']['shopping_items']['Row'];
export type InsertShoppingItem = Database['public']['Tables']['shopping_items']['Insert'];
export type UpdateShoppingItem = Database['public']['Tables']['shopping_items']['Update'];

export interface ShoppingFilterState {
  category?: ShoppingCategory | 'all';
  isPurchased?: boolean;
}
