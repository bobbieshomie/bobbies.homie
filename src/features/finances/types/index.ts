import type { Database } from '@/types/database.types';

export type SharedFinance = Database['public']['Tables']['shared_finances']['Row'];
export type InsertSharedFinance = Database['public']['Tables']['shared_finances']['Insert'];
export type UpdateSharedFinance = Database['public']['Tables']['shared_finances']['Update'];
export type MonthlyBudget = Database['public']['Tables']['monthly_budgets']['Row'];

export interface HouseholdBalanceSummary {
  totalSpent: number;
  partner1Paid: number;
  partner2Paid: number;
  unreimbursedAmount: number;
  settlementOwedTo: string | null; // Profile ID
}
