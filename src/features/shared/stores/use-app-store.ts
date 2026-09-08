import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export type ActivityCategory = 'shopping' | 'pets' | 'finance' | 'chore' | 'date';

export interface HouseholdActivity {
  id: string;
  day: number; // Day of month (1-31)
  dateString: string; // e.g. "2026-10-15"
  title: string;
  time: string;
  location?: string;
  category: ActivityCategory;
  categoryLabel: string;
  color: string;
  bgColor: string;
  icon: string;
  linkUrl: string;
  assignedTo?: 'Partner1' | 'Partner2' | 'Both' | string;
  completed?: boolean;
}

export interface ShoppingItemRecord {
  id: string;
  title: string;
  category: 'grocery' | 'household' | 'health' | 'pets';
  quantity: string;
  isPurchased: boolean;
  addedBy: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  category: string;
  amount: number;
  paidBy: string;
  status: 'pending' | 'resolved' | 'unsettled';
  statusText?: string;
  statusBg?: string;
  statusColor?: string;
  createdAt: string;
}

export interface PetItem {
  id: string;
  name: string;
  breed: string;
  gender: 'male' | 'female';
  photoUrl?: string;
  colorTag?: string;
}

export interface PetRecord {
  id: string;
  petId: string;
  type: 'vaccine' | 'grooming' | 'vet';
  title: string;
  dateText: string;
  status: 'upcoming' | 'past';
  statusDot?: string;
}

export interface ChoreRecord {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  assignedTo: string;
  points: number;
  isCompleted: boolean;
  dueDate?: string;
}

export interface CoupleMemory {
  id: string;
  url: string;
  caption: string;
  tag: 'Memory' | 'Pet' | 'Date Night' | 'Home';
  date: string;
}

export interface HouseholdProfile {
  name: string;
  inviteCode: string;
  anniversaryDate: string;
  myNickname: string;
  partnerNickname: string;
  myRole: string;
  partnerRole: string;
  myAvatarUrl: string | null;
  partnerAvatarUrl: string | null;
  myBio: string;
  partnerBio: string;
}

interface AppState {
  // Mobile UI States
  isOnline: boolean;
  activeQuickActionModal: 'shopping' | 'chore' | 'finance' | 'calendar' | null;
  activeTab: 'dashboard' | 'shopping' | 'calendar' | 'pets' | 'finances';
  unreadNotificationsCount: number;

  // Household Profile
  profile: HouseholdProfile;

  // Household Data (Real, Empty by default)
  activities: HouseholdActivity[];
  shoppingItems: ShoppingItemRecord[];
  expenses: ExpenseRecord[];
  pets: PetItem[];
  petRecords: PetRecord[];
  chores: ChoreRecord[];
  memories: CoupleMemory[];

  // Actions
  setIsOnline: (status: boolean) => void;
  openQuickActionModal: (type: AppState['activeQuickActionModal']) => void;
  closeQuickActionModal: () => void;
  setActiveTab: (tab: AppState['activeTab']) => void;
  setUnreadNotificationsCount: (count: number) => void;
  updateProfile: (profile: Partial<HouseholdProfile>) => void;

  // Data Mutations
  addActivity: (activity: Omit<HouseholdActivity, 'id'>) => void;
  deleteActivity: (id: string) => void;
  toggleActivityCompleted: (id: string) => void;

  addShoppingItem: (item: Omit<ShoppingItemRecord, 'id' | 'createdAt'>) => void;
  toggleShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;

  addExpense: (expense: Omit<ExpenseRecord, 'id' | 'createdAt'>) => void;
  toggleExpenseStatus: (id: string) => void;
  settleAllExpenses: () => void;
  deleteExpense: (id: string) => void;

  addPet: (pet: Omit<PetItem, 'id'>) => void;
  deletePet: (id: string) => void;
  addPetRecord: (record: Omit<PetRecord, 'id'>) => void;
  deletePetRecord: (id: string) => void;

  addChore: (chore: Omit<ChoreRecord, 'id'>) => void;
  toggleChore: (id: string) => void;
  deleteChore: (id: string) => void;

  addMemory: (memory: Omit<CoupleMemory, 'id'>) => void;
  deleteMemory: (id: string) => void;
}

// Activity metadata color-coded by page purpose (Clean, no emojis)
export const ACTIVITY_META: Record<ActivityCategory, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  linkUrl: string;
}> = {
  shopping: {
    label: 'ซื้อของเข้าบ้าน',
    color: '#2E7D32',
    bgColor: '#C8E6C9',
    icon: 'shopping-cart',
    linkUrl: '/shopping',
  },
  pets: {
    label: 'ดูแลสัตว์เลี้ยง',
    color: '#E65100',
    bgColor: '#FFE0B2',
    icon: 'paw',
    linkUrl: '/pets',
  },
  finance: {
    label: 'จ่ายบิลและค่าใช้จ่าย',
    color: '#1565C0',
    bgColor: '#BBDEFB',
    icon: 'wallet',
    linkUrl: '/finances',
  },
  chore: {
    label: 'งานบ้าน',
    color: '#6A1B9A',
    bgColor: '#E1BEE7',
    icon: 'sparkles',
    linkUrl: '/dashboard',
  },
  date: {
    label: 'เดทและกิจกรรมพิเศษ',
    color: '#C2185B',
    bgColor: '#F8BBD0',
    icon: 'bear',
    linkUrl: '/profile',
  },
};

