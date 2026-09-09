'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ChevronLeft, 
  ShoppingCart, 
  Calendar as CalendarIcon, 
  Wallet, 
  PawPrint, 
  Sparkles, 
  Image as ImageIcon,
  Check, 
  Plus,
  Trash2,
  Camera,
  Loader2,
  Users,
  User
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { 
  createBatchShoppingList,
  createCalendarEvent,
  createFinance,
  createPet,
  createPetLog,
  createChore,
  createMemory,
  fetchHouseholdMembers,
  fetchPets,
  type DbProfile,
  type DbPet
} from '@/lib/services/db';
import { uploadPetPhoto } from '@/lib/services/storage';
import { useLanguage } from '@/lib/i18n/language-context';

type CreationTab = 'shopping' | 'calendar' | 'finance' | 'pets' | 'chores' | 'memory';

interface ShoppingItemRow {
  title: string;
  quantity: string;
  category: string;
}

function CreatePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, language } = useLanguage();
  const supabase = createClient();

  const initialTab = (searchParams.get('tab') as CreationTab) || 'shopping';
  const [activeTab, setActiveTab] = useState<CreationTab>(initialTab);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  // User & Household Data
  const [currentUser, setCurrentUser] = useState<DbProfile | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<DbProfile[]>([]);
  const [householdPets, setHouseholdPets] = useState<DbPet[]>([]);

  // 1. Shopping Form State (Batch Multi-Item Creation)
  const [shopListTitle, setShopListTitle] = useState('');
  const [shopListDate, setShopListDate] = useState(new Date().toISOString().split('T')[0]);
  const [shopListLocation, setShopListLocation] = useState('');
  const [shopItems, setShopItems] = useState<ShoppingItemRow[]>([
    { title: '', quantity: '1', category: 'grocery' }
  ]);

  // 2. Calendar Form State
  const [calTitle, setCalTitle] = useState('');
  const [calCategory, setCalCategory] = useState<string>('date');
  const [calDate, setCalDate] = useState(new Date().toISOString().split('T')[0]);
  const [calTime, setCalTime] = useState('14:00');
  const [calLocation, setCalLocation] = useState('');
  const [calAssigned, setCalAssigned] = useState<string>('All');

  // 3. Finance Form State
  const [finTitle, setFinTitle] = useState('');
  const [finAmount, setFinAmount] = useState('');
  const [finCategory, setFinCategory] = useState('groceries');
  const [finPaidBy, setFinPaidBy] = useState<string>('Me');

  // 4. Pet Form State
  const [petFormMode, setPetFormMode] = useState<'new_pet' | 'care_log'>('new_pet');
  // New Pet
  const [newPetName, setNewPetName] = useState('');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [newPetGender, setNewPetGender] = useState<'male' | 'female'>('male');
  const [newPetPhoto, setNewPetPhoto] = useState<File | null>(null);
  const [newPetPhotoPreview, setNewPetPhotoPreview] = useState<string | null>(null);
  const petFileInputRef = useRef<HTMLInputElement>(null);
  // Pet Log
  const [selectedPetId, setSelectedPetId] = useState<string>('');
  const [petLogType, setPetLogType] = useState<'vaccine' | 'grooming'>('vaccine');
  const [petLogTitle, setPetLogTitle] = useState('');
  const [petLogDate, setPetLogDate] = useState(new Date().toISOString().split('T')[0]);

  // 5. Chore Form State
  const [choreTitle, setChoreTitle] = useState('');
  const [choreFrequency, setChoreFrequency] = useState<string>('weekly');
  const [choreAssignedTo, setChoreAssignedTo] = useState<string>('All');
  const [chorePoints, setChorePoints] = useState(10);

  // 6. Memory Form State
  const [memCaption, setMemCaption] = useState('');
  const [memPhoto, setMemPhoto] = useState<File | null>(null);
  const [memPhotoPreview, setMemPhotoPreview] = useState<string | null>(null);
  const memFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tab = searchParams.get('tab') as CreationTab;
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Fetch Current User & Members
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingData(true);
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          setLoadingData(false);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();

        if (profile) {
          setCurrentUser(profile as DbProfile);
          setFinPaidBy(profile.nickname || profile.full_name || 'Me');

          if (profile.household_id) {
            const members = await fetchHouseholdMembers(profile.household_id);
            setHouseholdMembers(members);

            const petsList = await fetchPets(profile.household_id);
            setHouseholdPets(petsList);
            if (petsList.length > 0) {
              setSelectedPetId(petsList[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed loading profile/members:', err);
      } finally {
        setLoadingData(false);
      }
    };
    init();
  }, []);

  const showSuccessAndRedirect = (msg: string, redirectUrl: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
      router.push(redirectUrl);
    }, 800);
  };

  // 1. Shopping Batch Item Actions
  const handleAddShoppingItemRow = () => {
    setShopItems((prev) => [...prev, { title: '', quantity: '1', category: 'grocery' }]);
  };

  const handleRemoveShoppingItemRow = (index: number) => {
    if (shopItems.length <= 1) return;
    setShopItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateShoppingItem = (index: number, field: keyof ShoppingItemRow, val: string) => {
    setShopItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: val } : it))
    );
  };

  const handleShoppingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopListTitle.trim() || !currentUser?.household_id) return;
    const validItems = shopItems.filter((it) => it.title.trim().length > 0);
    if (validItems.length === 0) {
      alert(language === 'th' ? 'กรุณาระบุสินค้าอย่างน้อย 1 รายการ' : 'Please add at least one item');
      return;
    }

    try {
      setSubmitting(true);
      await createBatchShoppingList(
        currentUser.household_id,
        currentUser.id,
        {
          title: shopListTitle.trim(),
          date: shopListDate || new Date().toISOString().split('T')[0],
          location: shopListLocation.trim() || undefined,
        },
        validItems
      );

      showSuccessAndRedirect(t.create.successShopping, '/shopping');

      // Dispatch Push Notification for Shopping
      const senderName = currentUser.nickname || currentUser.full_name || 'คนในบ้าน';
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: currentUser.household_id,
          excludeUserId: currentUser.id,
          title: '🛒 Bobbies Homie',
          body: language === 'th'
            ? `${senderName} เพิ่มลิสต์ซื้อของใหม่: "${shopListTitle.trim()}" (${validItems.length} รายการ)`
            : `${senderName} added shopping list: "${shopListTitle.trim()}" (${validItems.length} items)`,
          link: '/shopping',
        }),
      }).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกรายการซื้อของไม่สำเร็จ';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Calendar Submit
  const handleCalendarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calTitle.trim() || !currentUser?.household_id) return;

    try {
      setSubmitting(true);
      const startTime = `${calDate}T${calTime}:00Z`;
      const endTime = `${calDate}T23:59:00Z`;

      await createCalendarEvent(currentUser.household_id, currentUser.id, {
        title: calTitle.trim(),
        start_time: startTime,
        end_time: endTime,
        location: calLocation.trim() || undefined,
        category: calCategory,
        assigned_to: calAssigned,
      });

      showSuccessAndRedirect(t.create.successCalendar, '/calendar');

      // Dispatch Push Notification for Calendar Event
      const senderName = currentUser.nickname || currentUser.full_name || 'คนในบ้าน';
      const todayStr = new Date().toISOString().split('T')[0];
      const isToday = calDate === todayStr;

      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: currentUser.household_id,
          excludeUserId: currentUser.id,
          title: '📅 Bobbies Homie',
          body: isToday
            ? (language === 'th'
                ? `${senderName} เพิ่มกิจกรรมสำหรับวันนี้: "${calTitle.trim()}" (${calTime}) 📅`
                : `${senderName} added an event today: "${calTitle.trim()}" (${calTime}) 📅`)
            : (language === 'th'
                ? `${senderName} เพิ่มนัดหมายลงปฏิทิน: "${calTitle.trim()}" วันที่ ${calDate}`
                : `${senderName} scheduled event: "${calTitle.trim()}" on ${calDate}`),
          link: '/calendar',
        }),
      }).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกกิจกรรมไม่สำเร็จ';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Finance Submit
  const handleFinanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(finAmount);
    if (!finTitle.trim() || isNaN(amountNum) || amountNum <= 0 || !currentUser?.household_id) return;

    try {
      setSubmitting(true);
      await createFinance(currentUser.household_id, {
        title: finTitle.trim(),
        amount: amountNum,
        category: finCategory,
        paid_by: currentUser.id,
        date: new Date().toISOString().split('T')[0],
      });

      showSuccessAndRedirect(t.create.successFinance, '/finances');

      // Dispatch Push Notification for New Expense
      const senderName = currentUser.nickname || currentUser.full_name || 'คนในบ้าน';
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: currentUser.household_id,
          excludeUserId: currentUser.id,
          title: '💰 Bobbies Homie',
          body: language === 'th'
            ? `${senderName} เพิ่มค่าใช้จ่ายใหม่: "${finTitle.trim()}" จำนวน ฿${amountNum.toLocaleString('th-TH')} 💸`
            : `${senderName} added expense: "${finTitle.trim()}" ฿${amountNum.toLocaleString()} 💸`,
          link: '/finances',
        }),
      }).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกค่าใช้จ่ายไม่สำเร็จ';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Pet Submit
  const handlePetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.household_id) return;

    try {
      setSubmitting(true);

      if (petFormMode === 'new_pet') {
        if (!newPetName.trim()) return;
        let photoUrl: string | null = null;
        if (newPetPhoto) {
          const tempId = `pet-${Date.now()}`;
          photoUrl = await uploadPetPhoto(newPetPhoto, tempId);
        }

        await createPet(currentUser.household_id, {
          name: newPetName.trim(),
          breed: newPetBreed.trim() || undefined,
          gender: newPetGender,
          photo_url: photoUrl || undefined,
        });

        showSuccessAndRedirect(t.create.successPets, '/pets');
      } else {
        if (!selectedPetId || !petLogTitle.trim()) return;

        await createPetLog({
          pet_id: selectedPetId,
          title: petLogTitle.trim(),
          log_type: petLogType,
          scheduled_date: petLogDate,
        });

        showSuccessAndRedirect(t.create.successPets, '/pets');

        // Dispatch Push Notification for Pet Appointment / Care
        const targetPet = householdPets.find((p) => p.id === selectedPetId);
        const pName = targetPet?.name || 'สัตว์เลี้ยง';
        const actionText =
          petLogType === 'vaccine'
            ? (language === 'th' ? 'ฉีดวัคซีน' : 'vaccination')
            : petLogType === 'grooming'
            ? (language === 'th' ? 'อาบน้ำตัดขน' : 'grooming')
            : (language === 'th' ? 'พบสัตวแพทย์' : 'vet visit');

        fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            householdId: currentUser.household_id,
            excludeUserId: currentUser.id,
            title: '🐾 Bobbies Homie',
            body: language === 'th'
              ? `นัดหมาย ${pName}: วันที่ ${petLogDate} ต้องพาไป${actionText} ("${petLogTitle.trim()}") 🐾`
              : `Appointment for ${pName}: On ${petLogDate} bring for ${actionText} ("${petLogTitle.trim()}") 🐾`,
            link: '/pets',
          }),
        }).catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Chore Submit
  const handleChoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!choreTitle.trim() || !currentUser?.household_id) return;

    try {
      setSubmitting(true);
      await createChore(currentUser.household_id, currentUser.id, {
        title: choreTitle.trim(),
        assigned_to: choreAssignedTo === 'All' ? null : choreAssignedTo,
        frequency: choreFrequency,
        points: chorePoints,
      });

      showSuccessAndRedirect(t.create.successChores, '/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกงานบ้านไม่สำเร็จ';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Memory Submit
  const handleMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.household_id) return;

    try {
      setSubmitting(true);
      let photoUrl = '';
      if (memPhoto) {
        photoUrl = await uploadPetPhoto(memPhoto, `memory-${Date.now()}`);
      }

      if (!photoUrl) {
        alert(language === 'th' ? 'กรุณาเลือกรูปภาพ' : 'Please select an image');
        setSubmitting(false);
        return;
      }

      await createMemory(currentUser.household_id, currentUser.id, photoUrl, memCaption.trim() || undefined);
      showSuccessAndRedirect(t.create.successMemory, '/profile');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกรูปภาพไม่สำเร็จ';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1A1816] select-none w-full max-w-md sm:max-w-[448px] mx-auto pb-28 transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
        <Link
          href="/dashboard"
          className="p-1.5 -ml-1.5 text-[#5D4037] dark:text-[#DDD7D2] hover:text-[#4A332C] rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 stroke-current" />
        </Link>
        <h1 className="font-outfit font-bold text-[20px] text-[#5D4037] dark:text-[#DDD7D2]">
          {t.create.title}
        </h1>
        <div className="w-8" />
      </div>

      <div className="px-6 pb-3 text-center">
        <p className="font-dm-sans text-[13px] leading-[18px] text-[#8D6E63] dark:text-[#948D87]">
          {t.create.subtitle}
        </p>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="mx-6 mb-4 p-3.5 bg-[#C8E6C9] dark:bg-[#1B5E20] border border-[#A5D6A7] dark:border-[#2E7D32] rounded-[18px] flex items-center gap-2 text-[#2E7D32] dark:text-[#C8E6C9] shadow-xs animate-in fade-in">
          <Check className="w-4 h-4 stroke-current" strokeWidth={2.5} />
          <span className="font-dm-sans text-[13px] font-semibold">{successMessage}</span>
        </div>
      )}

      {/* Tab Selectors */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'shopping', label: t.create.shoppingTab, icon: ShoppingCart },
            { id: 'calendar', label: t.create.calendarTab, icon: CalendarIcon },
            { id: 'finance', label: t.create.financeTab, icon: Wallet },
            { id: 'pets', label: t.create.petsTab, icon: PawPrint },
            { id: 'chores', label: t.create.choresTab, icon: Sparkles },
            { id: 'memory', label: t.create.memoryTab, icon: ImageIcon },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as CreationTab)}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-[16px] border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#5D4037] dark:bg-[#6E544A] text-white border-[#5D4037] shadow-xs'
                    : 'bg-[#F4EFEA] dark:bg-[#1F1D1B] border-[#D7CCC8] dark:border-[#2E2A27] text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037]'
                }`}
              >
                <Icon className="w-4 h-4 mb-1 stroke-current" />
                <span className="font-dm-sans text-[11px] font-semibold truncate w-full text-center">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Form */}
      <div className="px-6">
        <div className="p-4 bg-white dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[22px] shadow-[0px_4px_16px_rgba(93,64,55,0.03)]">
          {/* 1. Shopping Form: Batch Multi-Item Creation */}
          {activeTab === 'shopping' && (
            <form onSubmit={handleShoppingSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'หัวข้อรายการซื้อของ' : 'Shopping List Title'} *
                </label>
                <input
                  type="text"
                  required
                  value={shopListTitle}
                  onChange={(e) => setShopListTitle(e.target.value)}
                  placeholder={language === 'th' ? 'หัวข้อรายการซื้อของ' : 'Shopping List Title'}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {language === 'th' ? 'วันที่' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={shopListDate}
                    onChange={(e) => setShopListDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {language === 'th' ? 'สถานที่' : 'Location'}
                  </label>
                  <input
                    type="text"
                    value={shopListLocation}
                    onChange={(e) => setShopListLocation(e.target.value)}
                    placeholder={language === 'th' ? 'สถานที่' : 'Location'}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                  />
                </div>
              </div>

              {/* Items in this list */}
              <div className="pt-2 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27]/60">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                    {language === 'th' ? 'รายการของที่ต้องซื้อ (ใส่ได้หลายชิ้น)' : 'Items to Buy (Multiple Items)'}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddShoppingItemRow}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2E7D32] dark:text-[#81C784] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {language === 'th' ? 'เพิ่มรายการ' : 'Add row'}
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar pr-0.5">
                  {shopItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 p-2 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px]">
                      <input
                        type="text"
                        required
                        value={item.title}
                        onChange={(e) => handleUpdateShoppingItem(idx, 'title', e.target.value)}
                        placeholder={language === 'th' ? 'ชื่อของ' : 'Item name'}
                        className="flex-1 px-2.5 py-1.5 bg-white dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[10px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                      />
                      <input
                        type="text"
                        value={item.quantity}
                        onChange={(e) => handleUpdateShoppingItem(idx, 'quantity', e.target.value)}
                        placeholder={language === 'th' ? 'จำนวน' : 'Quantity'}
                        className="w-16 px-2 py-1.5 bg-white dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[10px] text-[12px] text-center text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                      />
                      {shopItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveShoppingItemRow(idx)}
                          className="p-1 text-[#8D6E63] hover:text-red-500 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[16px] text-[14px] font-semibold hover:opacity-95 shadow-xs transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกชุดรายการซื้อของ' : 'Create Shopping List')}
              </button>
            </form>
          )}

          {/* 2. Calendar Form */}
          {activeTab === 'calendar' && (
            <form onSubmit={handleCalendarSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'ชื่อกิจกรรม' : 'Event Title'} *
                </label>
                <input
                  type="text"
                  required
                  value={calTitle}
                  onChange={(e) => setCalTitle(e.target.value)}
                  placeholder={t.calendar.eventTitlePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {language === 'th' ? 'วันที่' : 'Date'}
                  </label>
                  <input
                    type="date"
                    required
                    value={calDate}
                    onChange={(e) => setCalDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {t.calendar.time}
                  </label>
                  <input
                    type="time"
                    required
                    value={calTime}
                    onChange={(e) => setCalTime(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {t.calendar.category}
                  </label>
                  <select
                    value={calCategory}
                    onChange={(e) => setCalCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  >
                    <option value="date">{language === 'th' ? 'กิจกรรมในบ้าน' : 'House Activity'}</option>
                    <option value="shopping">{t.create.shoppingTab}</option>
                    <option value="pets">{t.create.petsTab}</option>
                    <option value="finance">{t.create.financeTab}</option>
                    <option value="chore">{t.create.choresTab}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {language === 'th' ? 'กำหนดให้ใคร' : 'Assign To'}
                  </label>
                  <select
                    value={calAssigned}
                    onChange={(e) => setCalAssigned(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  >
                    <option value="All">{language === 'th' ? 'ทุกคนในบ้าน' : 'All Members'}</option>
                    {currentUser && (
                      <option value={currentUser.nickname || currentUser.full_name || 'Me'}>
                        {currentUser.nickname || currentUser.full_name || 'Me'} ({language === 'th' ? 'ฉัน' : 'Me'})
                      </option>
                    )}
                    {householdMembers
                      .filter((m) => m.id !== currentUser?.id)
                      .map((m) => (
                        <option key={m.id} value={m.nickname || m.full_name || m.username || 'Member'}>
                          {m.nickname || m.full_name || m.username || 'Member'}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.calendar.location}
                </label>
                <input
                  type="text"
                  value={calLocation}
                  onChange={(e) => setCalLocation(e.target.value)}
                  placeholder={t.calendar.locationPlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[16px] text-[14px] font-semibold hover:opacity-95 shadow-xs transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกกิจกรรม' : 'Add Event')}
              </button>
            </form>
          )}

          {/* 3. Finance Form */}
          {activeTab === 'finance' && (
            <form onSubmit={handleFinanceSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.expenseTitlePlaceholder} *
                </label>
                <input
                  type="text"
                  required
                  value={finTitle}
                  onChange={(e) => setFinTitle(e.target.value)}
                  placeholder={t.finances.expenseTitlePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.amount} (THB) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={finAmount}
                  onChange={(e) => setFinAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {t.finances.category}
                  </label>
                  <select
                    value={finCategory}
                    onChange={(e) => setFinCategory(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  >
                    <option value="groceries">{t.finances.groceriesCat}</option>
                    <option value="utilities">{t.finances.utilitiesCat}</option>
                    <option value="dining">{t.finances.diningCat}</option>
                    <option value="household">{t.finances.otherCat}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {t.finances.paidBy}
                  </label>
                  <select
                    value={finPaidBy}
                    onChange={(e) => setFinPaidBy(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  >
                    {currentUser && (
                      <option value={currentUser.nickname || currentUser.full_name || 'Me'}>
                        {currentUser.nickname || currentUser.full_name || 'Me'} ({language === 'th' ? 'ฉัน' : 'Me'})
                      </option>
                    )}
                    {householdMembers
                      .filter((m) => m.id !== currentUser?.id)
                      .map((m) => (
                        <option key={m.id} value={m.nickname || m.full_name || m.username || 'Member'}>
                          {m.nickname || m.full_name || m.username || 'Member'}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[16px] text-[14px] font-semibold hover:opacity-95 shadow-xs transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกค่าใช้จ่าย' : 'Add Expense')}
              </button>
            </form>
          )}

          {/* 4. Pet Form: Add Pet with Photo OR Care Log */}
          {activeTab === 'pets' && (
            <div>
              <div className="flex p-1 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] mb-4">
                <button
                  type="button"
                  onClick={() => setPetFormMode('new_pet')}
                  className={`flex-1 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all cursor-pointer ${
                    petFormMode === 'new_pet'
                      ? 'bg-white dark:bg-[#6E544A] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                      : 'text-[#8D6E63] dark:text-[#948D87]'
                  }`}
                >
                  {language === 'th' ? '+ เพิ่มสัตว์เลี้ยงใหม่' : '+ Add New Pet'}
                </button>
                <button
                  type="button"
                  onClick={() => setPetFormMode('care_log')}
                  className={`flex-1 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all cursor-pointer ${
                    petFormMode === 'care_log'
                      ? 'bg-white dark:bg-[#6E544A] text-[#5D4037] dark:text-[#DDD7D2] shadow-xs'
                      : 'text-[#8D6E63] dark:text-[#948D87]'
                  }`}
                >
                  {language === 'th' ? 'ตารางวัคซีน / กรูมมิ่ง' : 'Care Schedule'}
                </button>
              </div>

              {petFormMode === 'new_pet' ? (
                <form onSubmit={handlePetSubmit} className="space-y-3.5">
                  <div className="flex flex-col items-center justify-center">
                    <input
                      ref={petFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setNewPetPhoto(file);
                          setNewPetPhotoPreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => petFileInputRef.current?.click()}
                      className="w-20 h-20 rounded-[20px] bg-[#F4EFEA] dark:bg-[#141312] border-2 border-dashed border-[#D7CCC8] dark:border-[#2E2A27] overflow-hidden flex flex-col items-center justify-center relative hover:border-[#5D4037] cursor-pointer"
                    >
                      {newPetPhotoPreview ? (
                        <Image src={newPetPhotoPreview} alt="Pet" fill className="object-cover" />
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-[#8D6E63] dark:text-[#948D87] mb-1" />
                          <span className="text-[10px] text-[#8D6E63] dark:text-[#948D87]">
                            {language === 'th' ? 'อัพรูปสัตว์' : 'Upload'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                      {t.pets.petNamePlaceholder} *
                    </label>
                    <input
                      type="text"
                      required
                      value={newPetName}
                      onChange={(e) => setNewPetName(e.target.value)}
                      placeholder={t.pets.petNamePlaceholder}
                      className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                      {t.pets.breedPlaceholder}
                    </label>
                    <input
                      type="text"
                      value={newPetBreed}
                      onChange={(e) => setNewPetBreed(e.target.value)}
                      placeholder={t.pets.breedPlaceholder}
                      className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                      {t.pets.gender}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewPetGender('male')}
                        className={`py-2 rounded-[12px] text-[13px] font-medium border transition-colors cursor-pointer ${
                          newPetGender === 'male'
                            ? 'bg-[#5D4037] dark:bg-[#6E544A] text-white border-[#5D4037]'
                            : 'bg-[#F4EFEA] dark:bg-[#141312] text-[#8D6E63] dark:text-[#948D87] border-[#D7CCC8] dark:border-[#2E2A27]'
                        }`}
                      >
                        {t.pets.male}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPetGender('female')}
                        className={`py-2 rounded-[12px] text-[13px] font-medium border transition-colors cursor-pointer ${
                          newPetGender === 'female'
                            ? 'bg-[#5D4037] dark:bg-[#6E544A] text-white border-[#5D4037]'
                            : 'bg-[#F4EFEA] dark:bg-[#141312] text-[#8D6E63] dark:text-[#948D87] border-[#D7CCC8] dark:border-[#2E2A27]'
                        }`}
                      >
                        {t.pets.female}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full mt-2 py-3 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[16px] text-[14px] font-semibold hover:opacity-95 shadow-xs transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'เพิ่มสัตว์เลี้ยง' : 'Add Pet')}
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePetSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                      {language === 'th' ? 'เลือกสัตว์เลี้ยง' : 'Select Pet'}
                    </label>
                    <select
                      value={selectedPetId}
                      onChange={(e) => setSelectedPetId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                    >
                      {householdPets.length === 0 ? (
                        <option value="">{language === 'th' ? 'ยังไม่มีสัตว์เลี้ยง (โปรดเพิ่มสัตว์เลี้ยงก่อน)' : 'No pets yet'}</option>
                      ) : (
                        householdPets.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                      {language === 'th' ? 'หัวข้อการดูแล' : 'Care Task'} *
                    </label>
                    <input
                      type="text"
                      required
                      value={petLogTitle}
                      onChange={(e) => setPetLogTitle(e.target.value)}
                      placeholder={language === 'th' ? 'หัวข้อการดูแล' : 'Care Task'}
                      className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                        {language === 'th' ? 'ประเภท' : 'Type'}
                      </label>
                      <select
                        value={petLogType}
                        onChange={(e) => setPetLogType(e.target.value as 'vaccine' | 'grooming')}
                        className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                      >
                        <option value="vaccine">{t.pets.vaccinesTab}</option>
                        <option value="grooming">{t.pets.groomingTab}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                        {language === 'th' ? 'วันที่' : 'Date'}
                      </label>
                      <input
                        type="date"
                        required
                        value={petLogDate}
                        onChange={(e) => setPetLogDate(e.target.value)}
                        className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || householdPets.length === 0}
                    className="w-full mt-2 py-3 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[16px] text-[14px] font-semibold hover:opacity-95 shadow-xs transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกตารางดูแล' : 'Save Care Log')}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* 5. Chore Form */}
          {activeTab === 'chores' && (
            <form onSubmit={handleChoreSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.create.choreTitlePlaceholder} *
                </label>
                <input
                  type="text"
                  required
                  value={choreTitle}
                  onChange={(e) => setChoreTitle(e.target.value)}
                  placeholder={t.create.choreTitlePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {t.create.choreFrequency}
                  </label>
                  <select
                    value={choreFrequency}
                    onChange={(e) => setChoreFrequency(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  >
                    <option value="daily">{t.create.daily}</option>
                    <option value="weekly">{t.create.weekly}</option>
                    <option value="monthly">{t.create.monthly}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {language === 'th' ? 'มอบหมายให้ใคร' : 'Assign To'}
                  </label>
                  <select
                    value={choreAssignedTo}
                    onChange={(e) => setChoreAssignedTo(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                  >
                    <option value="All">{language === 'th' ? 'ทุกคนในบ้าน' : 'All Members'}</option>
                    {currentUser && (
                      <option value={currentUser.nickname || currentUser.full_name || 'Me'}>
                        {currentUser.nickname || currentUser.full_name || 'Me'} ({language === 'th' ? 'ฉัน' : 'Me'})
                      </option>
                    )}
                    {householdMembers
                      .filter((m) => m.id !== currentUser?.id)
                      .map((m) => (
                        <option key={m.id} value={m.nickname || m.full_name || m.username || 'Member'}>
                          {m.nickname || m.full_name || m.username || 'Member'}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.create.points}
                </label>
                <input
                  type="number"
                  min={1}
                  value={chorePoints}
                  onChange={(e) => setChorePoints(parseInt(e.target.value) || 10)}
                  placeholder={t.create.points}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[16px] text-[14px] font-semibold hover:opacity-95 shadow-xs transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกงานบ้าน' : 'Add Chore')}
              </button>
            </form>
          )}

          {/* 6. Memory Form */}
          {activeTab === 'memory' && (
            <form onSubmit={handleMemorySubmit} className="space-y-3.5">
              <div className="flex flex-col items-center justify-center">
                <input
                  ref={memFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setMemPhoto(file);
                      setMemPhotoPreview(URL.createObjectURL(file));
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => memFileInputRef.current?.click()}
                  className="w-full h-36 rounded-[18px] bg-[#F4EFEA] dark:bg-[#141312] border-2 border-dashed border-[#D7CCC8] dark:border-[#2E2A27] overflow-hidden flex flex-col items-center justify-center relative hover:border-[#5D4037] cursor-pointer"
                >
                  {memPhotoPreview ? (
                    <Image src={memPhotoPreview} alt="Memory Preview" fill className="object-cover" />
                  ) : (
                    <>
                      <Camera className="w-8 h-8 text-[#8D6E63] dark:text-[#948D87] mb-1" />
                      <span className="text-[12px] text-[#8D6E63] dark:text-[#948D87] font-medium">
                        {language === 'th' ? 'กดเลือกรูปภาพความทรงจำ' : 'Upload photo memory'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.profile.captionPlaceholder}
                </label>
                <input
                  type="text"
                  value={memCaption}
                  onChange={(e) => setMemCaption(e.target.value)}
                  placeholder={t.profile.captionPlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !memPhoto}
                className="w-full mt-2 py-3 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[16px] text-[14px] font-semibold hover:opacity-95 shadow-xs transition-transform active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกภาพความทรงจำ' : 'Save Memory')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen bg-[#FDFBF7] dark:bg-[#141312]">
        <Loader2 className="w-8 h-8 animate-spin text-[#8D6E63]" />
      </div>
    }>
      <CreatePageContent />
    </Suspense>
  );
}
