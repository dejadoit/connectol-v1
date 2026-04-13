'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { createPat } from './actions';

export default function PatClient({ initialKeys, userId, orgId }: any) {
  const [keys, setKeys] = useState(initialKeys);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [name, setName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNewlyCreatedKey(null);

    try {
       const res = await createPat({
         org_id: orgId,
         user_id: userId,
         name: name || 'Extension Access'
       });

       setKeys([res.keyRecord, ...keys]);
       setNewlyCreatedKey(res.rawKey);
       setIsCreating(false);
       setName('');
    } catch (err: any) {
       alert(err.message);
    } finally {
       setIsLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Warning: Revoking this active Personal Access Token will immediately disable any extension or client relying on it. Do you wish to continue?")) return;
    
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('api_keys').update({
        revoked_at: new Date().toISOString()
      }).eq('id', id);

      if (error) throw error;
      
      setKeys(keys.map((k: any) => k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const maskKey = (hash: string) => {
     return `ct_••••••••••••••••${hash.slice(-4)}`;
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
         <div>
            <h2 className="text-xl font-bold text-gray-800">Personal Access Tokens</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              These keys grant complete top-level access to your account and <strong>ALL projects</strong> you are permitted to see. 
              Only use these tokens for trusted local clients like the Connectol Browser Extension. Treat them like your master password.
            </p>
         </div>
         {!isCreating && (
           <button onClick={() => { setIsCreating(true); setNewlyCreatedKey(null); }} className="text-sm font-bold bg-[#466370] text-white px-5 py-2 rounded shadow-sm hover:bg-opacity-90">
             Generate New Pattern
           </button>
         )}
      </div>

      {newlyCreatedKey && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-900 p-6 rounded-lg mb-8 shadow-sm">
           <h3 className="font-bold text-lg mb-2">High-Trust Token Generated</h3>
           <p className="text-sm mb-4">Please copy this token into your Extension Settings immediately. It will be permanently destroyed from view once you leave this page.</p>
           <code className="block w-full bg-white border border-yellow-300 p-4 rounded text-lg font-mono tracking-wide selection:bg-yellow-200">{newlyCreatedKey}</code>
        </div>
      )}

      {isCreating && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm mb-8">
           <h3 className="font-bold text-lg text-gray-800 mb-4">Generate Personal Access Token</h3>
           
           <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-1">Token Identifier</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Work Laptop Chrome Extension" className="w-1/2 border border-gray-300 p-2.5 rounded text-sm bg-gray-50 focus:border-blue-500 outline-none" />
              <p className="text-xs text-gray-400 mt-2">Helps you identify this token later if you need to revoke it.</p>
           </div>

           <div className="flex justify-end gap-3 mt-8">
             <button type="button" onClick={() => setIsCreating(false)} className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
             <button type="submit" disabled={isLoading} className="px-6 py-2 text-sm font-bold bg-[#466370] text-white rounded hover:bg-opacity-90 shadow-sm border border-transparent">Confirm Generation</button>
           </div>
        </form>
      )}

      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
         <table className="w-full text-left text-sm">
            <thead className="bg-[#f8f9fa] border-b text-xs uppercase font-bold text-gray-500 tracking-wider">
              <tr>
                <th className="p-4 w-1/3">Alias</th>
                <th className="p-4">Authorization Token</th>
                <th className="p-4">Created</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {keys.length === 0 && (
                <tr><td colSpan={4} className="p-10 text-center text-gray-500">You do not currently have any active Personal Access Tokens.</td></tr>
              )}
              {keys.map((k: any) => (
                <tr key={k.id} className={`${k.revoked_at ? 'bg-red-50/20 grayscale opacity-60' : 'hover:bg-gray-50'} transition-colors`}>
                  <td className="p-4">
                    <div className="font-bold text-gray-800">{k.name}</div>
                    <div className="text-[10px] font-mono text-gray-400 uppercase mt-1">Multi-Project Global Scope</div>
                  </td>
                  <td className="p-4 flex items-center h-full">
                    <code className={`font-mono text-xs px-2.5 py-1.5 rounded border ${k.revoked_at ? 'bg-red-100 border-red-200 text-red-600' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>
                      {maskKey(k.key_hash)}
                    </code>
                  </td>
                  <td className="p-4 text-xs font-mono text-gray-500">
                     {k.created_at ? new Date(k.created_at).toLocaleDateString() : 'Active'}
                  </td>
                  <td className="p-4 text-right">
                     {!k.revoked_at ? (
                       <button disabled={isLoading} onClick={() => handleRevoke(k.id)} className="text-xs font-bold text-red-600 hover:text-white hover:bg-red-600 px-3 py-1.5 rounded border border-transparent transition-colors">
                         Revoke Token
                       </button>
                     ) : (
                       <span className="text-[10px] font-bold text-red-500 bg-white px-2 py-1 rounded border border-red-100 uppercase tracking-wider">Revoked</span>
                     )}
                  </td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>
    </>
  );
}
