export type NotificationType = 
  | 'calendar_today'
  | 'calendar_tomorrow'
  | 'finance_pending'
  | 'finance_new_expense'
  | 'finance_settled'
  | 'slip_expiring'
  | 'shopping_pending'
  | 'shopping_new_list'
  | 'chore_overdue'
  | 'pet_care_reminder';

export interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  link: string;
  badge?: string;
  category: 'calendar' | 'finance' | 'shopping' | 'chore' | 'pets';
  created_at: string;
  count?: number;
}
