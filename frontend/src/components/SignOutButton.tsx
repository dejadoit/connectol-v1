'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <button 
      onClick={handleSignOut} 
      className="text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
    >
      Sign out
    </button>
  );
}
