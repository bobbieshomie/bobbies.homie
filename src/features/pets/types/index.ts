import type { Database } from '@/types/database.types';

export type Pet = Database['public']['Tables']['pets']['Row'];
export type InsertPet = Database['public']['Tables']['pets']['Insert'];
export type UpdatePet = Database['public']['Tables']['pets']['Update'];
export type PetLog = Database['public']['Tables']['pet_logs']['Row'];
export type InsertPetLog = Database['public']['Tables']['pet_logs']['Insert'];
