import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center min-h-screen bg-[#F0EBE1] select-none">
      <div className="relative flex flex-col w-full max-w-[402px] min-h-screen sm:min-h-[874px] bg-[#FDFBF7] shadow-[0_8px_30px_rgba(93,64,55,0.08)] overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
