'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  PawPrint, 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Check, 
  X,
  Activity,
  Scissors,
  Camera,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { 
  fetchPets, 
  createPet, 
  deletePet, 
  fetchPetLogs, 
  createPetLog, 
  togglePetLog,
  type DbPet, 
  type DbPetLog,
  type DbProfile
} from '@/lib/services/db';
import { uploadPetPhoto } from '@/lib/services/storage';
import { useLanguage } from '@/lib/i18n/language-context';
import { LanguageToggle } from '@/components/ui/language-toggle';

export default function PetsPage() {
  const { t, language } = useLanguage();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<DbProfile | null>(null);
  const [pets, setPets] = useState<DbPet[]>([]);
  const [petLogs, setPetLogs] = useState<DbPetLog[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'vaccines' | 'grooming'>('vaccines');

  // Add Pet Form
  const [isAddPetModalOpen, setIsAddPetModalOpen] = useState(false);
  const [newPetName, setNewPetName] = useState('');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [newPetGender, setNewPetGender] = useState<'male' | 'female'>('male');
  const [petPhotoFile, setPetPhotoFile] = useState<File | null>(null);
  const [petPhotoPreview, setPetPhotoPreview] = useState<string | null>(null);
  const petFileInputRef = useRef<HTMLInputElement>(null);
  const [submittingPet, setSubmittingPet] = useState(false);

  // Add Log Form
  const [isAddLogModalOpen, setIsAddLogModalOpen] = useState(false);
  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogDate, setNewLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingLog, setSubmittingLog] = useState(false);

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
          const dbPets = await fetchPets(profile.household_id);
          setPets(dbPets);
          if (dbPets.length > 0 && !selectedPetId) {
            setSelectedPetId(dbPets[0].id);
          }

          const dbLogs = await fetchPetLogs(profile.household_id);
          setPetLogs(dbLogs);
        }
      }
    } catch (err) {
      console.error('Failed to load pets data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const currentPet = pets.find((p) => p.id === selectedPetId) || pets[0];

  const currentPetLogs = petLogs.filter((r) => {
    if (!currentPet) return false;
    const matchesPet = r.pet_id === currentPet.id;
    const matchesTab = activeTab === 'vaccines' 
      ? (r.log_type === 'vaccine' || r.log_type === 'vet') 
      : r.log_type === 'grooming';
    return matchesPet && matchesTab;
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPetPhotoFile(file);
      const preview = URL.createObjectURL(file);
      setPetPhotoPreview(preview);
    }
  };

  const handleCreatePet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPetName.trim()) return;

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
      setSubmittingPet(true);
      let photoUrl: string | null = null;

      if (petPhotoFile) {
        const tempId = `pet-${Date.now()}`;
        photoUrl = await uploadPetPhoto(petPhotoFile, tempId);
      }

      const created = await createPet(userObj.household_id, {
        name: newPetName.trim(),
        breed: newPetBreed.trim() || undefined,
        gender: newPetGender,
        photo_url: photoUrl || undefined,
      });

      setPets((prev) => [...prev, created]);
      setSelectedPetId(created.id);
      setNewPetName('');
      setNewPetBreed('');
      setPetPhotoFile(null);
      setPetPhotoPreview(null);
      setIsAddPetModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'บันทึกสัตว์เลี้ยงไม่สำเร็จ');
    } finally {
      setSubmittingPet(false);
    }
  };

  const handleDeletePet = async (petId: string) => {
    if (!confirm(language === 'th' ? 'ต้องการลบสัตว์เลี้ยงนี้หรือไม่?' : 'Delete this pet?')) return;
    try {
      await deletePet(petId);
      const updated = pets.filter((p) => p.id !== petId);
      setPets(updated);
      if (selectedPetId === petId) {
        setSelectedPetId(updated.length > 0 ? updated[0].id : null);
      }
    } catch (err: any) {
      alert(err.message || 'ลบสัตว์เลี้ยงไม่สำเร็จ');
    }
  };

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPet || !newLogTitle.trim()) return;

    try {
      setSubmittingLog(true);
      const scheduledDate = newLogDate.trim() || new Date().toISOString().split('T')[0];
      const created = await createPetLog({
        pet_id: currentPet.id,
        log_type: activeTab === 'vaccines' ? 'vaccine' : 'grooming',
        title: newLogTitle.trim(),
        scheduled_date: scheduledDate,
      });

      setPetLogs((prev) => [...prev, created]);
      setNewLogTitle('');
      setNewLogDate(new Date().toISOString().split('T')[0]);
      setIsAddLogModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'บันทึกบันทึกดูแลไม่สำเร็จ');
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleToggleLog = async (logId: string, currentDone: boolean) => {
    try {
      await togglePetLog(logId, !currentDone);
      setPetLogs((prev) =>
        prev.map((l) => (l.id === logId ? { ...l, is_done: !currentDone } : l))
      );
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FDFBF7] dark:bg-[#1F1511] select-none max-w-[420px] mx-auto pb-28 transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-row justify-between items-center px-6 pt-5 pb-2 w-full">
        <div>
          <h1 className="font-outfit font-bold text-[24px] leading-[30px] text-[#5D4037] dark:text-[#F5EBE6]">
            {t.pets.title}
          </h1>
          <p className="font-dm-sans text-[13px] leading-[18px] text-[#8D6E63] dark:text-[#BCAAA4] mt-0.5">
            {language === 'th' ? 'ดูแลสัตว์เลี้ยง อัพเดตรูปและตารางวัคซีน/กรูมมิ่ง' : 'Manage pets, photos, and care schedules'}
          </p>
        </div>
        <LanguageToggle />
      </div>

      {loading ? (
        <div className="flex-1 flex justify-center items-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#8D6E63]" />
        </div>
      ) : pets.length === 0 ? (
        <div className="px-6 mt-6">
          <div className="flex flex-col items-center justify-center p-8 bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[24px] text-center">
            <div className="w-16 h-16 rounded-full bg-[#FFE0B2] dark:bg-[#3E2723] flex items-center justify-center text-[#E65100] mb-3">
              <PawPrint className="w-8 h-8 stroke-[#E65100]" strokeWidth={2.2} />
            </div>
            <h3 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#F5EBE6] mb-1">
              {t.pets.emptyPets}
            </h3>
            <p className="font-dm-sans text-[13px] text-[#8D6E63] dark:text-[#BCAAA4] max-w-[240px] mb-4">
              {t.pets.emptyPetsPrompt}
            </p>
            <button
              type="button"
              onClick={() => setIsAddPetModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#5D4037] dark:bg-[#4E342E] text-white rounded-[16px] text-[13px] font-semibold hover:opacity-95 shadow-xs"
            >
              <Plus className="w-4 h-4 stroke-white" strokeWidth={2.5} />
              {t.pets.addPet}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Pet Switcher Tabs */}
          <div className="px-6 py-2">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {pets.map((pet) => {
                const isSelected = (currentPet?.id) === pet.id;

                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => setSelectedPetId(pet.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-full border transition-all shrink-0 ${
                      isSelected
                        ? 'bg-[#5D4037] text-white border-[#5D4037] shadow-xs'
                        : 'bg-[#F4EFEA] dark:bg-[#2D1E18] border-[#D7CCC8] dark:border-[#4E342E] text-[#8D6E63] dark:text-[#BCAAA4] hover:text-[#5D4037]'
                    }`}
                  >
                    {pet.photo_url ? (
                      <div className="w-5 h-5 rounded-full overflow-hidden shrink-0 relative">
                        <Image src={pet.photo_url} alt={pet.name} fill className="object-cover" />
                      </div>
                    ) : (
                      <PawPrint className={`w-3.5 h-3.5 ${isSelected ? 'stroke-white' : 'stroke-[#8D6E63]'}`} />
                    )}
                    <span className="font-outfit font-bold text-[13px]">
                      {pet.name}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsAddPetModalOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] text-[#8D6E63] dark:text-[#BCAAA4] hover:text-[#5D4037] shrink-0"
                title={t.pets.addPet}
              >
                <Plus className="w-4 h-4 stroke-current" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {currentPet && (
            <div className="px-6 space-y-4 mt-2">
              {/* Pet Info Card with Photo */}
              <div className="p-4 bg-white dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[22px] shadow-[0px_4px_16px_rgba(93,64,55,0.03)] flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-[20px] overflow-hidden bg-[#FFE0B2] dark:bg-[#3E2723] flex items-center justify-center text-[#E65100] relative shrink-0 border-2 border-white dark:border-[#5D4037] shadow-xs">
                    {currentPet.photo_url ? (
                      <Image 
                        src={currentPet.photo_url} 
                        alt={currentPet.name} 
                        fill 
                        className="object-cover"
                      />
                    ) : (
                      <PawPrint className="w-7 h-7 stroke-[#E65100]" strokeWidth={2.2} />
                    )}
                  </div>
                  <div>
                    <h2 className="font-outfit font-bold text-[19px] text-[#5D4037] dark:text-[#F5EBE6]">
                      {currentPet.name}
                    </h2>
                    <p className="font-dm-sans text-[12px] text-[#8D6E63] dark:text-[#BCAAA4]">
                      {currentPet.breed || (language === 'th' ? 'เพื่อนร่วมบ้าน' : 'Companion')} • {currentPet.gender === 'male' ? t.pets.male : t.pets.female}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeletePet(currentPet.id)}
                  title={t.common.delete}
                  className="p-2 text-[#8D6E63] hover:text-red-500 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4 stroke-current" />
                </button>
              </div>

              {/* Tab Selector: Vaccines vs Grooming */}
              <div className="flex p-1 bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[16px]">
                <button
                  type="button"
                  onClick={() => setActiveTab('vaccines')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[12px] text-[12px] font-semibold transition-all ${
                    activeTab === 'vaccines'
                      ? 'bg-white dark:bg-[#4E342E] text-[#5D4037] dark:text-[#F5EBE6] shadow-xs'
                      : 'text-[#8D6E63] dark:text-[#BCAAA4] hover:text-[#5D4037]'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5 stroke-current" />
                  {t.pets.vaccinesTab}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('grooming')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[12px] text-[12px] font-semibold transition-all ${
                    activeTab === 'grooming'
                      ? 'bg-white dark:bg-[#4E342E] text-[#5D4037] dark:text-[#F5EBE6] shadow-xs'
                      : 'text-[#8D6E63] dark:text-[#BCAAA4] hover:text-[#5D4037]'
                  }`}
                >
                  <Scissors className="w-3.5 h-3.5 stroke-current" />
                  {t.pets.groomingTab}
                </button>
              </div>

              {/* Care Logs List */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center px-1">
                  <span className="font-outfit font-bold text-[14px] text-[#5D4037] dark:text-[#F5EBE6]">
                    {activeTab === 'vaccines' ? t.pets.vaccinesTab : t.pets.groomingTab}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddLogModalOpen(true)}
                    className="text-[12px] font-semibold text-[#2E7D32] dark:text-[#81C784] hover:underline"
                  >
                    + {t.pets.addLog}
                  </button>
                </div>

                {currentPetLogs.length === 0 ? (
                  <div className="p-6 bg-[#F4EFEA] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[18px] text-center">
                    <p className="font-dm-sans text-[13px] text-[#8D6E63] dark:text-[#BCAAA4] mb-3">
                      {t.pets.emptyLogs}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddLogModalOpen(true)}
                      className="px-4 py-1.5 bg-[#5D4037] dark:bg-[#4E342E] text-white text-[12px] font-semibold rounded-[12px] shadow-xs"
                    >
                      + {t.pets.addLog}
                    </button>
                  </div>
                ) : (
                  currentPetLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3.5 bg-white dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[18px] shadow-[0px_2px_8px_rgba(93,64,55,0.02)]"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleToggleLog(log.id, log.is_done)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            log.is_done 
                              ? 'bg-[#2E7D32] text-white' 
                              : 'bg-[#F4EFEA] dark:bg-[#1F1511] text-[#5D4037] dark:text-[#D7CCC8]'
                          }`}
                        >
                          {log.is_done ? (
                            <Check className="w-4 h-4 stroke-current stroke-[3]" />
                          ) : (
                            <CalendarIcon className="w-4 h-4 stroke-current" />
                          )}
                        </button>
                        <div>
                          <div className={`font-dm-sans font-medium text-[14px] ${
                            log.is_done ? 'line-through text-[#8D6E63] dark:text-[#8D6E63]' : 'text-[#5D4037] dark:text-[#F5EBE6]'
                          }`}>
                            {log.title}
                          </div>
                          <div className="font-dm-sans text-[11px] text-[#8D6E63] dark:text-[#BCAAA4]">
                            {log.scheduled_date}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Add Pet Modal with Photo Upload */}
      {isAddPetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFBF7] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] w-full max-w-[360px] rounded-[24px] p-5 shadow-xl max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#F5EBE6]">
                {t.pets.addPet}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddPetModalOpen(false)}
                className="p-1 text-[#8D6E63] dark:text-[#BCAAA4] hover:text-[#5D4037]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePet} className="space-y-3.5">
              {/* Photo Upload Preview */}
              <div className="flex flex-col items-center justify-center">
                <input
                  ref={petFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => petFileInputRef.current?.click()}
                  className="relative group w-20 h-20 rounded-[22px] bg-[#F4EFEA] dark:bg-[#1F1511] border-2 border-dashed border-[#D7CCC8] dark:border-[#4E342E] overflow-hidden flex flex-col items-center justify-center hover:border-[#5D4037] transition-colors"
                >
                  {petPhotoPreview ? (
                    <Image src={petPhotoPreview} alt="Pet Preview" fill className="object-cover" />
                  ) : (
                    <>
                      <Camera className="w-6 h-6 text-[#8D6E63] dark:text-[#BCAAA4] mb-1" />
                      <span className="text-[10px] text-[#8D6E63] dark:text-[#BCAAA4]">
                        {language === 'th' ? 'เพิ่มรูป' : 'Photo'}
                      </span>
                    </>
                  )}
                </button>
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                  {t.pets.petNamePlaceholder}
                </label>
                <input
                  type="text"
                  required
                  value={newPetName}
                  onChange={(e) => setNewPetName(e.target.value)}
                  placeholder={t.pets.petNamePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                  {t.pets.breedPlaceholder}
                </label>
                <input
                  type="text"
                  value={newPetBreed}
                  onChange={(e) => setNewPetBreed(e.target.value)}
                  placeholder={t.pets.breedPlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                  {t.pets.gender}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewPetGender('male')}
                    className={`py-2 rounded-[12px] text-[13px] font-medium border transition-colors ${
                      newPetGender === 'male'
                        ? 'bg-[#5D4037] dark:bg-[#4E342E] text-white border-[#5D4037]'
                        : 'bg-[#F4EFEA] dark:bg-[#1F1511] text-[#8D6E63] dark:text-[#BCAAA4] border-[#D7CCC8] dark:border-[#4E342E]'
                    }`}
                  >
                    {t.pets.male}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewPetGender('female')}
                    className={`py-2 rounded-[12px] text-[13px] font-medium border transition-colors ${
                      newPetGender === 'female'
                        ? 'bg-[#5D4037] dark:bg-[#4E342E] text-white border-[#5D4037]'
                        : 'bg-[#F4EFEA] dark:bg-[#1F1511] text-[#8D6E63] dark:text-[#BCAAA4] border-[#D7CCC8] dark:border-[#4E342E]'
                    }`}
                  >
                    {t.pets.female}
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddPetModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#BCAAA4]"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submittingPet}
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#4E342E] text-white rounded-[14px] text-[13px] font-semibold hover:opacity-95 disabled:opacity-50"
                >
                  {submittingPet ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : t.common.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Log Modal */}
      {isAddLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FDFBF7] dark:bg-[#2D1E18] border border-[#D7CCC8] dark:border-[#4E342E] w-full max-w-[360px] rounded-[24px] p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-outfit font-bold text-[18px] text-[#5D4037] dark:text-[#F5EBE6]">
                {t.pets.addLog}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddLogModalOpen(false)}
                className="p-1 text-[#8D6E63] dark:text-[#BCAAA4] hover:text-[#5D4037]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLog} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                  {t.pets.logTitlePlaceholder}
                </label>
                <input
                  type="text"
                  required
                  value={newLogTitle}
                  onChange={(e) => setNewLogTitle(e.target.value)}
                  placeholder={t.pets.logTitlePlaceholder}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] placeholder-[#8D6E63]/60 focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#8D6E63] dark:text-[#BCAAA4] mb-1">
                  {t.pets.datePlaceholder}
                </label>
                <input
                  type="date"
                  required
                  value={newLogDate}
                  onChange={(e) => setNewLogDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[14px] text-[#5D4037] dark:text-[#F5EBE6] focus:outline-none focus:border-[#5D4037]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddLogModalOpen(false)}
                  className="flex-1 py-2.5 bg-[#F4EFEA] dark:bg-[#1F1511] border border-[#D7CCC8] dark:border-[#4E342E] rounded-[14px] text-[13px] font-medium text-[#8D6E63] dark:text-[#BCAAA4]"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submittingLog}
                  className="flex-1 py-2.5 bg-[#5D4037] dark:bg-[#4E342E] text-white rounded-[14px] text-[13px] font-semibold hover:opacity-95 disabled:opacity-50"
                >
                  {submittingLog ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...') : t.common.add}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
