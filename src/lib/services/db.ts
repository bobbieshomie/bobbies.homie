import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

export interface DbProfile {
  id: string;
  household_id: string | null;
  username: string | null;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  role?: string | null;
  chore_points?: number;
  fcm_token?: string | null;
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
  description?: string | null;
  assigned_to: string | null;
  frequency: string;
  points: number;
  is_completed: boolean;
  completed_at?: string | null;
  due_date?: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface DbChoreReward {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  points_cost: number;
  icon: string | null;
  created_by: string | null;
  status?: 'active' | 'pending_create' | 'pending_edit' | 'pending_delete';
  proposed_by?: string | null;
  pending_payload?: {
    title?: string;
    description?: string | null;
    points_cost?: number;
    icon?: string | null;
    gacha_cost?: number;
    gacha_prizes?: any[];
  } | null;
  approvals?: Record<string, { approved: boolean; updated_at?: string }>;
  created_at?: string;
  updated_at?: string;
  proposer?: DbProfile;
}

export interface DbRewardRedemption {
  id: string;
  household_id: string;
  reward_id: string | null;
  reward_title: string;
  points_spent: number;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvals: Record<string, { approved: boolean; timestamp: string }>;
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  user?: DbProfile;
}

export interface DbChorePointLog {
  id: string;
  household_id: string;
  user_id: string;
  chore_id: string | null;
  redemption_id: string | null;
  title: string;
  points_delta: number;
  balance_after: number;
  type: 'chore_complete' | 'chore_uncheck' | 'reward_redeem' | 'reward_refund';
  created_at?: string;
  user?: DbProfile;
}

export interface DbChoreGachaSpin {
  id: string;
  household_id: string;
  user_id: string;
  chore_id: string | null;
  chore_title: string;
  multiplier: number;
  points_cost: number;
  week_identifier: string;
  is_active: boolean;
  times_used: number;
  created_at: string;
  user?: DbProfile;
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
  slip_url?: string | null;
  slip_uploaded_at?: string | null;
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

  // Auto-heal: If user is authenticated but somehow has no household, automatically create & join one
  if (!data.household_id) {
    try {
      const { data: rpcRes } = await supabase.rpc('create_household_and_join', {
        household_name: 'Bobbies Homie',
      });
      if (rpcRes && (rpcRes as { success?: boolean; household_id?: string }).success) {
        data.household_id = (rpcRes as { household_id: string }).household_id;
      }
    } catch (e) {
      console.warn('Auto-heal household error:', e);
    }
  }

  return data as DbProfile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<DbProfile>
): Promise<DbProfile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ 
      ...updates, 
      updated_at: new Date().toISOString() 
    } as Database['public']['Tables']['profiles']['Update'])
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DbProfile;
}

