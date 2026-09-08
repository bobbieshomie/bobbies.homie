'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  X, 
  Wallet, 
  CheckCircle2, 
  Trash2,
  Receipt,
  Loader2,
  User
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { 
  fetchFinances, 
  createFinance, 
  fetchHouseholdMembers,
  type DbFinance, 
  type DbProfile 
} from '@/lib/services/db';
import { useLanguage } from '@/lib/i18n/language-context';

export default function FinancesPage() {
  const { t, language } = useLanguage();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<DbProfile | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<DbProfile[]>([]);
  const [expenses, setExpenses] = useState<DbFinance[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('groceries');
  const [newPaidBy, setNewPaidBy] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profile) {
        setCurrentUser(profile as DbProfile);
        setNewPaidBy(profile.id);

        if (profile.household_id) {
          const members = await fetchHouseholdMembers(profile.household_id);
          setHouseholdMembers(members);

          const dbFinances = await fetchFinances(profile.household_id);
          setExpenses(dbFinances);
        }
      }
    } catch (err) {
      console.error('Failed to load finances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const myName = currentUser?.nickname || currentUser?.full_name || 'Me';

  // Calculate net balance
  const balanceSummary = useMemo(() => {
    let myPaidPending = 0;
    let otherPaidPending = 0;

    expenses.forEach((item) => {
      if (!item.is_reimbursed) {
        const half = Number(item.amount) / 2;
        const isMe = item.paid_by === currentUser?.id || item.paid_by === myName;
        if (isMe) {
          myPaidPending += half;
        } else {
          otherPaidPending += half;
        }
      }
    });

    const diff = otherPaidPending - myPaidPending;
    const otherMemberName = householdMembers.find((m) => m.id !== currentUser?.id)?.nickname || 'Member';

    return {
      amount: Math.abs(diff),
      isSettled: diff === 0,
      debtor: diff > 0 ? myName : otherMemberName,
      creditor: diff > 0 ? otherMemberName : myName,
    };
  }, [expenses, myName, householdMembers, currentUser]);

  const getPayerName = (paidById: string) => {
    if (paidById === currentUser?.id || paidById === myName) return myName;
    const found = householdMembers.find((m) => m.id === paidById);
    return found ? (found.nickname || found.full_name || found.username || 'Member') : 'Member';
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(newAmount);
    if (!newTitle.trim() || isNaN(amountVal) || amountVal <= 0) return;

    let userObj = currentUser;
    if (!userObj?.household_id) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .single();
        if (prof) {
          userObj = prof as DbProfile;
          setCurrentUser(userObj);
        }
      }
    }

    if (!userObj?.household_id) {
      alert(language === 'th' ? 'กำลังโหลดข้อมูลบ้าน กรุณาลองใหม่อีกครั้ง' : 'Loading household, please try again');
      return;
    }

    try {
      setSubmitting(true);
      const payerId = (newPaidBy && newPaidBy.length >= 20) ? newPaidBy : userObj.id;
      const created = await createFinance(userObj.household_id, {
        title: newTitle.trim(),
        category: newCategory,
        amount: amountVal,
        paid_by: payerId,
        date: new Date().toISOString().split('T')[0],
      });

      setExpenses((prev) => [created, ...prev]);
      setNewTitle('');
      setNewAmount('');
      setIsAddModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกค่าใช้จ่ายไม่สำเร็จ';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentReimbursed: boolean) => {
    try {
      const { error } = await supabase
        .from('shared_finances')
        .update({ is_reimbursed: !currentReimbursed })
        .eq('id', id);

      if (!error) {
        setExpenses((prev) =>
          prev.map((e) => (e.id === id ? { ...e, is_reimbursed: !currentReimbursed } : e))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('shared_finances').delete().eq('id', id);
      if (!error) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettleAll = async () => {
    if (!confirm(language === 'th' ? 'ต้องการเคลียร์ยอดค่าใช้จ่ายทั้งหมดใช่หรือไม่?' : 'Settle all pending expenses?')) return;
    try {
      if (!currentUser?.household_id) return;
      await supabase
        .from('shared_finances')
        .update({ is_reimbursed: true })
        .eq('household_id', currentUser.household_id);

      setExpenses((prev) => prev.map((e) => ({ ...e, is_reimbursed: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'groceries': return t.finances.groceriesCat;
      case 'utilities': return t.finances.utilitiesCat;
      case 'rent': return t.finances.rentCat;
      case 'dining': return t.finances.diningCat;
      case 'pets': return t.finances.petsCat;
      case 'entertainment': return t.finances.entertainmentCat;
      case 'travel': return t.finances.travelCat;
      default: return t.finances.otherCat;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#141312] select-none max-w-[420px] mx-auto pb-28 transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-[30px] text-[#5D4037] dark:text-[#DDD7D2]">
            {t.finances.title}
          </h1>
          <p className="font-dm-sans text-[13px] leading-[18px] text-[#8D6E63] dark:text-[#948D87] mt-0.5">
            {t.finances.subtitle}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#8D6E63]" />
        </div>
      ) : (
        <>
          {/* Balance Summary Card */}
          <div className="px-6 pb-5 pt-2">
            <div className="box-border flex flex-col items-start p-5 gap-3 w-full bg-[#FFFFFF] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_4px_16px_rgba(93,64,55,0.04)] rounded-[24px]">
              <div className="flex justify-between items-center w-full">
                <span className="font-outfit font-semibold text-[13px] text-[#8D6E63] dark:text-[#948D87] tracking-wide">
                  {t.finances.currentBalance}
                </span>
                <div className="w-9 h-9 rounded-full bg-[#BBDEFB] dark:bg-[#1565C0]/30 flex items-center justify-center text-[#1565C0] dark:text-[#90CAF9]">
                  <Wallet className="w-4 h-4 stroke-current" />
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-outfit font-bold text-[32px] leading-[40px] text-[#5D4037] dark:text-[#DDD7D2]">
                  ฿{balanceSummary.amount.toFixed(2)}
                </span>
                {!balanceSummary.isSettled ? (
                  <span className="font-dm-sans text-[12px] font-medium text-[#E65100] dark:text-[#FFCC80] bg-[#FFE0B2] dark:bg-[#2E2A27] px-2.5 py-0.5 rounded-full border border-[#FFCC80]/40">
                    {balanceSummary.debtor} → {balanceSummary.creditor}
                  </span>
                ) : (
                  <span className="font-dm-sans text-[12px] font-medium text-[#2E7D32] dark:text-[#A5D6A7] bg-[#C8E6C9] dark:bg-[#1B5E20]/40 px-2.5 py-0.5 rounded-full border border-[#81C784]/40">
                    {t.dashboard.allSettled}
                  </span>
                )}
              </div>

              {!balanceSummary.isSettled && (
                <button
                  type="button"
                  onClick={handleSettleAll}
                  className="w-full mt-1 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[12px] font-semibold text-[#5D4037] dark:text-[#DDD7D2] hover:opacity-90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[#2E7D32]" />
                  {t.finances.settleAll}
                </button>
              )}
            </div>
          </div>

          {/* Expenses List */}
          <div className="flex-1 px-6 space-y-2.5">
            <div className="flex justify-between items-center px-1 pb-1">
              <h2 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2]">
                {t.common.all} ({expenses.length})
              </h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="text-[12px] font-semibold text-[#2E7D32] dark:text-[#81C784] hover:underline cursor-pointer"
              >
                + {t.finances.addExpense}
              </button>
            </div>

            {expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[24px] text-center mt-2">
                <div className="w-12 h-12 rounded-full bg-[#E8DFD8] dark:bg-[#2E2A27] flex items-center justify-center text-[#5D4037] dark:text-[#DDD7D2] mb-3">
                  <Receipt className="w-6 h-6 stroke-current" />
                </div>
                <h3 className="font-outfit font-bold text-[16px] text-[#5D4037] dark:text-[#DDD7D2] mb-1">
                  {t.finances.emptyExpenses}
                </h3>
                <p className="font-dm-sans text-[13px] text-[#8D6E63] dark:text-[#948D87] max-w-[240px] mb-4">
                  {t.finances.emptyExpensesPrompt}
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[16px] text-[13px] font-semibold hover:opacity-95 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-white" strokeWidth={2.5} />
                  {t.finances.addExpense}
                </button>
              </div>
            ) : (
              expenses.map((expense) => {
                const isResolved = expense.is_reimbursed;

                return (
                  <div
                    key={expense.id}
                    className={`flex items-center justify-between p-3.5 rounded-[18px] border transition-all ${
                      isResolved
                        ? 'bg-[#F4EFEA]/60 dark:bg-[#1F1D1B]/60 border-[#D7CCC8]/60 dark:border-[#2E2A27]/60 opacity-60'
                        : 'bg-white dark:bg-[#1F1D1B] border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_2px_8px_rgba(93,64,55,0.03)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(expense.id, expense.is_reimbursed)}
                        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors shrink-0 cursor-pointer ${
                          isResolved
                            ? 'bg-[#2E7D32] border-[#2E7D32] text-white'
                            : 'border-[#8D6E63] dark:border-[#D7CCC8] hover:border-[#5D4037]'
                        }`}
                      >
                        {isResolved && <CheckCircle2 className="w-4 h-4 stroke-white" />}
                      </button>

                      <div className="flex flex-col min-w-0">
                        <span
                          className={`font-dm-sans text-[14px] leading-[19px] truncate ${
                            isResolved ? 'line-through text-[#8D6E63] dark:text-[#948D87]/60' : 'font-medium text-[#5D4037] dark:text-[#DDD7D2]'
                          }`}
                        >
                          {expense.title}
                        </span>
                        <span className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                          {getCategoryLabel(expense.category)} • {getPayerName(expense.paid_by)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className="font-outfit font-bold text-[15px] text-[#5D4037] dark:text-[#DDD7D2]">
                          ฿{Number(expense.amount).toFixed(2)}
                        </div>
                        <div className="text-[10px] text-[#8D6E63] dark:text-[#948D87]">
                          {isResolved ? t.finances.resolved : t.finances.pendingPay}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(expense.id)}
                        title={t.common.delete}
                        className="p-1.5 text-[#8D6E63] hover:text-red-500 rounded-lg transition-colors ml-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 stroke-current" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Add Expense Modal Dialog */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFBF7] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] w-full max-w-[360px] rounded-[24px] p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#DDD7D2]">
                {t.finances.addExpense}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.addExpense}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t.finances.expenseTitlePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.amount} (THB)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.category}
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                >
                  <option value="groceries">{t.finances.groceriesCat}</option>
                  <option value="utilities">{t.finances.utilitiesCat}</option>
                  <option value="rent">{t.finances.rentCat}</option>
                  <option value="dining">{t.finances.diningCat}</option>
                  <option value="pets">{t.finances.petsCat}</option>
                  <option value="entertainment">{t.finances.entertainmentCat}</option>
                  <option value="travel">{t.finances.travelCat}</option>
                  <option value="other">{t.finances.otherCat}</option>
                </select>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.paidBy}
                </label>
                <select
                  value={newPaidBy}
                  onChange={(e) => setNewPaidBy(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                >
                  {currentUser && (
                    <option value={currentUser.id}>
                      {myName} ({language === 'th' ? 'ฉัน' : 'Me'})
                    </option>
                  )}
                  {householdMembers
                    .filter((m) => m.id !== currentUser?.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nickname || m.full_name || m.username || 'Member'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[14px] text-[13px] font-semibold hover:opacity-95 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : t.common.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
