'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, 
  X, 
  Wallet, 
  CheckCircle2, 
  Trash2,
  Receipt,
  Loader2,
  ChevronDown,
  Pencil,
  Upload,
  Image as ImageIcon,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { 
  fetchFinances, 
  createFinance, 
  updateFinance,
  deleteOldSlips,
  fetchHouseholdMembers,
  type DbFinance, 
  type DbProfile 
} from '@/lib/services/db';
import { uploadTransferSlip } from '@/lib/services/storage';
import { useLanguage } from '@/lib/i18n/language-context';
import { SwipeableRow } from '@/components/ui/swipeable-row';

export default function FinancesPage() {
  const { t, language } = useLanguage();
  const supabase = createClient();
  const slipInputRef = useRef<HTMLInputElement>(null);
  const editSlipInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<DbProfile | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<DbProfile[]>([]);
  const [expenses, setExpenses] = useState<DbFinance[]>([]);

  // Add modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('groceries');
  const [newPaidBy, setNewPaidBy] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Edit modal state
  const [editingExpense, setEditingExpense] = useState<DbFinance | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('groceries');
  const [editPaidBy, setEditPaidBy] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Slip upload state
  const [uploadingSlipId, setUploadingSlipId] = useState<string | null>(null);

  // Transfer specification state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

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
        setTransferFrom(profile.id);

        if (profile.household_id) {
          const members = await fetchHouseholdMembers(profile.household_id);
          setHouseholdMembers(members);

          // Auto set transferTo to the other member
          const other = members.find((m) => m.id !== profile.id);
          if (other) setTransferTo(other.id);

          const dbFinances = await fetchFinances(profile.household_id);
          setExpenses(dbFinances);

          // Clean up old slips (>7 days)
          try {
            await deleteOldSlips(profile.household_id);
          } catch {
            // non-critical
          }
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

  const getMemberName = (id: string) => {
    if (id === currentUser?.id) return myName;
    const found = householdMembers.find((m) => m.id === id);
    return found ? (found.nickname || found.full_name || found.username || 'Member') : 'Member';
  };

  // Calculate net balance based on actual amounts paid
  const balanceSummary = useMemo(() => {
    const memberTotals: Record<string, number> = {};
    householdMembers.forEach((m) => { memberTotals[m.id] = 0; });

    expenses.forEach((item) => {
      if (!item.is_reimbursed) {
        const paidById = item.paid_by;
        if (!memberTotals[paidById]) memberTotals[paidById] = 0;
        memberTotals[paidById] += Number(item.amount);
      }
    });

    const memberIds = Object.keys(memberTotals);
    if (memberIds.length < 2) {
      const total = Object.values(memberTotals).reduce((a, b) => a + b, 0);
      return { amount: 0, isSettled: total === 0, debtor: myName, creditor: myName, transfers: [] };
    }

    // Build who owes whom
    const transfers: { from: string; to: string; amount: number }[] = [];
    const balances = { ...memberTotals };
    const totalPaid = Object.values(balances).reduce((a, b) => a + b, 0);
    const perPerson = totalPaid / memberIds.length;

    const creditors: { id: string; amount: number }[] = [];
    const debtors: { id: string; amount: number }[] = [];

    memberIds.forEach((id) => {
      const diff = balances[id] - perPerson;
      if (diff > 0.01) creditors.push({ id, amount: diff });
      else if (diff < -0.01) debtors.push({ id, amount: -diff });
    });

    creditors.forEach((creditor) => {
      let remaining = creditor.amount;
      debtors.forEach((debtor) => {
        if (debtor.amount > 0.01 && remaining > 0.01) {
          const settle = Math.min(remaining, debtor.amount);
          transfers.push({ from: debtor.id, to: creditor.id, amount: settle });
          remaining -= settle;
          debtor.amount -= settle;
        }
      });
    });

    const totalPending = transfers.reduce((s, t) => s + t.amount, 0);
    return {
      amount: totalPending,
      isSettled: transfers.length === 0,
      debtor: transfers[0] ? getMemberName(transfers[0].from) : '',
      creditor: transfers[0] ? getMemberName(transfers[0].to) : '',
      transfers,
    };
  }, [expenses, householdMembers, currentUser, myName]);

  const getPayerName = (paidById: string) => getMemberName(paidById);

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

      // Dispatch push notification to housemates
      const senderName = userObj.nickname || userObj.full_name || 'คนในบ้าน';
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: userObj.household_id,
          excludeUserId: userObj.id,
          title: '💰 Bobbies Homie',
          body: language === 'th'
            ? `${senderName} เพิ่มค่าใช้จ่ายใหม่: "${newTitle.trim()}" จำนวน ฿${amountVal.toLocaleString('th-TH')} 💸`
            : `${senderName} added expense: "${newTitle.trim()}" ฿${amountVal.toLocaleString()} 💸`,
          link: '/finances',
        }),
      }).catch(() => {});

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

  const openEditModal = (expense: DbFinance) => {
    setEditingExpense(expense);
    setEditTitle(expense.title);
    setEditAmount(String(expense.amount));
    setEditCategory(expense.category);
    setEditPaidBy(expense.paid_by);
    setIsEditModalOpen(true);
  };

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    const amountVal = parseFloat(editAmount);
    if (!editTitle.trim() || isNaN(amountVal) || amountVal <= 0) return;

    try {
      setEditSubmitting(true);
      const updated = await updateFinance(editingExpense.id, {
        title: editTitle.trim(),
        amount: amountVal,
        category: editCategory,
        paid_by: editPaidBy,
      });
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setIsEditModalOpen(false);
      setEditingExpense(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'แก้ไขไม่สำเร็จ';
      alert(msg);
    } finally {
      setEditSubmitting(false);
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

        // When marked as paid/settled, send push notification
        if (!currentReimbursed && currentUser?.household_id) {
          const target = expenses.find((e) => e.id === id);
          const senderName = currentUser.nickname || currentUser.full_name || 'คนในบ้าน';
          const titleDesc = target?.title ? ` "${target.title}"` : '';
          const amountDesc = target?.amount ? ` ฿${Number(target.amount).toLocaleString('th-TH')}` : '';
          fetch('/api/notifications/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              householdId: currentUser.household_id,
              excludeUserId: currentUser.id,
              title: '💵 Bobbies Homie',
              body: language === 'th'
                ? `${senderName} เคลียร์บิลแล้ว:${titleDesc}${amountDesc} เรียบร้อยแล้ว 🎉`
                : `${senderName} settled bill:${titleDesc}${amountDesc} 🎉`,
              link: '/finances',
            }),
          }).catch(() => {});
        }
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

      const senderName = currentUser.nickname || currentUser.full_name || 'คนในบ้าน';
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: currentUser.household_id,
          excludeUserId: currentUser.id,
          title: '💵 Bobbies Homie',
          body: language === 'th'
            ? `${senderName} เคลียร์ยอดค่าใช้จ่ายทั้งหมดในบ้านเรียบร้อยแล้ว! ✨`
            : `${senderName} settled all household expenses! ✨`,
          link: '/finances',
        }),
      }).catch(() => {});
    } catch (err) {
      console.error(err);
    }
  };

  // Slip upload handler
  const handleSlipUpload = async (expenseId: string, file: File) => {
    try {
      setUploadingSlipId(expenseId);
      const url = await uploadTransferSlip(file, expenseId);
      const updated = await updateFinance(expenseId, {
        slip_url: url,
        slip_uploaded_at: new Date().toISOString(),
      });
      setExpenses((prev) => prev.map((e) => (e.id === expenseId ? updated : e)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'อัปโหลดสลิปไม่สำเร็จ';
      alert(msg);
    } finally {
      setUploadingSlipId(null);
    }
  };

  // Record a manual transfer
  const handleRecordTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(transferAmount);
    if (!transferFrom || !transferTo || isNaN(amountVal) || amountVal <= 0) return;
    if (transferFrom === transferTo) {
      alert(language === 'th' ? 'ผู้โอนและผู้รับต้องไม่เป็นคนเดียวกัน' : 'Sender and receiver must be different');
      return;
    }

    let userObj = currentUser;
    if (!userObj?.household_id) return;

    try {
      setTransferSubmitting(true);
      const note = transferNote.trim() || (language === 'th' ? 'โอนชำระ' : 'Transfer payment');
      const created = await createFinance(userObj.household_id, {
        title: `${language === 'th' ? '💸 โอนชำระ' : '💸 Transfer'}: ${note}`,
        category: 'other',
        amount: amountVal,
        paid_by: transferFrom,
        date: new Date().toISOString().split('T')[0],
      });

      // Mark as reimbursed immediately (it's a settlement)
      await updateFinance(created.id, { is_reimbursed: true });
      const settled = { ...created, is_reimbursed: true };
      setExpenses((prev) => [settled, ...prev]);

      const fromMember = householdMembers.find((m) => m.id === transferFrom);
      const toMember = householdMembers.find((m) => m.id === transferTo);
      const fromName = fromMember ? (fromMember.nickname || fromMember.full_name) : 'คนในบ้าน';
      const toName = toMember ? (toMember.nickname || toMember.full_name) : '';
      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: userObj.household_id,
          excludeUserId: userObj.id,
          title: '💸 Bobbies Homie',
          body: language === 'th'
            ? `${fromName} โอนชำระเงิน${toName ? `ให้ ${toName}` : ''} ฿${amountVal.toLocaleString('th-TH')} เรียบร้อยแล้ว ✨`
            : `${fromName} transferred ฿${amountVal.toLocaleString()}${toName ? ` to ${toName}` : ''} ✨`,
          link: '/finances',
        }),
      }).catch(() => {});

      setTransferAmount('');
      setTransferNote('');
      setIsTransferModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกการโอนไม่สำเร็จ';
      alert(msg);
    } finally {
      setTransferSubmitting(false);
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

  // Reusable category select
  const renderCategorySelect = (value: string, onChange: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
  );

  const renderMemberSelect = (value: string, onChange: (v: string) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
  );

  // Slip age warning helper
  const getSlipDaysLeft = (uploadedAt: string | null | undefined) => {
    if (!uploadedAt) return null;
    const uploaded = new Date(uploadedAt);
    const now = new Date();
    const diffMs = now.getTime() - uploaded.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(0, 7 - diffDays);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1A1816] select-none w-full max-w-md sm:max-w-[448px] mx-auto pb-28 transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-tight text-[#5D4037] dark:text-[#DDD7D2]">
            {t.finances.title}
          </h1>
          <p className="font-dm-sans text-[13px] leading-normal text-[#8D6E63] dark:text-[#948D87] mt-1.5">
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
                <div className="w-9 h-9 rounded-full bg-[#E3F2FD] dark:bg-[#102A45]/60 border border-[#BBDEFB] dark:border-[#1565C0]/40 flex items-center justify-center text-[#1565C0] dark:text-[#90CAF9] shadow-2xs">
                  <Wallet className="w-4 h-4 stroke-current" />
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-outfit font-bold text-[32px] leading-[40px] text-[#5D4037] dark:text-[#DDD7D2]">
                  ฿{balanceSummary.amount.toFixed(2)}
                </span>
                {!balanceSummary.isSettled ? (
                  <span className="font-dm-sans text-[12px] font-medium text-[#E65100] dark:text-[#FFCC80] bg-[#FFE0B2] dark:bg-[#2E2A27] px-2.5 py-0.5 rounded-full border border-[#FFCC80]/40">
                    {language === 'th' ? 'มียอดค้างชำระ' : 'Pending'}
                  </span>
                ) : (
                  <span className="font-dm-sans text-[12px] font-medium text-[#2E7D32] dark:text-[#A5D6A7] bg-[#C8E6C9] dark:bg-[#1B5E20]/40 px-2.5 py-0.5 rounded-full border border-[#81C784]/40">
                    {t.dashboard.allSettled}
                  </span>
                )}
              </div>

              {/* Transfer breakdown */}
              {!balanceSummary.isSettled && balanceSummary.transfers.length > 0 && (
                <div className="w-full space-y-1.5">
                  {balanceSummary.transfers.map((tr, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px] text-[#5D4037] dark:text-[#DDD7D2]">
                      <span className="font-semibold">{getMemberName(tr.from)}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#E65100] dark:text-[#FFB74D] shrink-0" />
                      <span className="font-semibold">{getMemberName(tr.to)}</span>
                      <span className="ml-auto font-outfit font-bold text-[#E65100] dark:text-[#FFB74D]">
                        ฿{tr.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="flex-1 py-2.5 bg-[#1565C0] dark:bg-[#1565C0]/70 hover:bg-[#0D47A1] text-white rounded-[14px] text-[12px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  {language === 'th' ? 'บันทึกการโอน' : 'Record Transfer'}
                </button>
                {!balanceSummary.isSettled && (
                  <button
                    type="button"
                    onClick={handleSettleAll}
                    className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[12px] font-semibold text-[#5D4037] dark:text-[#DDD7D2] hover:opacity-90 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[#2E7D32]" />
                    {t.finances.settleAll}
                  </button>
                )}
              </div>
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] text-white rounded-[16px] text-[13px] font-semibold shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-white" strokeWidth={2.5} />
                  {t.finances.addExpense}
                </button>
              </div>
            ) : (
              expenses.map((expense) => {
                const isResolved = expense.is_reimbursed;
                const slipDaysLeft = getSlipDaysLeft(expense.slip_uploaded_at);
                const isUploadingThis = uploadingSlipId === expense.id;

                return (
                  <SwipeableRow
                    key={expense.id}
                    onEdit={() => openEditModal(expense)}
                    onDelete={() => handleDelete(expense.id)}
                    editLabel={language === 'th' ? 'แก้ไข' : 'Edit'}
                    deleteLabel={language === 'th' ? 'ลบ' : 'Delete'}
                    className="rounded-[18px]"
                  >
                    <div
                      className={`p-3.5 rounded-[18px] border transition-all ${
                        isResolved
                          ? 'bg-[#F4EFEA]/60 dark:bg-[#1F1D1B]/60 border-[#D7CCC8]/60 dark:border-[#2E2A27]/60 opacity-70'
                          : 'bg-white dark:bg-[#1F1D1B] border-[#D7CCC8] dark:border-[#2E2A27] shadow-[0px_2px_8px_rgba(93,64,55,0.03)]'
                      }`}
                    >
                      {/* Main row */}
                      <div className="flex items-center justify-between gap-2">
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

                          <div className="flex flex-col min-w-0 flex-1">
                            <span
                              className={`font-dm-sans text-[14px] leading-[19px] truncate ${
                                isResolved ? 'line-through text-[#8D6E63] dark:text-[#948D87]/60' : 'font-medium text-[#5D4037] dark:text-[#DDD7D2]'
                              }`}
                            >
                              {expense.title}
                            </span>
                            <span className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                              {getCategoryLabel(expense.category)} • {getPayerName(expense.paid_by)}{language === 'th' ? ' จ่าย' : ' paid'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
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
                            onClick={() => openEditModal(expense)}
                            title={t.common.edit}
                            className="p-1.5 text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-[#DDD7D2] rounded-lg transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 stroke-current" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(expense.id)}
                            title={t.common.delete}
                            className="p-1.5 text-[#8D6E63] hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 stroke-current" />
                          </button>
                        </div>
                      </div>

                      {/* Slip section */}
                      <div className="mt-2.5 pt-2.5 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27]/40">
                        {expense.slip_url ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={expense.slip_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[11px] font-medium text-[#1565C0] dark:text-[#90CAF9] hover:underline"
                            >
                              <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                              {language === 'th' ? 'ดูสลิป' : 'View Slip'}
                            </a>
                            {slipDaysLeft !== null && slipDaysLeft <= 3 && (
                              <span className="flex items-center gap-1 text-[10px] text-[#E65100] dark:text-[#FFB74D]">
                                <AlertCircle className="w-3 h-3" />
                                {language === 'th' ? `ลบใน ${slipDaysLeft} วัน` : `Deleted in ${slipDaysLeft}d`}
                              </span>
                            )}
                            {slipDaysLeft !== null && slipDaysLeft > 3 && (
                              <span className="text-[10px] text-[#8D6E63] dark:text-[#948D87]">
                                {language === 'th' ? `เก็บอีก ${slipDaysLeft} วัน` : `Kept ${slipDaysLeft}d`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              id={`slip-${expense.id}`}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleSlipUpload(expense.id, file);
                              }}
                            />
                            <label
                              htmlFor={`slip-${expense.id}`}
                              className={`inline-flex items-center gap-1.5 text-[11px] font-medium cursor-pointer transition-colors ${
                                isUploadingThis
                                  ? 'text-[#8D6E63] dark:text-[#948D87]'
                                  : 'text-[#5D4037] dark:text-[#948D87] hover:text-[#1565C0] dark:hover:text-[#90CAF9]'
                              }`}
                            >
                              {isUploadingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Upload className="w-3.5 h-3.5" />
                              )}
                              {isUploadingThis
                                ? (language === 'th' ? 'กำลังอัปโหลด...' : 'Uploading...')
                                : (language === 'th' ? 'แนบสลิป (เก็บ 7 วัน)' : 'Attach slip (kept 7 days)')}
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  </SwipeableRow>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#FDFBF7] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] w-full max-w-[390px] rounded-[24px] p-5 shadow-xl">
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
                  {language === 'th' ? 'ชื่อรายการ' : 'Item Name'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={language === 'th' ? 'ชื่อรายการ' : 'Item Name'}
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
                  placeholder={t.finances.amount}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.category}
                </label>
                {renderCategorySelect(newCategory, setNewCategory)}
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.paidBy}
                </label>
                {renderMemberSelect(newPaidBy, setNewPaidBy)}
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
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] text-white rounded-[14px] text-[13px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : t.common.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {isEditModalOpen && editingExpense && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#FDFBF7] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] w-full max-w-[390px] rounded-[24px] p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? 'แก้ไขรายการ' : 'Edit Expense'}
              </h3>
              <button
                type="button"
                onClick={() => { setIsEditModalOpen(false); setEditingExpense(null); }}
                className="p-1 text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateExpense} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'ชื่อรายการ' : 'Item Name'}
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
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
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.category}
                </label>
                {renderCategorySelect(editCategory, setEditCategory)}
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {t.finances.paidBy}
                </label>
                {renderMemberSelect(editPaidBy, setEditPaidBy)}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingExpense(null); }}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] text-white rounded-[14px] text-[13px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {editSubmitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกการแก้ไข' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#FDFBF7] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] w-full max-w-[360px] rounded-[24px] p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? '💸 บันทึกการโอนเงิน' : '💸 Record Transfer'}
              </h3>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 text-[#8D6E63] dark:text-[#948D87] hover:text-[#5D4037] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordTransfer} className="space-y-3.5">
              {/* From */}
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'ผู้โอน (คนจ่าย)' : 'Sender (who pays)'}
                </label>
                {renderMemberSelect(transferFrom, setTransferFrom)}
              </div>

              {/* Arrow visual */}
              <div className="flex justify-center">
                <div className="flex items-center gap-2 text-[12px] text-[#8D6E63] dark:text-[#948D87]">
                  <span className="font-semibold">{getMemberName(transferFrom)}</span>
                  <ArrowRight className="w-4 h-4 text-[#E65100] dark:text-[#FFB74D]" />
                  <span className="font-semibold">{getMemberName(transferTo)}</span>
                </div>
              </div>

              {/* To */}
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'ผู้รับ' : 'Receiver'}
                </label>
                {renderMemberSelect(transferTo, setTransferTo)}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'จำนวนเงินที่โอน (THB)' : 'Transfer Amount (THB)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder={language === 'th' ? 'จำนวนเงินที่โอน' : 'Transfer Amount'}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
                  {language === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : 'Note (optional)'}
                </label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder={language === 'th' ? 'หมายเหตุ' : 'Note'}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="flex-1 py-2.5 bg-[#1565C0] dark:bg-[#1565C0]/80 hover:bg-[#0D47A1] text-white rounded-[14px] text-[13px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {transferSubmitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกการโอน' : 'Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
