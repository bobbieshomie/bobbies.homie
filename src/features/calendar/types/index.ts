import type { Database } from '@/types/database.types';

export type CalendarEvent = Database['public']['Tables']['calendar_events']['Row'];
export type InsertCalendarEvent = Database['public']['Tables']['calendar_events']['Insert'];
export type UpdateCalendarEvent = Database['public']['Tables']['calendar_events']['Update'];
