import { createClient } from '@/lib/supabase/client';

export interface DbProfile {
  id: string;
  household_id: string | null;
  username: string | null;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbHousehold {
  id: string;
  name: string;
  invite_code: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbShoppingList {
  id: string;
  household_id: string;
  title: string;
  date: string | null;
  location: string | null;
  created_by: string | null;
  created_at?: string | null;
  items?: DbShoppingItem[];
}

export interface DbShoppingItem {
  id: string;
  household_id: string;
  list_id: string | null;
  title: string;
  category: string;
  quantity: string | null;
  is_purchased: boolean;
  purchased_at: string | null;
  added_by: string | null;
  created_at?: string;
}

export interface DbChore {
  id: string;
  household_id: string;
  title: string;
  assigned_to: string | null;
  frequency: string;
  points: number;
  is_completed: boolean;
  completed_at?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface DbCalendarEvent {
  id: string;
  household_id: string;
  title: string;
  start_time: string;
  end_time: string;
  location: string | null;
  category: string;
  assigned_to: string | null;
  color_tag: string;
  owner_id: string | null;
  created_at?: string;
}

export interface DbPet {
  id: string;
  household_id: string;
  name: string;
  breed: string | null;
  gender: string;
  photo_url: string | null;
  notes: string | null;
  created_at?: string;
}

export interface DbPetLog {
  id: string;
  pet_id: string;
  log_type: string;
  title: string;
  scheduled_date: string;
  is_done: boolean;
  created_at?: string;
}

export interface DbFinance {
  id: string;
  household_id: string;
  title: string;
  amount: number;
  category: string;
  paid_by: string;
  is_reimbursed: boolean;
  date: string;
  created_at?: string;
}

export interface DbMemory {
  id: string;
  household_id: string;
  photo_url: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Profiles & Households
// ---------------------------------------------------------------------------

export async function fetchProfile(userId: string): Promise<DbProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as DbProfile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<DbProfile>
): Promise<DbProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DbProfile;
}

export async function fetchHousehold(householdId: string): Promise<DbHousehold | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('households')
    .select('*')
    .eq('id', householdId)
    .single();

  if (error || !data) return null;
  return data as DbHousehold;
}

export async function fetchHouseholdMembers(householdId: string): Promise<DbProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as DbProfile[];
}

export async function createNewHousehold(
  householdName: string,
  userId: string
): Promise<DbHousehold> {
  const supabase = createClient();
  const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  const { data: household, error: houseError } = await supabase
    .from('households')
    .insert({
      name: householdName || 'Bobbies Homie',
      invite_code: inviteCode,
    })
    .select()
    .single();

  if (houseError || !household) {
    throw new Error(houseError?.message || 'Failed to create household');
  }

  // Link profile to newly created household
  await supabase
    .from('profiles')
    .update({ household_id: household.id })
    .eq('id', userId);

  return household as DbHousehold;
}

export async function joinHouseholdByCode(
  inviteCode: string,
  userId: string
): Promise<DbHousehold> {
  const supabase = createClient();
  const cleanCode = inviteCode.trim().toUpperCase();

  const { data: household, error: houseError } = await supabase
    .from('households')
    .select('*')
    .eq('invite_code', cleanCode)
    .single();

  if (houseError || !household) {
    throw new Error('ไม่พบรหัสคำเชิญนี้ในระบบ กรุณาตรวจสอบอีกครั้ง');
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ household_id: household.id })
    .eq('id', userId);

  if (profileError) throw new Error(profileError.message);
  return household as DbHousehold;
}

// ---------------------------------------------------------------------------
// Shopping Lists & Batch Items
// ---------------------------------------------------------------------------

export async function fetchShoppingLists(householdId: string): Promise<DbShoppingList[]> {
  const supabase = createClient();
  
  // 1. Fetch lists
  const { data: lists, error: listsError } = await supabase
    .from('shopping_lists')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (listsError) throw new Error(listsError.message);

  // 2. Fetch all items for this household
  const { data: items, error: itemsError } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (itemsError) throw new Error(itemsError.message);

  const listsWithItems: DbShoppingList[] = (lists || []).map((l) => ({
    ...l,
    items: (items || []).filter((it) => it.list_id === l.id),
  }));

  // Also include unassigned standalone items in a default "Quick List" if any exist
  const standaloneItems = (items || []).filter((it) => !it.list_id);
  if (standaloneItems.length > 0) {
    listsWithItems.unshift({
      id: 'quick-list',
      household_id: householdId,
      title: 'รายการซื้อของทั่วไป',
      date: new Date().toISOString().split('T')[0],
      location: 'ทั่วไป',
      created_by: null,
      items: standaloneItems,
    });
  }

  return listsWithItems;
}

