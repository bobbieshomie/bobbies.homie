'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Clock, 
  MapPin, 
  X, 
  ShoppingCart, 
  PawPrint, 
  Wallet, 
  Sparkles, 
  Calendar as CalendarIcon,
  User,
  Users,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  StickyNote,
  Briefcase,
  Plane,
  MoreHorizontal
} from 'lucide-react';
import { RiBearSmileFill } from '@remixicon/react';
import { createClient } from '@/lib/supabase/client';
import { 
  fetchCalendarEvents, 
  createCalendarEvent, 
  deleteCalendarEvent,
  updateCalendarEvent,
  fetchHouseholdMembers,
  type DbCalendarEvent,
  type DbProfile
} from '@/lib/services/db';
import { useLanguage } from '@/lib/i18n/language-context';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

// Thai Bank Holidays 2025-2026 (วันหยุดตามธนาคารแห่งประเทศไทย)
const THAI_BANK_HOLIDAYS: Set<string> = new Set([
  // 2025
  '2025-01-01', '2025-02-12', '2025-04-06', '2025-04-07', '2025-04-14',
  '2025-04-15', '2025-05-01', '2025-05-05', '2025-05-12', '2025-06-02',
  '2025-06-03', '2025-07-11', '2025-07-28', '2025-08-12', '2025-10-13',
  '2025-10-23', '2025-12-05', '2025-12-10', '2025-12-31',
  // 2026
  '2026-01-01', '2026-01-02', '2026-02-27', '2026-04-06', '2026-04-13',
  '2026-04-14', '2026-04-15', '2026-05-01', '2026-05-05', '2026-05-25',
  '2026-06-03', '2026-07-29', '2026-07-30', '2026-08-12', '2026-10-13',
  '2026-10-23', '2026-12-07', '2026-12-10', '2026-12-31',
]);

const isThaiBankHoliday = (year: number, month: number, day: number): boolean => {
  const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return THAI_BANK_HOLIDAYS.has(key);
};

const CATEGORY_META: Record<string, { labelTh: string; labelEn: string; color: string; bgColor: string; darkBgColor: string; icon: string }> = {
  shopping: {
    labelTh: 'ซื้อของเข้าบ้าน',
    labelEn: 'Shopping',
    color: '#2E7D32',
    bgColor: '#E8F5E9',
    darkBgColor: '#1E3320',
    icon: 'shopping-cart',
  },
  pets: {
    labelTh: 'ดูแลสัตว์เลี้ยง',
    labelEn: 'Pet Care',
    color: '#E65100',
    bgColor: '#FFF3E0',
    darkBgColor: '#3B2416',
    icon: 'paw',
  },
  finance: {
    labelTh: 'ค่าใช้จ่ายร่วม',
    labelEn: 'Finances',
    color: '#1565C0',
    bgColor: '#E3F2FD',
    darkBgColor: '#17273A',
    icon: 'wallet',
  },
  chore: {
    labelTh: 'งานบ้าน',
    labelEn: 'Chores',
    color: '#7B1FA2',
    bgColor: '#F3E5F5',
    darkBgColor: '#2F1936',
    icon: 'sparkles',
  },
  date: {
    labelTh: 'กิจกรรมในบ้าน',
    labelEn: 'House Activity',
    color: '#5D4037',
    bgColor: '#EFEBE9',
    darkBgColor: '#36231C',
    icon: 'bear',
  },
  errand: {
    labelTh: 'ทำธุระ',
    labelEn: 'Errand',
    color: '#00838F',
    bgColor: '#E0F7FA',
    darkBgColor: '#003B40',
    icon: 'briefcase',
  },
  trip: {
    labelTh: 'เที่ยว',
    labelEn: 'Trip',
    color: '#AD1457',
    bgColor: '#FCE4EC',
    darkBgColor: '#4A0726',
    icon: 'plane',
  },
  other: {
    labelTh: 'อื่นๆ',
    labelEn: 'Other',
    color: '#546E7A',
    bgColor: '#ECEFF1',
    darkBgColor: '#1C2225',
    icon: 'more',
  },
};