export async function updateUserFcmToken(userId: string, token: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ 
      fcm_token: token, 
      updated_at: new Date().toISOString() 
    } as Database['public']['Tables']['profiles']['Update'])
    .eq('id', userId);

  if (error) {
    console.warn('Failed to save FCM token:', error.message);
  }
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
  const name = householdName.trim() || 'Bobbies Homie';

  // 1. Try atomic SECURITY DEFINER RPC
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_household_and_join', {
      household_name: name,
    });

    if (!rpcErr && rpcRes && (rpcRes as { success?: boolean; household_id?: string }).success) {
      const hId = (rpcRes as { household_id: string }).household_id;
      const created = await fetchHousehold(hId);
      if (created) return created;
    }
  } catch (e) {
    console.warn('RPC create_household_and_join notice:', e);
  }

  // 2. Direct fallback
  const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const { data: household, error: houseError } = await supabase
    .from('households')
    .insert({
      name,
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

  // 1. Try atomic SECURITY DEFINER RPC
  try {
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('join_household_by_invite', {
      invite_code_input: cleanCode,
    });

    if (!rpcErr && rpcRes) {
      const res = rpcRes as { success?: boolean; household_id?: string; error?: string };
      if (res.success && res.household_id) {
        const joined = await fetchHousehold(res.household_id);
        if (joined) return joined;
      } else if (res.error) {
        throw new Error(res.error);
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message !== 'Invalid invite code') {
      throw e;
    }
  }

  // 2. Direct fallback
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
        .insert(itemsToInsert as Database['public']['Tables']['shopping_items']['Insert'][])
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

export async function deleteShoppingItem(itemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('shopping_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function updateShoppingItem(
  itemId: string,
  updates: { title?: string; quantity?: string }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('shopping_items').update(updates).eq('id', itemId);
  if (error) throw new Error(error.message);
}

export async function deleteShoppingList(listId: string): Promise<void> {
  const supabase = createClient();
  await supabase.from('shopping_items').delete().eq('list_id', listId);
  const { error } = await supabase.from('shopping_lists').delete().eq('id', listId);
  if (error) throw new Error(error.message);
}

export async function updateShoppingList(
  listId: string,
  updates: { title?: string; date?: string; location?: string }
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('shopping_lists').update(updates).eq('id', listId);
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
    description?: string | null;
    assigned_to?: string | null;
    frequency?: string;
    points?: number;
    due_date?: string | null;
  }
): Promise<DbChore> {
  const supabase = createClient();
  const assignedTo = chore.assigned_to && chore.assigned_to !== 'All' ? chore.assigned_to : null;
  const { data, error } = await (supabase.from('chores') as any)
    .insert({
      household_id: householdId,
      title: chore.title,
      description: chore.description || null,
      assigned_to: assignedTo,
      frequency: (chore.frequency as Database['public']['Enums']['chore_frequency']) || 'daily',
      points: chore.points ?? 10,
      due_date: chore.due_date || null,
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

export async function updateChore(
  choreId: string,
  updates: Partial<DbChore>
): Promise<DbChore> {
  const supabase = createClient();
  const payload = { ...updates };
  if (payload.assigned_to === ('All' as any)) {
    payload.assigned_to = null as any;
  }
  const { data, error } = await (supabase
    .from('chores') as any)
    .update(payload)
    .eq('id', choreId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DbChore;
}

export async function deleteChore(choreId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('chores').delete().eq('id', choreId);
  if (error) throw new Error(error.message);
}

export async function completeChoreWithAssignees(
  choreId: string,
  isCompleted: boolean,
  assigneeIds?: string[] | null
): Promise<{
  success: boolean;
  new_balance: number;
  points_delta: number;
  multiplier?: number;
  chore_id?: string;
  is_completed?: boolean;
}> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('complete_chore_with_assignees', {
    p_chore_id: choreId,
    p_completed: isCompleted,
    p_assignee_ids: assigneeIds && assigneeIds.length > 0 ? assigneeIds : null,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function toggleChoreWithPoints(
  choreId: string,
  isCompleted: boolean
): Promise<{
  success: boolean;
  new_balance: number;
  points_delta: number;
  multiplier?: number;
  chore_id?: string;
  is_completed?: boolean;
}> {
  return completeChoreWithAssignees(choreId, isCompleted, null);
}

// ---------------------------------------------------------------------------
// Chore Rewards & Store
// ---------------------------------------------------------------------------

export async function fetchChoreRewards(householdId: string): Promise<DbChoreReward[]> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('chore_rewards') as any)
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data || []) as DbChoreReward[]).filter((r) => r.title !== '__GACHA_CONFIG__');
}

export async function createChoreReward(
  householdId: string,
  userId: string,
  reward: {
    title: string;
    description?: string;
    points_cost: number;
    icon?: string;
  }
): Promise<DbChoreReward> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('chore_rewards') as any)
    .insert({
      household_id: householdId,
      title: reward.title,
      description: reward.description || null,
      points_cost: reward.points_cost,
      icon: reward.icon || 'Gift',
      created_by: userId,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create reward');
  return data as DbChoreReward;
}

export async function updateChoreReward(
  rewardId: string,
  reward: Partial<DbChoreReward>
): Promise<DbChoreReward> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('chore_rewards') as any)
    .update({
      title: reward.title,
      description: reward.description,
      points_cost: reward.points_cost,
      icon: reward.icon,
      updated_at: new Date().toISOString(),
    })
    .eq('id', rewardId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as DbChoreReward;
}

export async function deleteChoreReward(rewardId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await (supabase.from('chore_rewards') as any).delete().eq('id', rewardId);
  if (error) throw new Error(error.message);
}

export async function proposeCreateChoreReward(
  householdId: string,
  userId: string,
  reward: {
    title: string;
    description?: string;
    points_cost: number;
    icon?: string;
  },
  needsApproval: boolean
): Promise<DbChoreReward> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('chore_rewards') as any)
    .insert({
      household_id: householdId,
      title: reward.title,
      description: reward.description || null,
      points_cost: reward.points_cost,
      icon: reward.icon || 'Gift',
      created_by: userId,
      proposed_by: needsApproval ? userId : null,
      status: needsApproval ? 'pending_create' : 'active',
      approvals: { [userId]: { approved: true, updated_at: new Date().toISOString() } },
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to propose reward');
  return data as DbChoreReward;
}

export async function proposeEditChoreReward(
  rewardId: string,
  userId: string,
  payload: {
    title: string;
    description?: string;
    points_cost: number;
    icon?: string;
  }
): Promise<DbChoreReward> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('chore_rewards') as any)
    .update({
      status: 'pending_edit',
      proposed_by: userId,
      pending_payload: payload,
      approvals: { [userId]: { approved: true, updated_at: new Date().toISOString() } },
      updated_at: new Date().toISOString(),
    })
    .eq('id', rewardId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to propose edit');
  return data as DbChoreReward;
}

export async function proposeDeleteChoreReward(
  rewardId: string,
  userId: string
): Promise<DbChoreReward> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('chore_rewards') as any)
    .update({
      status: 'pending_delete',
      proposed_by: userId,
      approvals: { [userId]: { approved: true, updated_at: new Date().toISOString() } },
      updated_at: new Date().toISOString(),
    })
    .eq('id', rewardId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to propose delete');
  return data as DbChoreReward;
}

export async function cancelChoreRewardProposal(
  reward: DbChoreReward
): Promise<void> {
  const supabase = createClient();
  if (reward.status === 'pending_create') {
    const { error } = await (supabase.from('chore_rewards') as any).delete().eq('id', reward.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await (supabase.from('chore_rewards') as any)
      .update({
        status: 'active',
        proposed_by: null,
        pending_payload: null,
        approvals: {},
        updated_at: new Date().toISOString(),
      })
      .eq('id', reward.id);
    if (error) throw new Error(error.message);
  }
}

export async function respondChoreRewardProposal(
  reward: DbChoreReward,
  approved: boolean
): Promise<{ success: boolean; action: string }> {
  const supabase = createClient();
  if (reward.status === 'pending_create') {
    if (approved) {
      const { error } = await (supabase.from('chore_rewards') as any)
        .update({
          status: 'active',
          proposed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reward.id);
      if (error) throw new Error(error.message);
      return { success: true, action: 'create_approved' };
    } else {
      const { error } = await (supabase.from('chore_rewards') as any).delete().eq('id', reward.id);
      if (error) throw new Error(error.message);
      return { success: true, action: 'create_rejected' };
    }
  } else if (reward.status === 'pending_edit') {
    if (approved && reward.pending_payload) {
      const { error } = await (supabase.from('chore_rewards') as any)
        .update({
          title: reward.pending_payload.title || reward.title,
          description:
            reward.pending_payload.description !== undefined
              ? reward.pending_payload.description
              : reward.description,
          points_cost: reward.pending_payload.points_cost || reward.points_cost,
          icon: reward.pending_payload.icon || reward.icon,
          status: 'active',
          proposed_by: null,
          pending_payload: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reward.id);
      if (error) throw new Error(error.message);
      return { success: true, action: 'edit_approved' };
    } else {
      const { error } = await (supabase.from('chore_rewards') as any)
        .update({
          status: 'active',
          proposed_by: null,
          pending_payload: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reward.id);
      if (error) throw new Error(error.message);
      return { success: true, action: 'edit_rejected' };
    }
  } else if (reward.status === 'pending_delete') {
    if (approved) {
      const { error } = await (supabase.from('chore_rewards') as any).delete().eq('id', reward.id);
      if (error) throw new Error(error.message);
      return { success: true, action: 'delete_approved' };
    } else {
      const { error } = await (supabase.from('chore_rewards') as any)
        .update({
          status: 'active',
          proposed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reward.id);
      if (error) throw new Error(error.message);
      return { success: true, action: 'delete_rejected' };
    }
  }
  return { success: false, action: 'unknown' };
}

// ---------------------------------------------------------------------------
// Reward Gacha Configuration (Dual Approval)
// ---------------------------------------------------------------------------

export async function fetchGachaConfig(householdId: string): Promise<DbChoreReward | null> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('chore_rewards') as any)
    .select('*')
    .eq('household_id', householdId)
    .eq('title', '__GACHA_CONFIG__')
    .maybeSingle();

  if (error || !data) return null;
  return data as DbChoreReward;
}

export async function proposeGachaConfig(
  householdId: string,
  userId: string,
  payload: {
    cost: number;
    prizes: any[];
  },
  needsApproval: boolean
): Promise<DbChoreReward> {
  const supabase = createClient();
  const existing = await fetchGachaConfig(householdId);
  const jsonPrizes = JSON.stringify(payload.prizes);

  if (!existing) {
    const { data, error } = await (supabase
      .from('chore_rewards') as any)
      .insert({
        household_id: householdId,
        title: '__GACHA_CONFIG__',
        description: needsApproval ? jsonPrizes : jsonPrizes,
        points_cost: payload.cost,
        icon: 'Dices',
        created_by: userId,
        proposed_by: needsApproval ? userId : null,
        status: needsApproval ? 'pending_edit' : 'active',
        pending_payload: needsApproval
          ? {
              points_cost: payload.cost,
              description: jsonPrizes,
              gacha_cost: payload.cost,
              gacha_prizes: payload.prizes,
            }
          : null,
        approvals: { [userId]: { approved: true, updated_at: new Date().toISOString() } },
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || 'Failed to propose gacha config');
    return data as DbChoreReward;
  } else {
    const { data, error } = await (supabase
      .from('chore_rewards') as any)
      .update(
        needsApproval
          ? {
              status: 'pending_edit',
              proposed_by: userId,
              pending_payload: {
                points_cost: payload.cost,
                description: jsonPrizes,
                gacha_cost: payload.cost,
                gacha_prizes: payload.prizes,
              },
              approvals: { [userId]: { approved: true, updated_at: new Date().toISOString() } },
              updated_at: new Date().toISOString(),
            }
          : {
              status: 'active',
              points_cost: payload.cost,
              description: jsonPrizes,
              proposed_by: null,
              pending_payload: null,
              approvals: {},
              updated_at: new Date().toISOString(),
            }
      )
      .eq('id', existing.id)
      .select()
      .single();

    if (error || !data) throw new Error(error?.message || 'Failed to update gacha config');
    return data as DbChoreReward;
  }
}

export async function respondGachaConfigProposal(
  reward: DbChoreReward,
  approved: boolean
): Promise<{ success: boolean; action: string }> {
  const supabase = createClient();
  if (approved && reward.pending_payload) {
    const payload = reward.pending_payload;
    const { error } = await (supabase.from('chore_rewards') as any)
      .update({
        points_cost: payload.points_cost ?? payload.gacha_cost ?? reward.points_cost,
        description: payload.description || (payload.gacha_prizes ? JSON.stringify(payload.gacha_prizes) : reward.description),
        status: 'active',
        proposed_by: null,
        pending_payload: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reward.id);
    if (error) throw new Error(error.message);
    return { success: true, action: 'gacha_approved' };
  } else {
    const { error } = await (supabase.from('chore_rewards') as any)
      .update({
        status: 'active',
        proposed_by: null,
        pending_payload: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reward.id);
    if (error) throw new Error(error.message);
    return { success: true, action: 'gacha_rejected' };
  }
}

export async function cancelGachaConfigProposal(reward: DbChoreReward): Promise<void> {
  const supabase = createClient();
  const { error } = await (supabase.from('chore_rewards') as any)
    .update({
      status: 'active',
      proposed_by: null,
      pending_payload: null,
      approvals: {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', reward.id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Reward Redemptions & Approvals
// ---------------------------------------------------------------------------

export async function fetchRewardRedemptions(householdId: string): Promise<DbRewardRedemption[]> {
  const supabase = createClient();
  const { data, error } = await (supabase
    .from('reward_redemptions') as any)
    .select('*, user:profiles(*)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as DbRewardRedemption[];
}

export async function requestRewardRedemption(
  rewardId: string
): Promise<{ success: boolean; redemption_id: string }> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('request_reward_redemption', {
    p_reward_id: rewardId,
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function respondRewardRedemption(
  redemptionId: string,
  approved: boolean,
  reason?: string
): Promise<{ success: boolean; status: string; requester_new_balance?: number }> {
  const supabase = createClient();
  const { data, error } = await (supabase.rpc as any)('respond_reward_redemption', {
    p_redemption_id: redemptionId,
    p_approved: approved,
    p_reason: reason || null,
  });

  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------------------
// Chore Points Logs & Ledger
// ---------------------------------------------------------------------------

export async function fetchChorePointLogs(
  householdId: string,
  userId?: string
): Promise<DbChorePointLog[]> {
  const supabase = createClient();
  let query = (supabase.from('chore_point_logs') as any)
    .select('*, user:profiles(*)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as DbChorePointLog[];
}

export async function fetchUserChorePoints(userId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('chore_points')
    .eq('id', userId)
    .single();

  if (error || !data) return 0;
  return ((data as any).chore_points as number) || 0;
}

// ---------------------------------------------------------------------------
// Chore Mystery Box / Gacha
// ---------------------------------------------------------------------------

export function getWeekIdentifier(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export async function fetchChoreGachaSpins(householdId: string): Promise<DbChoreGachaSpin[]> {
  const supabase = createClient();
  const { data, error } = await (supabase as any)
    .from('chore_gacha_spins')
    .select('*, user:profiles(*)')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []) as DbChoreGachaSpin[];
}

export async function fetchMyActiveGachaSpin(userId: string): Promise<DbChoreGachaSpin | null> {
  const supabase = createClient();
  const currentWeek = getWeekIdentifier();
  const { data, error } = await (supabase as any)
    .from('chore_gacha_spins')
    .select('*, user:profiles(*)')
    .eq('user_id', userId)
    .eq('week_identifier', currentWeek)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data as DbChoreGachaSpin | null;
}

export async function resetMyWeeklyGachaSpin(userId: string): Promise<boolean> {
  const supabase = createClient();
  const currentWeek = getWeekIdentifier();
  const { error } = await (supabase as any)
    .from('chore_gacha_spins')
    .delete()
    .eq('user_id', userId)
    .eq('week_identifier', currentWeek);

  return !error;
}

export async function spinChoreGacha(params: {
  householdId: string;
  userId: string;
  choreId?: string | null;
  choreTitle: string;
  multiplier: number;
  pointsCost: number;
}): Promise<{
  success: boolean;
  spin_id?: string;
  new_balance?: number;
  multiplier?: number;
  chore_title?: string;
  error?: string;
}> {
  const supabase = createClient();
  const currentWeek = getWeekIdentifier();
  const { data, error } = await (supabase.rpc as any)('spin_chore_gacha', {
    p_household_id: params.householdId,
    p_user_id: params.userId,
    p_chore_id: params.choreId || null,
    p_chore_title: params.choreTitle,
    p_multiplier: params.multiplier,
    p_points_cost: params.pointsCost,
    p_week: currentWeek,
  });

  if (error) throw new Error(error.message);
  return data;
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
    } as Database['public']['Tables']['calendar_events']['Insert'])
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

export async function updateCalendarEvent(
  eventId: string,
  updates: {
    title?: string;
    start_time?: string;
    end_time?: string;
    location?: string | null;
    category?: string;
    assigned_to?: string;
    color_tag?: string;
  }
): Promise<DbCalendarEvent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('calendar_events')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to update event');
  return data as unknown as DbCalendarEvent;
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
    })
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
      log_type: (log.log_type as Database['public']['Enums']['pet_log_type']) || 'vet',
      title: log.title,
      scheduled_date: log.scheduled_date,
      is_done: false,
    })
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

export async function deletePetLog(logId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('pet_logs').delete().eq('id', logId);
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
      category: (finance.category as Database['public']['Enums']['finance_category']) || 'groceries',
      paid_by: finance.paid_by,
      date: finance.date || new Date().toISOString().split('T')[0],
      is_reimbursed: false,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create finance record');
  return data as unknown as DbFinance;
}

export async function updateFinance(
  financeId: string,
  updates: {
    title?: string;
    amount?: number;
    category?: string;
    paid_by?: string;
    is_reimbursed?: boolean;
    slip_url?: string | null;
    slip_uploaded_at?: string | null;
  }
): Promise<DbFinance> {
  const supabase = createClient();
  const dbUpdates: Record<string, unknown> = {
    ...updates,
    ...(updates.category ? { category: updates.category as Database['public']['Enums']['finance_category'] } : {}),
  };
  const { data, error } = await supabase
    .from('shared_finances')
    .update(dbUpdates as Database['public']['Tables']['shared_finances']['Update'])
    .eq('id', financeId)
    .select()
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to update finance record');
  return data as unknown as DbFinance;
}

export async function deleteOldSlips(householdId: string): Promise<void> {
  const supabase = createClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Find records with old slips
  const { data: oldSlips } = await supabase
    .from('shared_finances')
    .select('id, slip_url')
    .eq('household_id', householdId)
    .not('slip_url', 'is', null)
    .lt('slip_uploaded_at', sevenDaysAgo.toISOString()) as { data: Array<{ id: string; slip_url: string | null }> | null };

  if (!oldSlips || oldSlips.length === 0) return;

  // Delete the actual files from storage
  for (const record of oldSlips) {
    if (record.slip_url) {
      try {
        const url = new URL(record.slip_url);
        const pathParts = url.pathname.split('/transfer-slips/');
        if (pathParts.length > 1) {
          await supabase.storage.from('transfer-slips').remove([pathParts[1]]);
        }
      } catch {
        // ignore individual file deletion errors
      }
    }
  }

  // Clear slip_url from records (keep history)
  const ids = oldSlips.map((r) => r.id);
  await supabase
    .from('shared_finances')
    .update({ slip_url: null, slip_uploaded_at: null })
    .in('id', ids);
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
