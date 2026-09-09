import { createClient } from '@/lib/supabase/client';

/**
 * Upload user avatar to Supabase Storage ('avatars' bucket)
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const supabase = createClient();
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Avatar upload error:', uploadError);
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * Upload pet photo to Supabase Storage ('pet-photos' bucket)
 */
export async function uploadPetPhoto(file: File, petId?: string): Promise<string> {
  const supabase = createClient();
  const fileExt = file.name.split('.').pop() || 'jpg';
  const prefix = petId || 'new';
  const fileName = `${prefix}/pet-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('pet-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Pet photo upload error:', uploadError);
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from('pet-photos').getPublicUrl(fileName);
  return data.publicUrl;
}

/**
 * Upload transfer slip to Supabase Storage ('transfer-slips' bucket)
 */
export async function uploadTransferSlip(file: File, financeId: string): Promise<string> {
  const supabase = createClient();
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${financeId}/slip-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('transfer-slips')
    .upload(fileName, file, {
      cacheControl: '86400',
      upsert: true,
    });

  if (uploadError) {
    console.error('Slip upload error:', uploadError);
    throw new Error(uploadError.message);
  }

  const { data } = supabase.storage.from('transfer-slips').getPublicUrl(fileName);
  return data.publicUrl;
}
