export type NotificationType = 
  | 'calendar_today'
  | 'calendar_tomorrow'
  | 'finance_pending'
  | 'slip_expiring'
  | 'shopping_pending'
  | 'chore_overdue';

export interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  icon: string;
  link: string;
  badge?: string;
  category: 'calendar' | 'finance' | 'shopping' | 'chore';
  created_at: string;
  count?: number;
}
