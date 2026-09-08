import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const cookieStore = await cookies();
  const hasSession = cookieStore.has('homie_session');
  
  if (!hasSession) {
    redirect('/login');
  }
  
  redirect('/dashboard');
}