// Determine display category — if title has custom suffix from "other", use "other" meta
function getEffectiveCategory(act: DbCalendarEvent) {
  return CATEGORY_META[act.category] ? act.category : 'other';
}

export default function CalendarPage() {
  const { t, language } = useLanguage();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<DbProfile | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<DbProfile[]>([]);
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);

  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit modal state
  const [editingEvent, setEditingEvent] = useState<DbCalendarEvent | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Month navigation
  const goToPrevMonth = () => {
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
    setSelectedDay(1);
  };
  const goToNextMonth = () => {
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
    setSelectedDay(1);
  };

  // Form State — Add
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>('date');
  const [newOtherText, setNewOtherText] = useState('');
  const [newTime, setNewTime] = useState('14:00');
  const [newLocation, setNewLocation] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState<string>('All');
  const [showTime, setShowTime] = useState(false);

  // Form State — Edit
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('date');
  const [editOtherText, setEditOtherText] = useState('');
  const [editTime, setEditTime] = useState('14:00');
  const [editLocation, setEditLocation] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('All');
  const [editShowTime, setEditShowTime] = useState(false);

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

  // Load Data
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

        if (profile.household_id) {
          const members = await fetchHouseholdMembers(profile.household_id);
          setHouseholdMembers(members);

          const dbEvents = await fetchCalendarEvents(profile.household_id);
          setEvents(dbEvents);
        }
      }
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calendar dates calculation
  const todayDate = new Date();
  const todayYear = todayDate.getFullYear();
  const todayMonth = todayDate.getMonth();
  const todayDay = todayDate.getDate();

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    language === 'th' ? 'th-TH' : 'en-US',
    { month: 'long', year: 'numeric' }
  );

  const calendarDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: 0, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, isCurrentMonth: true });
    }
    return days;
  }, [firstDayIndex, daysInMonth]);

  const dayEventMap = useMemo(() => {
    const map: Record<number, DbCalendarEvent[]> = {};
    events.forEach((ev) => {
      const d = new Date(ev.start_time);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        const dayNum = d.getDate();
        if (!map[dayNum]) map[dayNum] = [];
        map[dayNum].push(ev);
      }
    });
    return map;
  }, [events, viewYear, viewMonth]);

  const currentDayEvents = dayEventMap[selectedDay] || [];

  // Resolve effective title for "other" category
  const resolveTitle = (baseTitle: string, category: string, otherText: string) => {
    if (category === 'other' && otherText.trim()) {
      return `${baseTitle} (${otherText.trim()})`;
    }
    return baseTitle;
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

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
      const meta = CATEGORY_META[newCategory] || CATEGORY_META.date;
      
      const padDay = selectedDay.toString().padStart(2, '0');
      const padMonth = (viewMonth + 1).toString().padStart(2, '0');
      const datePrefix = `${viewYear}-${padMonth}-${padDay}`;
      const startTime = showTime ? `${datePrefix}T${newTime}:00Z` : `${datePrefix}T00:00:00Z`;
      const endTime = `${datePrefix}T23:59:00Z`;

      const finalTitle = newCategory === 'other' && newOtherText.trim()
        ? `${newTitle.trim()} (${newOtherText.trim()})`
        : newTitle.trim();

      const created = await createCalendarEvent(
        userObj.household_id,
        userObj.id,
        {
          title: finalTitle,
          start_time: startTime,
          end_time: endTime,
          location: newLocation.trim() || undefined,
          category: newCategory,
          assigned_to: newAssignedTo,
          color_tag: meta.color,
        }
      );

      setEvents((prev) => [...prev, created]);

      // Dispatch push notification to housemates
      const senderName = userObj.nickname || userObj.full_name || 'คนในบ้าน';
      const todayStr = new Date().toISOString().split('T')[0];
      const isToday = datePrefix === todayStr;

      fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: userObj.household_id,
          excludeUserId: userObj.id,
          title: '📅 Bobbies Homie',
          body: isToday
            ? (language === 'th'
                ? `${senderName} เพิ่มกิจกรรมสำหรับวันนี้: "${finalTitle}" (${showTime ? newTime : 'ทั้งวัน'}) 📅`
                : `${senderName} added an event today: "${finalTitle}" (${showTime ? newTime : 'All day'}) 📅`)
            : (language === 'th'
                ? `${senderName} เพิ่มนัดหมายลงปฏิทิน: "${finalTitle}" วันที่ ${padDay}/${padMonth}`
                : `${senderName} scheduled event: "${finalTitle}" on ${padDay}/${padMonth}`),
          link: '/calendar',
        }),
      }).catch(() => {});

      setNewTitle('');
      setNewLocation('');
      setNewOtherText('');
      setIsAddEventOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'บันทึกกิจกรรมไม่สำเร็จ';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestDeleteEvent = (id: string, title?: string) => {
    setConfirmDialog({
      isOpen: true,
      title: language === 'th' ? 'ยืนยันการลบกิจกรรม' : 'Delete Event?',
      description: language === 'th'
        ? `ต้องการลบกิจกรรม "${title || ''}" ใช่หรือไม่?`
        : `Are you sure you want to delete "${title || 'this event'}"?`,
      onConfirm: async () => {
        try {
          await deleteCalendarEvent(id);
          setEvents((prev) => prev.filter((ev) => ev.id !== id));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'ลบไม่สำเร็จ';
          alert(msg);
        }
      },
    });
  };

  const openEditModal = (act: DbCalendarEvent) => {
    setEditingEvent(act);
    setEditTitle(act.title);
    setEditCategory(act.category);
    setEditOtherText('');
    setEditLocation(act.location || '');
    setEditAssignedTo(act.assigned_to || 'All');
    const d = new Date(act.start_time);
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
    setEditShowTime(hasTime);
    setEditTime(`${h}:${m}`);
    setIsEditOpen(true);
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !editTitle.trim()) return;

    try {
      setSubmitting(true);
      const meta = CATEGORY_META[editCategory] || CATEGORY_META.date;

      const d = new Date(editingEvent.start_time);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const datePrefix = `${year}-${month}-${day}`;
      const startTime = editShowTime ? `${datePrefix}T${editTime}:00Z` : `${datePrefix}T00:00:00Z`;
      const endTime = `${datePrefix}T23:59:00Z`;

      const finalTitle = editCategory === 'other' && editOtherText.trim()
        ? `${editTitle.trim()} (${editOtherText.trim()})`
        : editTitle.trim();

      const updated = await updateCalendarEvent(editingEvent.id, {
        title: finalTitle,
        start_time: startTime,
        end_time: endTime,
        location: editLocation.trim() || null,
        category: editCategory,
        assigned_to: editAssignedTo,
        color_tag: meta.color,
      });

      setEvents((prev) => prev.map((ev) => (ev.id === updated.id ? updated : ev)));
      setIsEditOpen(false);
      setEditingEvent(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'แก้ไขไม่สำเร็จ';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const renderIcon = (category: string, color: string) => {
    switch (category) {
      case 'shopping':
        return <ShoppingCart className="w-4 h-4" style={{ stroke: color }} />;
      case 'pets':
        return <PawPrint className="w-4 h-4" style={{ stroke: color }} />;
      case 'finance':
        return <Wallet className="w-4 h-4" style={{ stroke: color }} />;
      case 'chore':
        return <Sparkles className="w-4 h-4" style={{ stroke: color }} />;
      case 'errand':
        return <Briefcase className="w-4 h-4" style={{ stroke: color }} />;
      case 'trip':
        return <Plane className="w-4 h-4" style={{ stroke: color }} />;
      case 'other':
        return <MoreHorizontal className="w-4 h-4" style={{ stroke: color }} />;
      case 'date':
      default:
        return <RiBearSmileFill className="w-4 h-4 fill-current" style={{ color }} />;
    }
  };

  const formatEventTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      const h = d.getUTCHours();
      const m = d.getUTCMinutes();
      if (h === 0 && m === 0) return language === 'th' ? 'ทั้งวัน' : 'All day';
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  const categoryOptions = [
    { value: 'date', labelTh: 'กิจกรรมในบ้าน', labelEn: 'House Activity' },
    { value: 'errand', labelTh: 'ทำธุระ', labelEn: 'Errand' },
    { value: 'trip', labelTh: 'เที่ยว', labelEn: 'Trip' },
    { value: 'shopping', labelTh: 'ซื้อของ', labelEn: 'Shopping' },
    { value: 'pets', labelTh: 'ดูแลสัตว์เลี้ยง', labelEn: 'Pet Care' },
    { value: 'finance', labelTh: 'ค่าใช้จ่ายร่วม', labelEn: 'Finances' },
    { value: 'chore', labelTh: 'งานบ้าน', labelEn: 'Chores' },
    { value: 'other', labelTh: 'อื่นๆ', labelEn: 'Other' },
  ];

  // Shared form fields component (add / edit)
  const renderFormFields = (
    mode: 'add' | 'edit',
    title: string, setTitle: (v: string) => void,
    category: string, setCategory: (v: string) => void,
    otherText: string, setOtherText: (v: string) => void,
    showT: boolean, setShowT: (v: boolean) => void,
    time: string, setTime: (v: string) => void,
    location: string, setLocation: (v: string) => void,
    assignedTo: string, setAssignedTo: (v: string) => void,
  ) => (
    <>
      {/* Title */}
      <div>
        <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
          {language === 'th' ? 'ชื่อโน้ต / กิจกรรม' : 'Note / Event Title'}
        </label>
        <div className="relative">
          <StickyNote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8D6E63] dark:text-[#948D87] pointer-events-none" />
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={language === 'th' ? 'ชื่อโน้ต / กิจกรรม' : 'Note / Event Title'}
            className="w-full pl-9 pr-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/50 focus:outline-none focus:border-[#5D4037]"
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
          {t.calendar.category}
        </label>
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037] cursor-pointer"
          >
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {language === 'th' ? opt.labelTh : opt.labelEn}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8D6E63] dark:text-[#948D87] pointer-events-none" />
        </div>
        {/* "อื่นๆ" custom text input */}
        {category === 'other' && (
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder={language === 'th' ? 'ระบุประเภท' : 'Specify type'}
            className="mt-2 w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/50 focus:outline-none focus:border-[#5D4037]"
          />
        )}
      </div>

      {/* Optional Time Toggle — fixed layout, no z-index bleed */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] pointer-events-none">
            {language === 'th' ? 'ระบุเวลา (ไม่บังคับ)' : 'Time (optional)'}
          </label>
          {/* Toggle button — isolated, no overflow */}
          <button
            type="button"
            role="switch"
            aria-checked={showT}
            onClick={() => setShowT(!showT)}
            className={`relative inline-flex items-center rounded-full transition-colors focus:outline-none cursor-pointer shrink-0 ${
              showT ? 'bg-[#5D4037] dark:bg-[#6E544A]' : 'bg-[#D7CCC8] dark:bg-[#2E2A27]'
            }`}
            style={{ width: 40, height: 22 }}
          >
            <span
              className={`absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform ${
                showT ? 'translate-x-[20px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>
        {showT && (
          <div className="relative w-full max-w-full overflow-hidden">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8D6E63] dark:text-[#948D87] pointer-events-none z-10" />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full max-w-full box-border pl-9 pr-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037] block appearance-none"
            />
          </div>
        )}
      </div>

      {/* Location */}
      <div>
        <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
          {language === 'th' ? 'สถานที่ (ไม่บังคับ)' : 'Location (optional)'}
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8D6E63] dark:text-[#948D87] pointer-events-none" />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={language === 'th' ? 'สถานที่' : 'Location'}
            className="w-full pl-9 pr-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] placeholder-[#8D6E63]/50 focus:outline-none focus:border-[#5D4037]"
          />
        </div>
      </div>

      {/* Assign To */}
      <div>
        <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#948D87] mb-1">
          {language === 'th' ? 'ใครในบ้าน' : 'Assign to'}
        </label>
        <div className="relative">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8D6E63] dark:text-[#948D87] pointer-events-none" />
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full appearance-none pl-9 pr-9 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#DDD7D2] focus:outline-none focus:border-[#5D4037] cursor-pointer"
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
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8D6E63] dark:text-[#948D87] pointer-events-none" />
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1A1816] select-none w-full max-w-md sm:max-w-[448px] mx-auto pb-28 no-scrollbar transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-tight text-[#5D4037] dark:text-[#DDD7D2]">
            {t.calendar.title}
          </h1>
          <p className="font-dm-sans text-[13px] leading-normal text-[#8D6E63] dark:text-[#948D87] mt-1.5">
            {language === 'th' ? 'ปฏิทินโน้ตและกิจกรรมของบ้าน ใส่เวลาได้ถ้าต้องการ' : 'Household notes & events, add time if needed'}
          </p>
        </div>
      </div>

      {/* Unified Household Banner */}
      <div className="px-6 py-2.5">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[16px] gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-full bg-[#5D4037] dark:bg-[#3D2C22] border border-[#5D4037]/20 dark:border-[#FFD54F]/30 text-[#FFD54F] flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[12px] font-bold text-[#5D4037] dark:text-[#DDD7D2] block leading-tight truncate">
                {language === 'th' ? 'กิจกรรมรวมในบ้าน' : 'Household Shared Calendar'}
              </span>
              <span className="text-[10px] text-[#8D6E63] dark:text-[#948D87] block truncate">
                {householdMembers.length > 0 
                  ? `${householdMembers.length} ${language === 'th' ? 'คนในบ้าน' : 'members'}` 
                  : (language === 'th' ? 'คนในบ้าน' : 'members')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddEventOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#5D4037] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white text-[11px] font-semibold rounded-[10px] shadow-xs transition-colors cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            {t.calendar.addEvent}
          </button>
        </div>
      </div>

      {/* Month Label */}
      <div className="px-6 pt-2 pb-2 flex justify-center items-center">
        <span className="font-outfit font-bold text-[17px] text-[#5D4037] dark:text-[#DDD7D2] capitalize">
          {monthLabel}
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="px-6 pb-4">
        <div className="p-3.5 bg-white dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[22px] shadow-[0px_4px_16px_rgba(93,64,55,0.03)]">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 text-center pb-2 border-b border-[#D7CCC8]/40 dark:border-[#2E2A27]/60">
            {(language === 'th'
              ? ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
              : ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa']
            ).map((d, i) => (
              <span key={i} className="font-dm-sans font-bold text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-y-1.5 pt-2">
            {calendarDays.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return <div key={idx} className="h-9" />;
              }

              const isSelected = selectedDay === cell.day;
              const hasEvents = (dayEventMap[cell.day] || []).length > 0;
              const isHoliday = isThaiBankHoliday(viewYear, viewMonth, cell.day);
              const isToday = viewYear === todayYear && viewMonth === todayMonth && cell.day === todayDay;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDay(cell.day)}
                  className={`h-9 flex flex-col items-center justify-center rounded-[12px] transition-all relative cursor-pointer ${
                    isSelected
                      ? 'bg-[#5D4037] text-white font-bold shadow-xs'
                      : isToday
                      ? 'bg-[#F4EFEA] dark:bg-[#2E2A27] font-bold ring-1 ring-[#5D4037]/40'
                      : 'hover:bg-[#F4EFEA] dark:hover:bg-[#2E2A27]'
                  }`}
                >
                  <span className={`text-[13px] font-dm-sans leading-none ${
                    isSelected
                      ? 'text-white'
                      : isHoliday
                      ? 'text-[#8D6E63] dark:text-[#DDD7D2] font-semibold'
                      : 'text-[#5D4037] dark:text-[#DDD7D2]'
                  }`}>
                    {cell.day}
                  </span>
                  {isHoliday && !isSelected && (
                    <span className="w-1 h-1 rounded-full bg-[#8D6E63] dark:bg-[#6E544A] mt-0.5" />
                  )}
                  {hasEvents && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                        isSelected ? 'bg-[#FFE0B2]' : 'bg-[#E65100]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Month Navigation Row */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#D7CCC8]/40 dark:border-[#2E2A27]/60">
            <button
              type="button"
              onClick={() => {
                setViewYear(todayYear);
                setViewMonth(todayMonth);
                setSelectedDay(todayDay);
              }}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-[10px] transition-colors cursor-pointer border ${
                viewYear === todayYear && viewMonth === todayMonth
                  ? 'text-[#8D6E63] dark:text-[#948D87] border-transparent bg-transparent'
                  : 'text-[#5D4037] dark:text-[#DDD7D2] border-[#D7CCC8] dark:border-[#2E2A27] bg-[#F4EFEA] dark:bg-[#141312] hover:bg-[#E8DFD8] dark:hover:bg-[#2E2A27]'
              }`}
            >
              {language === 'th' ? 'เดือนปัจจุบัน' : 'Current month'}
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToPrevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] hover:bg-[#E8DFD8] dark:hover:bg-[#2E2A27] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] hover:bg-[#E8DFD8] dark:hover:bg-[#2E2A27] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Events for Selected Day */}
      <div className="flex-1 px-6 space-y-2.5">
        <div className="flex justify-between items-center px-1 pb-1">
          <div className="flex items-center gap-2">
            <h2 className="font-outfit font-bold text-[15px] text-[#5D4037] dark:text-[#DDD7D2]">
              {selectedDay} {monthLabel}
            </h2>
            {isThaiBankHoliday(viewYear, viewMonth, selectedDay) && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#F4EFEA] dark:bg-[#2E2A27] text-[#8D6E63] dark:text-[#DDD7D2] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-full">
                {language === 'th' ? 'วันหยุด' : 'Holiday'}
              </span>
            )}
          </div>
          <span className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#948D87]">
            {currentDayEvents.length} {t.common.items}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#8D6E63]" />
          </div>
        ) : currentDayEvents.length === 0 ? (
          <div className="p-6 bg-[#F4EFEA] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[20px] text-center">
            <p className="font-dm-sans text-[13px] text-[#8D6E63] dark:text-[#948D87]">
              {t.calendar.noEventsDay}
            </p>
          </div>
        ) : (
          currentDayEvents.map((act) => {
            const effCat = getEffectiveCategory(act);
            const meta = CATEGORY_META[effCat] || CATEGORY_META.date;
            const assigned = act.assigned_to || 'All';
            const isAll = assigned.toLowerCase() === 'all' || assigned.toLowerCase() === 'both';

            return (
              <SwipeableRow
                key={act.id}
                onEdit={() => openEditModal(act)}
                onDelete={() => handleRequestDeleteEvent(act.id, act.title)}
                editLabel={language === 'th' ? 'แก้ไข' : 'Edit'}
                deleteLabel={language === 'th' ? 'ลบ' : 'Delete'}
                className="rounded-[18px]"
              >
                <div
                  className="flex items-center justify-between p-3.5 bg-white dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[18px] shadow-[0px_2px_8px_rgba(93,64,55,0.03)]"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-[14px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: meta.bgColor }}
                    >
                      {renderIcon(effCat, meta.color)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-dm-sans font-medium text-[14px] leading-[18px] text-[#5D4037] dark:text-[#DDD7D2] truncate">
                        {act.title}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-[#8D6E63] dark:text-[#948D87]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatEventTime(act.start_time)}
                        </span>
                        {act.location && (
                          <span className="flex items-center gap-1 truncate max-w-[120px]">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {act.location}
                          </span>
                        )}

                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${
                          isAll
                            ? 'bg-[#8D6E63]/10 dark:bg-[#2E2A27] text-[#5D4037] dark:text-[#DDD7D2] border-[#D7CCC8]/60 dark:border-[#2E2A27]'
                            : 'bg-[#2E7D32]/10 dark:bg-[#1B5E20]/30 text-[#2E7D32] dark:text-[#A5D6A7] border-[#2E7D32]/30'
                        }`}>
                          {isAll ? <Users className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          <span>
                            {language === 'th' ? 'กำหนดให้: ' : 'For: '}
                            <strong>{isAll ? (language === 'th' ? 'ทุกคนในบ้าน' : 'All') : assigned}</strong>
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </SwipeableRow>
            );
          })
        )}
      </div>

      {/* Add Event Modal */}
      {isAddEventOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsAddEventOpen(false)}
        >
          <div 
            className="bg-[#FDFBF7] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] w-full max-w-[390px] rounded-[24px] p-5 shadow-xl overflow-y-auto max-h-[90vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#DDD7D2]">
                {t.calendar.addEvent}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddEventOpen(false)}
                className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5">
              {renderFormFields(
                'add',
                newTitle, setNewTitle,
                newCategory, setNewCategory,
                newOtherText, setNewOtherText,
                showTime, setShowTime,
                newTime, setNewTime,
                newLocation, setNewLocation,
                newAssignedTo, setNewAssignedTo,
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddEventOpen(false)}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer hover:bg-[#E8DFD8] dark:hover:bg-[#1F1D1B] transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] hover:dark:bg-[#2E2A27] text-white rounded-[14px] text-[13px] font-semibold disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกโน้ต' : 'Save Note')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {isEditOpen && editingEvent && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 animate-fade-in"
          onClick={() => { setIsEditOpen(false); setEditingEvent(null); }}
        >
          <div 
            className="bg-[#FDFBF7] dark:bg-[#1F1D1B] border border-[#D7CCC8] dark:border-[#2E2A27] w-full max-w-[390px] rounded-[24px] p-5 shadow-xl overflow-y-auto max-h-[90vh] animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#DDD7D2]">
                {language === 'th' ? 'แก้ไขกิจกรรม' : 'Edit Event'}
              </h3>
              <button
                type="button"
                onClick={() => { setIsEditOpen(false); setEditingEvent(null); }}
                className="w-8 h-8 rounded-full bg-[#EFE9E2] dark:bg-[#2E2A27] flex items-center justify-center text-[#8D6E63] hover:text-[#5D4037] dark:hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateEvent} className="space-y-3.5">
              {renderFormFields(
                'edit',
                editTitle, setEditTitle,
                editCategory, setEditCategory,
                editOtherText, setEditOtherText,
                editShowTime, setEditShowTime,
                editTime, setEditTime,
                editLocation, setEditLocation,
                editAssignedTo, setEditAssignedTo,
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setIsEditOpen(false); setEditingEvent(null); }}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#141312] border border-[#D7CCC8] dark:border-[#2E2A27] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#948D87] cursor-pointer hover:bg-[#E8DFD8] transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#6E544A] hover:bg-[#4A332C] text-white rounded-[14px] text-[13px] font-semibold disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {submitting ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : (language === 'th' ? 'บันทึกการแก้ไข' : 'Save Changes')}
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