export async function createBatchShoppingList(
  householdId: string,
  userId: string,
  listData: {
    title: string;
    date?: string;
    location?: string;
  },
  itemsData: Array<{
    title: string;
    quantity?: string;
    category?: string;
  }>
): Promise<DbShoppingList> {
  const supabase = createClient();

  // 1. Create list
  const { data: list, error: listError } = await supabase
    .from('shopping_lists')
    .insert({
      household_id: householdId,
      title: listData.title,
      date: listData.date || new Date().toISOString().split('T')[0],
      location: listData.location || null,
      created_by: userId,
    })
    .select()
    .single();

  if (listError || !list) throw new Error(listError?.message || 'Failed to create list');

  // 2. Create items batch
  if (itemsData.length > 0) {
    const itemsToInsert = itemsData
      .filter((it) => it.title.trim().length > 0)
      .map((it) => ({
        household_id: householdId,
        list_id: list.id,
        title: it.title.trim(),
        quantity: it.quantity?.trim() || '1',
        category: it.category || 'grocery',
        added_by: userId,
        is_purchased: false,
      }));

    if (itemsToInsert.length > 0) {
      const { data: insertedItems, error: itemsError } = await supabase
        .from('shopping_items')
        .insert(itemsToInsert as any)
        .select();

      if (itemsError) throw new Error(itemsError.message);
      return { 
        ...list, 
        household_id: list.household_id || householdId,
        items: (insertedItems || []) as unknown as DbShoppingItem[] 
      };
    }
  }

  return { ...list, household_id: list.household_id || householdId, items: [] };
}

export async function toggleShoppingItem(itemId: string, isPurchased: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('shopping_items')
    .update({
      is_purchased: isPurchased,
      purchased_at: isPurchased ? new Date().toISOString() : null,
    })
    .eq('id', itemId);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Chores
// ---------------------------------------------------------------------------

export async function fetchChores(householdId: string): Promise<DbChore[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chores')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as DbChore[];
}

export async function createChore(
  householdId: string,
  userId: string,
  chore: {
    title: string;
    assigned_to?: string;
    frequency?: string;
    points?: number;
  }
): Promise<DbChore> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('chores')
    .insert({
      household_id: householdId,
      title: chore.title,
      assigned_to: chore.assigned_to || 'All',
      frequency: (chore.frequency as any) || 'weekly',
      points: chore.points || 10,
      created_by: userId,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create chore');
  return data as unknown as DbChore;
}

export async function toggleChore(choreId: string, isCompleted: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('chores')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', choreId);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Calendar Events
// ---------------------------------------------------------------------------

export async function fetchCalendarEvents(householdId: string): Promise<DbCalendarEvent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('household_id', householdId)
    .order('start_time', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as DbCalendarEvent[];
}

export async function createCalendarEvent(
  householdId: string,
  userId: string,
  event: {
    title: string;
    start_time: string;
    end_time: string;
    location?: string;
    category?: string;
    assigned_to?: string;
    color_tag?: string;
  }
): Promise<DbCalendarEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('calendar_events')
    .insert({
      household_id: householdId,
      title: event.title,
      start_time: event.start_time,
      end_time: event.end_time,
      location: event.location || null,
      category: event.category || 'date',
      assigned_to: event.assigned_to || 'All',
      color_tag: event.color_tag || '#5D4037',
      owner_id: userId,
    } as any)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create event');
  return data as unknown as DbCalendarEvent;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Pets & Logs
// ---------------------------------------------------------------------------

export async function fetchPets(householdId: string): Promise<DbPet[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pets')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as DbPet[];
}

export async function createPet(
  householdId: string,
  pet: {
    name: string;
    breed?: string;
    gender?: string;
    photo_url?: string;
    notes?: string;
  }
): Promise<DbPet> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pets')
    .insert({
      household_id: householdId,
      name: pet.name,
      breed: pet.breed || null,
      gender: pet.gender || 'male',
      photo_url: pet.photo_url || null,
      notes: pet.notes || null,
    } as any)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create pet');
  return data as unknown as DbPet;
}

export async function fetchPetLogs(householdId: string): Promise<DbPetLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pet_logs')
    .select('*, pets!inner(household_id)')
    .eq('pets.household_id', householdId)
    .order('scheduled_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as DbPetLog[];
}

export async function createPetLog(log: {
  pet_id: string;
  log_type?: string;
  title: string;
  scheduled_date: string;
}): Promise<DbPetLog> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('pet_logs')
    .insert({
      pet_id: log.pet_id,
      log_type: (log.log_type as any) || 'vet',
      title: log.title,
      scheduled_date: log.scheduled_date,
      is_done: false,
    } as any)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create pet log');
  return data as unknown as DbPetLog;
}

export async function deletePet(petId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('pets').delete().eq('id', petId);
  if (error) throw new Error(error.message);
}

export async function togglePetLog(logId: string, isDone: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('pet_logs')
    .update({ is_done: isDone })
    .eq('id', logId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Shared Finances
// ---------------------------------------------------------------------------

export async function fetchFinances(householdId: string): Promise<DbFinance[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shared_finances')
    .select('*')
    .eq('household_id', householdId)
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as unknown as DbFinance[];
}

export async function createFinance(
  householdId: string,
  finance: {
    title: string;
    amount: number;
    category?: string;
    paid_by: string;
    date?: string;
  }
): Promise<DbFinance> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('shared_finances')
    .insert({
      household_id: householdId,
      title: finance.title,
      amount: finance.amount,
      category: (finance.category as any) || 'groceries',
      paid_by: finance.paid_by,
      date: finance.date || new Date().toISOString().split('T')[0],
      is_reimbursed: false,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create finance record');
  return data as unknown as DbFinance;
}

// ---------------------------------------------------------------------------
// Household Memories / Photos
// ---------------------------------------------------------------------------

export async function fetchMemories(householdId: string): Promise<DbMemory[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('household_photos')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data as DbMemory[];
}

export async function createMemory(
  householdId: string,
  userId: string,
  photo_url: string,
  caption?: string
): Promise<DbMemory> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('household_photos')
    .insert({
      household_id: householdId,
      photo_url,
      caption: caption || null,
      uploaded_by: userId,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to save photo memory');
  return data as DbMemory;
}