const DEFAULT_PROFILE: HouseholdProfile = {
  name: 'Bobbies Homie',
  inviteCode: '',
  anniversaryDate: '',
  myNickname: 'Me',
  partnerNickname: 'Partner',
  myRole: 'Home Care',
  partnerRole: 'Home Care',
  myAvatarUrl: null,
  partnerAvatarUrl: null,
  myBio: '',
  partnerBio: '',
};

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        isOnline: true,
        activeQuickActionModal: null,
        activeTab: 'dashboard',
        unreadNotificationsCount: 0,

        profile: DEFAULT_PROFILE,

        // Real data arrays (Clean initial state)
        activities: [],
        shoppingItems: [],
        expenses: [],
        pets: [],
        petRecords: [],
        chores: [],
        memories: [],

        setIsOnline: (status) => set({ isOnline: status }),
        openQuickActionModal: (type) => set({ activeQuickActionModal: type }),
        closeQuickActionModal: () => set({ activeQuickActionModal: null }),
        setActiveTab: (tab) => set({ activeTab: tab }),
        setUnreadNotificationsCount: (count) => set({ unreadNotificationsCount: count }),

        updateProfile: (updated) =>
          set((state) => ({
            profile: { ...state.profile, ...updated },
          })),

        // Activities
        addActivity: (activity) =>
          set((state) => ({
            activities: [
              ...state.activities,
              { ...activity, id: `act-${Date.now()}` },
            ],
          })),

        deleteActivity: (id) =>
          set((state) => ({
            activities: state.activities.filter((a) => a.id !== id),
          })),

        toggleActivityCompleted: (id) =>
          set((state) => ({
            activities: state.activities.map((a) =>
              a.id === id ? { ...a, completed: !a.completed } : a
            ),
          })),

        // Shopping
        addShoppingItem: (item) =>
          set((state) => ({
            shoppingItems: [
              {
                ...item,
                id: `shop-${Date.now()}`,
                createdAt: new Date().toISOString(),
              },
              ...state.shoppingItems,
            ],
          })),

        toggleShoppingItem: (id) =>
          set((state) => ({
            shoppingItems: state.shoppingItems.map((i) =>
              i.id === id ? { ...i, isPurchased: !i.isPurchased } : i
            ),
          })),

        deleteShoppingItem: (id) =>
          set((state) => ({
            shoppingItems: state.shoppingItems.filter((i) => i.id !== id),
          })),

        // Expenses
        addExpense: (expense) =>
          set((state) => ({
            expenses: [
              {
                ...expense,
                id: `exp-${Date.now()}`,
                createdAt: new Date().toISOString(),
              },
              ...state.expenses,
            ],
          })),

        toggleExpenseStatus: (id) =>
          set((state) => ({
            expenses: state.expenses.map((e) => {
              if (e.id !== id) return e;
              if (e.status === 'resolved') {
                return {
                  ...e,
                  status: 'pending',
                  statusBg: '#FFE0B2',
                  statusColor: '#E65100',
                };
              }
              return {
                ...e,
                status: 'resolved',
                statusBg: '#C8E6C9',
                statusColor: '#2E7D32',
              };
            }),
          })),

        settleAllExpenses: () =>
          set((state) => ({
            expenses: state.expenses.map((e) => ({
              ...e,
              status: 'resolved',
              statusBg: '#C8E6C9',
              statusColor: '#2E7D32',
            })),
          })),

        deleteExpense: (id) =>
          set((state) => ({
            expenses: state.expenses.filter((e) => e.id !== id),
          })),

        // Pets
        addPet: (pet) =>
          set((state) => ({
            pets: [...state.pets, { ...pet, id: `pet-${Date.now()}` }],
          })),

        deletePet: (id) =>
          set((state) => ({
            pets: state.pets.filter((p) => p.id !== id),
            petRecords: state.petRecords.filter((r) => r.petId !== id),
          })),

        addPetRecord: (record) =>
          set((state) => ({
            petRecords: [{ ...record, id: `pet-rec-${Date.now()}` }, ...state.petRecords],
          })),

        deletePetRecord: (id) =>
          set((state) => ({
            petRecords: state.petRecords.filter((r) => r.id !== id),
          })),

        // Chores
        addChore: (chore) =>
          set((state) => ({
            chores: [{ ...chore, id: `ch-${Date.now()}` }, ...state.chores],
          })),

        toggleChore: (id) =>
          set((state) => ({
            chores: state.chores.map((c) =>
              c.id === id ? { ...c, isCompleted: !c.isCompleted } : c
            ),
          })),

        deleteChore: (id) =>
          set((state) => ({
            chores: state.chores.filter((c) => c.id !== id),
          })),

        // Memories
        addMemory: (memory) =>
          set((state) => ({
            memories: [{ ...memory, id: `mem-${Date.now()}` }, ...state.memories],
          })),

        deleteMemory: (id) =>
          set((state) => ({
            memories: state.memories.filter((m) => m.id !== id),
          })),
      }),
      {
        name: 'homie-app-storage-v2',
      }
    )
  )
);
