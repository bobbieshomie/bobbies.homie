'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Plus, 
  Clock, 
  MapPin, 
  X, 
  ShoppingCart, 
  PawPrint, 
  Wallet, 
  Sparkles, 
  Trash2,
  Calendar as CalendarIcon,
  User,
  Users,
  Loader2
} from 'lucide-react';
import { RiBearSmileFill } from '@remixicon/react';
import { createClient } from '@/lib/supabase/client';
import { 
  fetchCalendarEvents, 
  createCalendarEvent, 
  deleteCalendarEvent,
  fetchHouseholdMembers,
  type DbCalendarEvent,
  type DbProfile
} from '@/lib/services/db';
import { useLanguage } from '@/lib/i18n/language-context';
import { LanguageToggle } from '@/components/ui/language-toggle';

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
};

export default function CalendarPage() {
  const { t, language } = useLanguage();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<DbProfile | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<DbProfile[]>([]);
  const [events, setEvents] = useState<DbCalendarEvent[]>([]);

  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>('date');
  const [newTime, setNewTime] = useState('14:00');
  const [newLocation, setNewLocation] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState<string>('All');

  // Load Data
  const loadData = async () => {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setLoading(false);
        return;
      }

      // Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single();

      if (profile) {
        setCurrentUser(profile as DbProfile);

        if (profile.household_id) {
          // Fetch members
          const members = await fetchHouseholdMembers(profile.household_id);
          setHouseholdMembers(members);

          // Fetch events
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
  const currentMonthDate = new Date();
  const currentYear = currentMonthDate.getFullYear();
  const currentMonth = currentMonthDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

  const monthLabel = currentMonthDate.toLocaleDateString(
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

  // Group events by day of current month
  const dayEventMap = useMemo(() => {
    const map: Record<number, DbCalendarEvent[]> = {};
    events.forEach((ev) => {
      const d = new Date(ev.start_time);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const dayNum = d.getDate();
        if (!map[dayNum]) map[dayNum] = [];
        map[dayNum].push(ev);
      }
    });
    return map;
  }, [events, currentYear, currentMonth]);

  const currentDayEvents = dayEventMap[selectedDay] || [];

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
      const padMonth = (currentMonth + 1).toString().padStart(2, '0');
      const datePrefix = `${currentYear}-${padMonth}-${padDay}`;
      const startTime = `${datePrefix}T${newTime}:00Z`;
      const endTime = `${datePrefix}T23:59:00Z`;

      const created = await createCalendarEvent(
        userObj.household_id,
        userObj.id,
        {
          title: newTitle.trim(),
          start_time: startTime,
          end_time: endTime,
          location: newLocation.trim() || undefined,
          category: newCategory,
          assigned_to: newAssignedTo,
          color_tag: meta.color,
        }
      );

      setEvents((prev) => [...prev, created]);
      setNewTitle('');
      setNewLocation('');
      setIsAddEventOpen(false);
    } catch (err: any) {
      alert(err.message || 'บันทึกกิจกรรมไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteCalendarEvent(id);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } catch (err: any) {
      alert(err.message || 'ลบไม่สำเร็จ');
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
      case 'date':
      default:
        return <RiBearSmileFill className="w-4 h-4 fill-current" style={{ color }} />;
    }
  };

  const formatEventTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1F1511] select-none max-w-[420px] mx-auto pb-28 no-scrollbar transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-[30px] text-[#5D4037] dark:text-[#F5EBE6]">
            {t.calendar.title}
          </h1>
          <p className="font-dm-sans text-[13px] leading-[18px] text-[#8D6E63] dark:text-[#BCAAA4] mt-0.5">
            {language === 'th' ? 'ปฏิทินกิจกรรมรวมของบ้าน กำหนดรายบุคคลชัดเจน' : 'Unified household calendar with assigned members'}
          </p>
        </div>
        <LanguageToggle />
      </div>

      {/* Unified Household Banner (No more personal vs shared split) */}
      <div className="px-6 py-2.5">
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[16px]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#5D4037] dark:bg-[#4E342E] text-white flex items-center justify-center">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[12px] font-bold text-[#5D4037] dark:text-[#F5EBE6] block leading-tight">
                {language === 'th' ? 'กิจกรรมรวมในบ้าน' : 'Household Shared Calendar'}
              </span>
              <span className="text-[10px] text-[#8D6E63] dark:text-[#BCAAA4]">
                {householdMembers.length > 0 
                  ? `${householdMembers.length} ${language === 'th' ? 'คนในบ้าน' : 'members'}` 
                  : (language === 'th' ? 'คนในบ้าน' : 'members')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAddEventOpen(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#5D4037] hover:bg-[#4E342E] text-white text-[11px] font-semibold rounded-[10px] shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            {t.calendar.addEvent}
          </button>
        </div>
      </div>

      {/* Month Header */}
      <div className="px-6 pt-2 pb-2 flex justify-between items-center">
        <span className="font-outfit font-bold text-[17px] text-[#5D4037] dark:text-[#F5EBE6] capitalize">
          {monthLabel}
        </span>
      </div>

      {/* Calendar Grid */}
      <div className="px-6 pb-4">
        <div className="p-3.5 bg-white dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[22px] shadow-[0px_4px_16px_rgba(93,64,55,0.03)]">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 text-center pb-2 border-b border-[#D7CCC8]/40 dark:border-[#4E342E]/60">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={i} className="font-dm-sans font-bold text-[11px] text-[#8D6E63] dark:text-[#BCAAA4]">
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

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDay(cell.day)}
                  className={`h-9 flex flex-col items-center justify-center rounded-[12px] transition-all relative ${
                    isSelected
                      ? 'bg-[#5D4037] text-white font-bold shadow-xs'
                      : 'hover:bg-[#F4EFEA] dark:hover:bg-[#3B2820] text-[#5D4037] dark:text-[#F5EBE6]'
                  }`}
                >
                  <span className="text-[13px] font-dm-sans leading-none">
                    {cell.day}
                  </span>
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
        </div>
      </div>

      {/* Events for Selected Day */}
      <div className="flex-1 px-6 space-y-2.5">
        <div className="flex justify-between items-center px-1 pb-1">
          <h2 className="font-outfit font-bold text-[15px] text-[#5D4037] dark:text-[#F5EBE6]">
            {selectedDay} {monthLabel}
          </h2>
          <span className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#BCAAA4]">
            {currentDayEvents.length} {t.common.items}
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#8D6E63]" />
          </div>
        ) : currentDayEvents.length === 0 ? (
          <div className="p-6 bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[20px] text-center">
            <p className="font-dm-sans text-[13px] text-[#8D6E63] dark:text-[#BCAAA4] mb-3">
              {t.calendar.noEventsDay}
            </p>
            <button
              type="button"
              onClick={() => setIsAddEventOpen(true)}
              className="px-4 py-2 bg-[#5D4037] dark:bg-[#4E342E] text-white text-[12px] font-semibold rounded-[12px] shadow-xs hover:opacity-90"
            >
              + {t.calendar.addEvent}
            </button>
          </div>
        ) : (
          currentDayEvents.map((act) => {
            const meta = CATEGORY_META[act.category] || CATEGORY_META.date;
            const assigned = act.assigned_to || 'All';
            const isAll = assigned.toLowerCase() === 'all' || assigned.toLowerCase() === 'both';

            return (
              <div
                key={act.id}
                className="flex items-center justify-between p-3.5 bg-white dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[18px] shadow-[0px_2px_8px_rgba(93,64,55,0.03)]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="w-9 h-9 rounded-[14px] flex items-center justify-center shrink-0"
                    style={{ backgroundColor: meta.bgColor }}
                  >
                    {renderIcon(act.category, meta.color)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-dm-sans font-medium text-[14px] leading-[18px] text-[#5D4037] dark:text-[#F5EBE6] truncate">
                      {act.title}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[11px] text-[#8D6E63] dark:text-[#BCAAA4]">
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

                      {/* Prominent Assigned Account Badge */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium border ${
                        isAll
                          ? 'bg-[#8D6E63]/10 dark:bg-[#4E342E]/50 text-[#5D4037] dark:text-[#EFEBE9] border-[#D7CCC8]/60 dark:border-[#5D4037]'
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

                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(act.id)}
                    title={t.common.delete}
                    className="p-1.5 text-[#8D6E63] hover:text-red-500 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 stroke-current" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Event Modal */}
      {isAddEventOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFBF7] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] w-full max-w-[360px] rounded-[24px] p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#F5EBE6]">
                {t.calendar.addEvent}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddEventOpen(false)}
                className="p-1 text-[#8D6E63] dark:text-[#BCAAA4] hover:text-[#5D4037]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                  {language === 'th' ? 'ชื่อกิจกรรม' : 'Event Title'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={t.calendar.eventTitlePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                    {t.calendar.time}
                  </label>
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] focus:outline-none focus:border-[#5D4037]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                    {t.calendar.category}
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] focus:outline-none focus:border-[#5D4037]"
                  >
                    <option value="date">{language === 'th' ? 'กิจกรรมในบ้าน' : 'House Activity'}</option>
                    <option value="shopping">{t.create.shoppingTab}</option>
                    <option value="pets">{t.create.petsTab}</option>
                    <option value="finance">{t.create.financeTab}</option>
                    <option value="chore">{t.create.choresTab}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                  {t.calendar.location}
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder={t.calendar.locationPlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              {/* Dynamic Assigned To Member Dropdown */}
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                  {language === 'th' ? 'กำหนดผู้รับผิดชอบ / ใครในบ้าน' : 'Assign to House Member'}
                </label>
                <select
                  value={newAssignedTo}
                  onChange={(e) => setNewAssignedTo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] focus:outline-none focus:border-[#5D4037]"
                >
                  <option value="All">{language === 'th' ? '👥 ทุกคนในบ้าน (All Members)' : '👥 All Members'}</option>
                  {currentUser && (
                    <option value={currentUser.nickname || currentUser.full_name || 'Me'}>
                      👤 {currentUser.nickname || currentUser.full_name || 'Me'} ({language === 'th' ? 'ฉัน' : 'Me'})
                    </option>
                  )}
                  {householdMembers
                    .filter((m) => m.id !== currentUser?.id)
                    .map((m) => (
                      <option key={m.id} value={m.nickname || m.full_name || m.username || 'Member'}>
                        👤 {m.nickname || m.full_name || m.username || 'Member'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddEventOpen(false)}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#BCAAA4]"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#4E342E] text-white rounded-[14px] text-[13px] font-semibold hover:opacity-95 disabled:opacity-50"
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
