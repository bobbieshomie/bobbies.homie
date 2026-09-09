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
  ListPlus,
  Pencil
} from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-context';
import { createClient } from '@/lib/supabase/client';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  fetchShoppingLists, 
  createBatchShoppingList, 
  toggleShoppingItem,
  deleteShoppingItem,
  updateShoppingItem,
  deleteShoppingList,
  updateShoppingList,
  type DbShoppingList,
  type DbShoppingItem
} from '@/lib/services/db';

export default function ShoppingPage() {
  const { t, language } = useLanguage();

  const [lists, setLists] = useState<DbShoppingList[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('guest');
  const [loading, setLoading] = useState(true);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title?: string;
    description?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    onConfirm: () => {},
  });

  // Modal: Create Grouped Shopping List with multiple items in 1 batch
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [listTitle, setListTitle] = useState('');
  const [listDate, setListDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [listLocation, setListLocation] = useState('');
  
  // Dynamic batch items inside creator - starts empty
  const [batchItems, setBatchItems] = useState<Array<{ id: string; title: string; quantity: string }>>([]);

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

      // Dispatch push notification to housemates
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: hId,
          excludeUserId: uId,
          title: '🛒 Bobbies Homie',
          body: language === 'th'
            ? `มีลิสต์ซื้อของใหม่: "${listTitle.trim()}" (${validItems.length} รายการ)`
            : `New shopping list: "${listTitle.trim()}" (${validItems.length} items)`,
          link: '/shopping',
        }),
      }).catch(() => {});

      // Reset
      setListTitle('');
      setListLocation('');
      setListDate(new Date().toISOString().split('T')[0]);
      setBatchItems([]);
      setIsBatchModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save shopping list';
      alert(msg);
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

  // Delete item from list with confirmation
  const handleRequestDeleteItem = (listId: string, itemId: string, itemTitle?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'th' ? 'ยืนยันการลบรายการ' : 'Delete Item?',
      description: language === 'th'
        ? `ต้องการลบ "${itemTitle || 'รายการนี้'}" ใช่หรือไม่?`
        : `Are you sure you want to delete "${itemTitle || 'this item'}"?`,
      onConfirm: async () => {
        setLists((prev) =>
          prev.map((l) => {
            if (l.id !== listId) return l;
            return {
              ...l,
              items: l.items?.filter((it) => it.id !== itemId),
            };
          })
        );
        try {
          await deleteShoppingItem(itemId);
        } catch (err) {
          console.error('Delete item error:', err);
          loadData();
        }
      },
    });
  };

  // Delete entire shopping list with confirmation
  const handleRequestDeleteList = (listId: string, listTitle?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'th' ? 'ยืนยันการลบลิสต์' : 'Delete Shopping List?',
      description: language === 'th'
        ? `ต้องการลบลิสต์ "${listTitle || ''}" และรายการทั้งหมดในลิสต์ใช่หรือไม่?`
        : `Are you sure you want to delete "${listTitle || 'this list'}" and all its items?`,
      onConfirm: async () => {
        setLists((prev) => prev.filter((l) => l.id !== listId));
        try {
          await deleteShoppingList(listId);
        } catch (err) {
          console.error('Delete list error:', err);
          loadData();
        }
      },
    });
  };

  // Edit list modal state & handlers
  const [editingList, setEditingList] = useState<DbShoppingList | null>(null);
  const [editListTitle, setEditListTitle] = useState('');
  const [editListDate, setEditListDate] = useState('');
  const [editListLocation, setEditListLocation] = useState('');

  const handleOpenEditList = (list: DbShoppingList) => {
    setEditingList(list);
    setEditListTitle(list.title || '');
    setEditListDate(list.date || '');
    setEditListLocation(list.location || '');
  };

  const handleSaveEditList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList || !editListTitle.trim()) return;
    const listId = editingList.id;
    const nextTitle = editListTitle.trim();
    const nextDate = editListDate.trim() || null;
    const nextLocation = editListLocation.trim() || null;

    setLists((prev) =>
      prev.map((l) =>
        l.id === listId
          ? { ...l, title: nextTitle, date: nextDate, location: nextLocation }
          : l
      )
    );
    setEditingList(null);

    try {
      await updateShoppingList(listId, {
        title: nextTitle,
        date: nextDate || undefined,
        location: nextLocation || undefined,
      });
    } catch (err) {
      console.error('Update list error:', err);
      loadData();
    }
  };

  // Edit item modal state
  const [editingItem, setEditingItem] = useState<{ listId: string; item: DbShoppingItem } | null>(null);
  const [editItemTitle, setEditItemTitle] = useState('');
  const [editItemQty, setEditItemQty] = useState('');

  const handleOpenEditItem = (listId: string, item: DbShoppingItem) => {
    setEditingItem({ listId, item });
    setEditItemTitle(item.title);
    setEditItemQty(item.quantity || '1');
  };

  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !editItemTitle.trim()) return;
    const { listId, item } = editingItem;
    const nextTitle = editItemTitle.trim();
    const nextQty = editItemQty.trim() || '1';

    setLists((prev) =>
      prev.map((l) => {
        if (l.id !== listId) return l;
        return {
          ...l,
          items: l.items?.map((it) =>
            it.id === item.id ? { ...it, title: nextTitle, quantity: nextQty } : it
          ),
        };
      })
    );
    setEditingItem(null);

    try {
      await updateShoppingItem(item.id, { title: nextTitle, quantity: nextQty });
    } catch (err) {
      console.error('Update item error:', err);
      loadData();
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
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1A1816] text-[#5D4037] dark:text-[#DDD7D2] select-none w-full max-w-md sm:max-w-[448px] mx-auto pb-40 no-scrollbar transition-colors duration-200">
      {/* Top Utility Row */}
      <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-tight text-[#5D4037] dark:text-[#DDD7D2]">
            {t.shopping.title}
          </h1>
          <p className="font-dm-sans text-[12px] leading-normal text-[#8D6E63] dark:text-[#948D87] mt-1.5">
            {language === 'th' ? 'สร้างรายการซื้อของตามวันและสถานที่' : 'Shopping trips & checklists'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsBatchModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#5D4037] dark:bg-[#6E544A] text-white text-xs font-semibold shadow-xs hover:bg-[#4A332C] hover:dark:bg-[#8D6E63] active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-white" strokeWidth={2.5} />
          <span>{language === 'th' ? 'เพิ่มลิสต์' : 'New List'}</span>
        </button>
      </div>

      {/* Stats Summary Row */}
      <div className="px-6 py-2 flex justify-between items-center">
        <span className="font-dm-sans text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87]">
          {totalPurchasedCount} / {totalItemsCount} {t.shopping.purchased}
        </span>
      </div>

      {/* Main Lists Container without scrollbar */}
      <div className="flex-1 px-6 space-y-4 pt-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="w-6 h-6 border-2 border-[#5D4037] dark:border-[#D7CCC8] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[24px] text-center mt-2">
            <div className="w-12 h-12 rounded-full bg-[#E8DFD8] dark:bg-[#2E2A27] flex items-center justify-center text-[#5D4037] dark:text-[#DDD7D2] mb-3">
              <ShoppingCart className="w-6 h-6 stroke-current" />
            </div>
            <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2] mb-1">
              {t.shopping.emptyList}
            </h3>
            <p className="font-dm-sans text-[13px] text-[#8D6E63] dark:text-[#948D87] max-w-[240px]">
              {language === 'th' 
                ? 'กดปุ่ม + ด้านล่างเพื่อสร้างลิสต์ซื้อของ' 
                : 'Tap the + button below to create a shopping list'}
            </p>
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
                    ? 'bg-[#F4EFEA]/60 dark:bg-[#1F1D1B]/60 border-[#D7CCC8]/60 dark:border-[#2E2A27]/60 opacity-80'
                    : 'bg-white dark:bg-[#1F1D1B] border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.03)]'
                }`}
              >
                {/* List Header with Direct Edit Button */}
                <div className="p-3 bg-[#F4EFEA]/60 dark:bg-[#141312]/60 rounded-[16px] border border-[#D7CCC8]/40 dark:border-[#2E2A27]/40 mb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2] truncate">
                        {list.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                        {list.date && (
                          <span className="flex items-center gap-1 shrink-0">
                            <CalendarIcon className="w-3 h-3 stroke-current" />
                            {list.date}
                          </span>
                        )}
                        {list.location && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 stroke-current shrink-0" />
                            <span className="truncate">{list.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#FDFBF7] dark:bg-[#1F1D1B] text-[#5D4037] dark:text-[#DDD7D2] border border-[#D7CCC8] dark:border-[#2E2A27] whitespace-nowrap">
                        {purchasedInList}/{items.length} {language === 'th' ? 'ซื้อแล้ว' : 'Done'}
                      </span>
                      {list.id !== 'quick-list' && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditList(list)}
                          title={language === 'th' ? 'แก้ไขลิสต์' : 'Edit list'}
                          className="p-1.5 rounded-[10px] bg-white dark:bg-[#1F1D1B] border border-[#D7CCC8]/80 dark:border-[#2E2A27] text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-[#DDD7D2] transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 stroke-current" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items in this list with Swipe-to-Edit & Delete */}
                <div className="space-y-2">
                  {items.map((item) => (
                    <SwipeableRow
                      key={item.id}
                      onEdit={() => handleOpenEditItem(list.id, item)}
                      onDelete={() => handleRequestDeleteItem(list.id, item.id, item.title)}
                      editLabel={language === 'th' ? 'แก้ไข' : 'Edit'}
                      deleteLabel={language === 'th' ? 'ลบ' : 'Delete'}
                      className="rounded-[14px]"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleItem(list.id, item.id, item.is_purchased)}
                        className="w-full flex items-center justify-between p-2.5 rounded-[14px] bg-[#FDFBF7] dark:bg-[#141312] hover:bg-[#F4EFEA] dark:hover:bg-[#2E2A27]/50 border border-[#D7CCC8]/60 dark:border-[#2E2A27]/60 transition-all text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                              item.is_purchased
                                ? 'bg-[#2E7D32] border-[#2E7D32] text-white'
                                : 'border-[#8D6E63] dark:border-[#D7CCC8]'
                            }`}
                          >
                            {item.is_purchased && <Check className="w-3.5 h-3.5 stroke-white" strokeWidth={3} />}
                          </div>

                          <span
                            className={`font-dm-sans text-[13px] truncate ${
                              item.is_purchased
                                ? 'line-through text-[#8D6E63] dark:text-[#948D87]/60'
                                : 'font-medium text-[#5D4037] dark:text-[#DDD7D2]'
                            }`}
                          >
                            {item.title}
                          </span>
                        </div>

                        {item.quantity && (
                          <span className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87] shrink-0 ml-2 px-2 py-0.5 bg-[#F4EFEA] dark:bg-[#1F1D1B] rounded-md border border-[#D7CCC8]/40 dark:border-[#2E2A27]/40">
                            {item.quantity}
                          </span>
                        )}
                      </button>
                    </SwipeableRow>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Add Button - lifted safely above BottomNav */}
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+100px)] left-0 right-0 max-w-md sm:max-w-[448px] mx-auto px-6 pointer-events-none flex justify-end z-40">
        <button
          type="button"
          onClick={() => setIsBatchModalOpen(true)}
          className="pointer-events-auto w-13 h-13 rounded-full bg-[#5D4037] dark:bg-[#6E544A] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(93,64,55,0.25)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:bg-[#4A332C] hover:dark:bg-[#8D6E63] transition-transform active:scale-90 cursor-pointer ring-2 ring-white dark:ring-[#1F1D1B]"
          title={language === 'th' ? 'สร้างลิสต์ซื้อของ' : 'New shopping list'}
        >
          <Plus className="w-6 h-6 stroke-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Batch Create Shopping List Modal */}
      {isBatchModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsBatchModalOpen(false)}
        >
          <div 
            className="bg-[#FDFBF7] dark:bg-[#1F1D1B] text-[#5D4037] dark:text-[#DDD7D2] border border-[#D7CCC8] dark:border-[#2E2A27] w-full max-w-[390px] max-h-[85vh] rounded-[24px] p-5 shadow-2xl flex flex-col no-scrollbar animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-[#5D4037] dark:text-[#DDD7D2]" />
                <h3 className="font-outfit font-bold text-[18px]">
                  {language === 'th' ? 'สร้างลิสต์ซื้อของ' : 'New Shopping List'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateBatchList} className="flex-1 flex flex-col overflow-y-auto no-scrollbar space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'หัวข้อลิสต์ซื้อของ' : 'List Title'}
                </label>
                <input
                  type="text"
                  required
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  placeholder={language === 'th' ? 'หัวข้อลิสต์ซื้อของ' : 'List Title'}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2.5">
                <div className="min-w-0">
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                    {language === 'th' ? 'วันที่' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={listDate}
                    onChange={(e) => setListDate(e.target.value)}
                    className="w-full max-w-full box-border px-3 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037] block appearance-none"
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                    {language === 'th' ? 'สถานที่ / ร้านค้า' : 'Store / Location'}
                  </label>
                  <input
                    type="text"
                    value={listLocation}
                    onChange={(e) => setListLocation(e.target.value)}
                    placeholder={language === 'th' ? 'สถานที่ / ร้านค้า' : 'Store / Location'}
                    className="w-full max-w-full box-border px-3 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037] block"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="pt-2 border-t border-[#D7CCC8]/50 dark:border-[#2E2A27]/50">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2]">
                    {language === 'th' ? 'รายการของที่ต้องซื้อ' : 'Items to Buy'}
                    {batchItems.length > 0 && (
                      <span className="ml-1.5 font-normal text-[#8D6E63] dark:text-[#948D87]">({batchItems.length})</span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={handleAddBatchItemRow}
                    className="text-[12px] font-bold text-[#2E7D32] dark:text-[#81C784] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{language === 'th' ? 'เพิ่มของ' : 'Add item'}</span>
                  </button>
                </div>

                {batchItems.length === 0 ? (
                  <p className="text-center text-[12px] text-[#8D6E63] dark:text-[#948D87] py-3">
                    {language === 'th' ? 'กด "+เพิ่มของ" เพื่อใส่รายการ' : 'Tap "+ Add item" to add items'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto no-scrollbar pr-0.5">
                    {batchItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-[#8D6E63] dark:text-[#948D87] w-4 text-center shrink-0">
                          {idx + 1}.
                        </span>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleUpdateBatchRow(item.id, 'title', e.target.value)}
                          placeholder={language === 'th' ? 'ชื่อของ' : 'Item name'}
                          className="flex-1 px-3 py-2 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[12px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/50 focus:outline-none focus:border-[#5D4037]"
                        />
                        <input
                          type="text"
                          value={item.quantity}
                          onChange={(e) => handleUpdateBatchRow(item.id, 'quantity', e.target.value)}
                          placeholder={language === 'th' ? 'จำนวน' : 'Qty'}
                          className="w-14 px-2.5 py-2 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[12px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] text-center placeholder-[#8D6E63]/50 focus:outline-none focus:border-[#5D4037]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveBatchItemRow(item.id)}
                          className="p-1.5 text-[#8D6E63] dark:text-[#948D87] hover:text-red-500 rounded-lg shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[16px] text-[14px] font-bold shadow-xs cursor-pointer active:scale-98 transition-all"
                >
                  {language === 'th' ? 'บันทึกรายการซื้อของ' : 'Save Shopping List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Single Item Modal */}
      {editingItem && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setEditingItem(null)}
        >
          <div 
            className="bg-[#FDFBF7] dark:bg-[#1F1D1B] text-[#5D4037] dark:text-[#DDD7D2] border border-[#D7CCC8] dark:border-[#2E2A27] w-full max-w-[390px] rounded-[24px] p-5 shadow-2xl flex flex-col animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-outfit font-bold text-[18px]">
                {language === 'th' ? 'แก้ไขรายการของ' : 'Edit Shopping Item'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditItem} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'ชื่อของ' : 'Item Name'}
                </label>
                <input
                  type="text"
                  required
                  value={editItemTitle}
                  onChange={(e) => setEditItemTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'จำนวน' : 'Quantity'}
                </label>
                <input
                  type="text"
                  value={editItemQty}
                  onChange={(e) => setEditItemQty(e.target.value)}
                  placeholder="1"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] text-white rounded-[14px] text-[13px] font-semibold cursor-pointer transition-colors"
                >
                  {language === 'th' ? 'บันทึก' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit List Modal */}
      {editingList && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setEditingList(null)}
        >
          <div 
            className="bg-[#FDFBF7] dark:bg-[#1F1D1B] text-[#5D4037] dark:text-[#DDD7D2] border border-[#D7CCC8] dark:border-[#2E2A27] w-full max-w-[390px] rounded-[24px] p-5 shadow-2xl flex flex-col animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-outfit font-bold text-[18px]">
                {language === 'th' ? 'แก้ไขลิสต์ซื้อของ' : 'Edit Shopping List'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingList(null)}
                className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditList} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'หัวข้อลิสต์' : 'List Title'}
                </label>
                <input
                  type="text"
                  required
                  value={editListTitle}
                  onChange={(e) => setEditListTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'วันที่' : 'Date'}
                </label>
                <input
                  type="date"
                  value={editListDate}
                  onChange={(e) => setEditListDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'สถานที่ / ร้านค้า' : 'Store / Location'}
                </label>
                <input
                  type="text"
                  value={editListLocation}
                  onChange={(e) => setEditListLocation(e.target.value)}
                  placeholder={language === 'th' ? 'สถานที่ / ร้านค้า' : 'Store / Location'}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingList(null)}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer hover:bg-[#E8DFD8] transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] text-white rounded-[14px] text-[13px] font-semibold cursor-pointer transition-colors"
                >
                  {language === 'th' ? 'บันทึก' : 'Save'}
                </button>
              </div>

              {/* Delete entire big box button inside the edit modal */}
              <div className="pt-3 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27]/60">
                <button
                  type="button"
                  onClick={() => {
                    const listToDelete = editingList;
                    setEditingList(null);
                    handleRequestDeleteList(listToDelete.id, listToDelete.title);
                  }}
                  className="w-full py-2.5 rounded-[14px] border border-red-200 dark:border-red-950/60 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50 text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 stroke-current" />
                  <span>{language === 'th' ? 'ลบทั้งกล่องรายการนี้' : 'Delete Entire List'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deletions */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
      />
    </div>
  );
}
