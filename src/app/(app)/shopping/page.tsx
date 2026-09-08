'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Check, 
  Plus, 
  ShoppingCart,
  Trash2,
  X,
  Calendar as CalendarIcon,
  MapPin,
  ListPlus
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';
import { LanguageToggle } from '@/components/ui/language-toggle';
import { createClient } from '@/lib/supabase/client';
import { 
  fetchShoppingLists, 
  createBatchShoppingList, 
  toggleShoppingItem,
  type DbShoppingList,
  type DbShoppingItem 
} from '@/lib/services/db';

export default function ShoppingPage() {
  const { t, language } = useLanguage();

  const [lists, setLists] = useState<DbShoppingList[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('guest');
  const [loading, setLoading] = useState(true);

  // Modal: Create Grouped Shopping List with multiple items in 1 batch
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listDate, setListDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [listLocation, setListLocation] = useState('');
  
  // Dynamic batch items inside creator
  const [batchItems, setBatchItems] = useState<Array<{ id: string; title: string; quantity: string }>>([
    { id: '1', title: '', quantity: '1' },
    { id: '2', title: '', quantity: '1' },
  ]);

  // Load lists from Supabase
  const loadData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('household_id')
          .eq('id', user.id)
          .single();

        const hId = profile?.household_id;
        if (hId) {
          setHouseholdId(hId);
          const dbLists = await fetchShoppingLists(hId);
          setLists(dbLists);
        }
      }
    } catch (err) {
      console.warn('Load shopping error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Add row to batch creator
  const handleAddBatchItemRow = () => {
    setBatchItems((prev) => [
      ...prev,
      { id: Date.now().toString(), title: '', quantity: '1' },
    ]);
  };

  // Remove row from batch creator
  const handleRemoveBatchItemRow = (id: string) => {
    if (batchItems.length <= 1) return;
    setBatchItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Update batch row
  const handleUpdateBatchRow = (id: string, field: 'title' | 'quantity', val: string) => {
    setBatchItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: val } : it))
    );
  };

  // Save new Batch Shopping List
  const handleCreateBatchList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listTitle.trim()) return;

    const validItems = batchItems.filter((it) => it.title.trim().length > 0);
    if (validItems.length === 0) return;

    try {
      let hId = householdId;
      let uId = userId;

      if (!hId || !uId) {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          uId = authData.user.id;
          setUserId(uId);
          const { data: profile } = await supabase
            .from('profiles')
            .select('household_id')
            .eq('id', uId)
            .single();

          if (profile?.household_id) {
            hId = profile.household_id;
            setHouseholdId(hId);
          }
        }
      }

      if (!hId || !uId) {
        alert(language === 'th' ? 'กรุณารอสักครู่ กำลังโหลดข้อมูลบ้าน...' : 'Household data is loading, please try again in a moment');
        return;
      }

      const created = await createBatchShoppingList(
        hId,
        uId,
        {
          title: listTitle.trim(),
          date: listDate,
          location: listLocation.trim() || undefined,
        },
        validItems.map((it) => ({
          title: it.title.trim(),
          quantity: it.quantity.trim() || '1',
          category: 'grocery',
        }))
      );

      setLists((prev) => [created, ...prev]);

      // Reset
      setListTitle('');
      setListLocation('');
      setListDate(new Date().toISOString().split('T')[0]);
      setBatchItems([
        { id: '1', title: '', quantity: '1' },
        { id: '2', title: '', quantity: '1' },
      ]);
      setIsBatchModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save shopping list');
    }
  };

  // Check / uncheck item
  const handleToggleItem = async (listId: string, itemId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;

    // Optimistic UI update
    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId && !l.items?.some((i) => i.id === itemId)) return l;
        return {
          ...l,
          items: l.items?.map((it) =>
            it.id === itemId ? { ...it, is_purchased: nextStatus } : it
          ),
        };
      })
    );

    try {
      await toggleShoppingItem(itemId, nextStatus);
    } catch (err) {
      console.error('Toggle error:', err);
      loadData(); // Revert on failure
    }
  };

  // Total items calculation
  const totalItemsCount = useMemo(() => {
    return lists.reduce((sum, l) => sum + (l.items?.length || 0), 0);
  }, [lists]);

  const totalPurchasedCount = useMemo(() => {
    return lists.reduce(
      (sum, l) => sum + (l.items?.filter((i) => i.is_purchased).length || 0),
      0
    );
  }, [lists]);

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1F1511] text-[#5D4037] dark:text-[#F5EBE6] select-none max-w-[402px] mx-auto pb-28 no-scrollbar transition-colors duration-200">
      {/* Top Utility Row */}
      <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-[30px] text-[#5D4037] dark:text-[#F5EBE6]">
            {t.shopping.title}
          </h1>
          <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#BCAAA4]">
            {language === 'th' ? 'สร้างรายการซื้อของตามวันและสถานที่' : 'Shopping trips & checklists'}
          </p>
        </div>
        <LanguageToggle />
      </div>

      {/* Stats Summary & Add Button Bar */}
      <div className="px-6 py-2 flex justify-between items-center">
        <span className="font-dm-sans text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4]">
          {totalPurchasedCount} / {totalItemsCount} {t.shopping.purchased}
        </span>
        <button
          type="button"
          onClick={() => setIsBatchModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#5D4037] dark:bg-[#4E342E] hover:bg-[#4A332C] text-white rounded-[14px] text-[12px] font-bold shadow-xs cursor-pointer active:scale-95 transition-all"
        >
          <Plus className="w-3.5 h-3.5 stroke-white" strokeWidth={2.5} />
          <span>{language === 'th' ? 'สร้างลิสต์ซื้อของ' : 'New Shopping List'}</span>
        </button>
      </div>

      {/* Main Lists Container without scrollbar */}
      <div className="flex-1 px-6 space-y-4 pt-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-[#5D4037] dark:border-[#D7CCC8] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[24px] text-center mt-2">
            <div className="w-12 h-12 rounded-full bg-[#E8DFD8] dark:bg-[#35231C] flex items-center justify-center text-[#5D4037] dark:text-[#F5EBE6] mb-3">
              <ShoppingCart className="w-6 h-6 stroke-current" />
            </div>
            <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#F5EBE6] mb-1">
              {t.shopping.emptyList}
            </h3>
            <p className="font-dm-sans text-[13px] text-[#8D6E63] dark:text-[#BCAAA4] max-w-[240px] mb-4">
              {language === 'th' 
                ? 'กดปุ่มด้านล่างเพื่อสร้างลิสต์ซื้อของ (ระบุหัวข้อ วันที่ สถานที่ และของที่ต้องซื้อ)' 
                : 'Tap below to create a shopping list with date, place & items'}
            </p>
            <button
              type="button"
              onClick={() => setIsBatchModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#5D4037] dark:bg-[#4E342E] text-white rounded-[16px] text-[13px] font-bold hover:bg-[#4A332C] transition-transform active:scale-95 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-white" strokeWidth={2.5} />
              {language === 'th' ? 'สร้างลิสต์ซื้อของใหม่' : 'Create Shopping List'}
            </button>
          </div>
        ) : (
          lists.map((list) => {
            const items = list.items || [];
            const purchasedInList = items.filter((i) => i.is_purchased).length;
            const isAllDone = items.length > 0 && purchasedInList === items.length;

            return (
              <div
                key={list.id}
                className={`p-4 rounded-[22px] border transition-all ${
                  isAllDone
                    ? 'bg-[#F4EFEA]/60 dark:bg-[#2D1E18]/60 border-[#D7CCC8]/60 dark:border-[#4E342E]/60 opacity-80'
                    : 'bg-white dark:bg-[#2D1E18] border-[#D7CCC8] dark:border-[#4E342E] shadow-[0px_4px_16px_rgba(93,64,55,0.03)]'
                }`}
              >
                {/* List Header: Title, Date, Location */}
                <div className="border-b border-[#D7CCC8]/40 dark:border-[#4E342E]/40 pb-2.5 mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#F5EBE6]">
                        {list.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#8D6E63] dark:text-[#BCAAA4]">
                        {list.date && (
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 stroke-current" />
                            {list.date}
                          </span>
                        )}
                        {list.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 stroke-current" />
                            {list.location}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#F4EFEA] dark:bg-[#1F1511] text-[#5D4037] dark:text-[#F5EBE6] border border-[#D7CCC8] dark:border-[#4E342E]">
                      {purchasedInList}/{items.length} {language === 'th' ? 'ซื้อแล้ว' : 'Done'}
                    </span>
                  </div>
                </div>

                {/* Items in this list */}
                <div className="space-y-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleItem(list.id, item.id, item.is_purchased)}
                      className="w-full flex items-center justify-between p-2.5 rounded-[14px] bg-[#FDFBF7] dark:bg-[#1F1511] hover:bg-[#F4EFEA] dark:hover:bg-[#261A15] border border-[#D7CCC8]/60 dark:border-[#4E342E]/60 transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                            item.is_purchased
                              ? 'bg-[#2E7D32] border-[#2E7D32] text-white'
                              : 'border-[#8D6E63] dark:border-[#BCAAA4]'
                          }`}
                        >
                          {item.is_purchased && <Check className="w-3.5 h-3.5 stroke-white" strokeWidth={3} />}
                        </div>

                        <span
                          className={`font-dm-sans text-[13px] truncate ${
                            item.is_purchased
                              ? 'line-through text-[#8D6E63] dark:text-[#BCAAA4]/60'
                              : 'font-medium text-[#5D4037] dark:text-[#F5EBE6]'
                          }`}
                        >
                          {item.title}
                        </span>
                      </div>

                      {item.quantity && (
                        <span className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#BCAAA4] shrink-0 ml-2 px-2 py-0.5 bg-[#F4EFEA] dark:bg-[#2D1E18] rounded-md border border-[#D7CCC8]/40 dark:border-[#4E342E]/40">
                          {item.quantity}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Add Button */}
      <div className="fixed bottom-24 left-0 right-0 max-w-[402px] mx-auto px-6 pointer-events-none flex justify-end z-30">
        <button
          type="button"
          onClick={() => setIsBatchModalOpen(true)}
          className="pointer-events-auto w-12 h-12 rounded-full bg-[#5D4037] dark:bg-[#4E342E] text-white flex items-center justify-center shadow-lg hover:bg-[#4A332C] transition-transform active:scale-95 cursor-pointer"
          title={language === 'th' ? 'สร้างลิสต์ซื้อของ' : 'New shopping list'}
        >
          <Plus className="w-6 h-6 stroke-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Batch Create Shopping List Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFBF7] dark:bg-[#1F1511] text-[#5D4037] dark:text-[#F5EBE6] border border-[#D7CCC8] dark:border-[#4E342E] w-full max-w-[370px] max-h-[85vh] rounded-[24px] p-5 shadow-2xl flex flex-col no-scrollbar">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-[#5D4037] dark:text-[#F5EBE6]" />
                <h3 className="font-outfit font-bold text-[18px]">
                  {language === 'th' ? 'สร้างลิสต์ซื้อของ' : 'New Shopping List'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1 text-[#8D6E63] hover:text-[#5D4037] dark:text-[#BCAAA4] dark:hover:text-[#F5EBE6]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateBatchList} className="flex-1 flex flex-col overflow-y-auto no-scrollbar space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                  {language === 'th' ? 'หัวข้อลิสต์ซื้อของ' : 'List Title'}
                </label>
                <input
                  type="text"
                  required
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  placeholder={language === 'th' ? 'เช่น ของสดทำอาหารเย็น, ของใช้ Lotus' : 'e.g. Weekly Groceries'}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                    {language === 'th' ? 'วันที่' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={listDate}
                    onChange={(e) => setListDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#F5EBE6] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                    {language === 'th' ? 'สถานที่ / ร้านค้า' : 'Store / Location'}
                  </label>
                  <input
                    type="text"
                    value={listLocation}
                    onChange={(e) => setListLocation(e.target.value)}
                    placeholder={language === 'th' ? 'เช่น Lotus, ตลาด' : 'e.g. Supermarket'}
                    className="w-full px-3 py-2 bg-white dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#F5EBE6] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="pt-2 border-t border-[#D7CCC8]/50 dark:border-[#4E342E]/50">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#F5EBE6]">
                    {language === 'th' ? 'รายการของที่ต้องซื้อ (ใส่ได้หลายอย่าง)' : 'Items to Buy (Multiple Items)'}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddBatchItemRow}
                    className="text-[12px] font-bold text-[#2E7D32] dark:text-[#81C784] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? 'เพิ่มของอีกอย่าง' : 'Add row'}</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar pr-0.5">
                  {batchItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-[#8D6E63] dark:text-[#BCAAA4] w-4 text-center">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateBatchRow(item.id, 'title', e.target.value)}
                        placeholder={language === 'th' ? 'ชื่อของ เช่น นมสด, ขนมปัง' : 'Item name'}
                        className="flex-1 px-3 py-2 bg-white dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[12px] text-[13px] text-[#5D4037] dark:text-[#F5EBE6] focus:outline-none focus:border-[#5D4037]"
                      />
                      <input
                        type="text"
                        value={item.quantity}
                        onChange={(e) => handleUpdateBatchRow(item.id, 'quantity', e.target.value)}
                        placeholder={language === 'th' ? 'จำนวน' : 'Qty'}
                        className="w-16 px-2.5 py-2 bg-white dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[12px] text-[13px] text-[#5D4037] dark:text-[#F5EBE6] text-center focus:outline-none focus:border-[#5D4037]"
                      />
                      {batchItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBatchItemRow(item.id)}
                          className="p-1.5 text-[#8D6E63] hover:text-red-600 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#5D4037] dark:bg-[#4E342E] hover:bg-[#4A332C] text-white rounded-[16px] text-[14px] font-bold shadow-xs cursor-pointer active:scale-98 transition-all"
                >
                  {language === 'th' ? 'บันทึกรายการซื้อของ' : 'Save Shopping List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
