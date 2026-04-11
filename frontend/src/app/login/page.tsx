'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (authError) {
      setError(authError.message);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f8f9fa] text-[#5f5e5e]">
      <form onSubmit={handleLogin} className="flex flex-col gap-4 p-8 bg-white shadow-sm border border-gray-200 rounded-md w-full max-w-sm">
        <h1 className="text-2xl font-semibold mb-2">Connectol Operator</h1>
        {error && <div className="text-red-500 text-sm">{error}</div>}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="border p-2 rounded" required />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="border p-2 rounded" required />
        </div>
        <button type="submit" className="mt-4 bg-[#466370] text-white p-2 rounded font-medium hover:bg-opacity-90">Sign In</button>
      </form>
    </div>
  );
}
