'use client';

import { useState, useTransition } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createApiKey } from './actions';

export default function KeysClient({ project, initialKeys }: any) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // New Key Form State
  const [name, setName] = useState('');
  const [agentName, setAgentName] = useState('');
  const [canPromote, setCanPromote] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setNewlyCreatedKey(null);

    try {
       const res = await createApiKey({
         org_id: project.org_id,
         name,
         agent_name: agentName,
         allowed_project_ids: [project.id], // Allows explicit mult-project scopes structurally, but we root creation in the active project view
         can_promote: canPromote
       });

       setKeys([res.keyRecord, ...keys]);
       setNewlyCreatedKey(res.rawKey);
       setIsCreating(false);
       setName('');
       setAgentName('');
       setCanPromote(false);
    } catch (err: any) {
       alert(err.message);
    } finally {
       setIsLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to completely revoke this key? This terminates all connected agent integrations instantly.")) return;
    
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
    <div className="flex flex-col h-full bg-[#f8f9fa] min-h-[calc(100vh-3.5rem)]">
      {/* Structural Header */}
      <div className="bg-white px-8 py-5 border-b shrink-0 flex items-center justify-between">
         <div className="flex items-center gap-4">
           <h2 className="text-xl font-bold text-[#5f5e5e] leading-none">API Key Access Configuration</h2>
           <span className="px-2 py-1 bg-gray-100 text-[10px] uppercase font-bold text-gray-500 rounded border">Project: {project.name}</span>
         </div>
         <div className="flex gap-4">
           <Link href={`/projects/${project.id}`} className="text-sm font-semibold text-gray-600 hover:text-gray-900 border px-3 py-1.5 rounded transition-colors bg-white">
             Back to Project View
           </Link>
           {!isCreating && (
             <button onClick={() => { setIsCreating(true); setNewlyCreatedKey(null); }} className="text-sm font-bold bg-[#466370] text-white px-4 py-1.5 rounded hover:bg-opacity-90 shadow-sm transition-opacity">
               Generate New Key
             </button>
           )}
         </div>
      </div>

      <div className="p-8 max-w-5xl mx-auto w-full">

        {newlyCreatedKey && (
          <div className="bg-green-50 border border-green-200 text-green-900 p-6 rounded-lg mb-8 shadow-sm">
             <h3 className="font-bold text-lg mb-2">Key Generated Successfully</h3>
             <p className="text-sm mb-4">Please securely copy this token now. You will never be able to see it again natively inside the platform natively after leaving this page.</p>
             <code className="block w-full bg-white border border-green-200 p-4 rounded text-lg font-mono tracking-wide">{newlyCreatedKey}</code>
          </div>
        )}

        {isCreating && (
          <form onSubmit={handleCreate} className="bg-white border p-6 rounded-lg shadow-sm mb-8">
             <h3 className="font-bold text-lg text-gray-800 mb-4">Generate Agent Access Key</h3>
             
             <div className="grid grid-cols-2 gap-6 mb-6">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Key Configuration Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VS Code Plugin Terminal" className="w-full border p-2 rounded text-sm bg-gray-50" />
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Agent / Identity String</label>
                  <input type="text" required value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="e.g. claude-3-sonnet" className="w-full border p-2 rounded text-sm bg-gray-50" />
               </div>
             </div>

             <div className="bg-gray-50 p-4 rounded border mb-6 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-gray-800">Allow Direct Promotion</h4>
                  <p className="text-xs text-gray-500">Bypass the human UI explicitly to allow the agent atomic truth patch hooks.</p>
                </div>
                <label className="cursor-pointer">
                   <input type="checkbox" checked={canPromote} onChange={e => setCanPromote(e.target.checked)} className="w-5 h-5" />
                </label>
             </div>

             <div className="flex justify-end gap-3">
               <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
               <button type="submit" disabled={isLoading} className="px-6 py-2 text-sm font-bold bg-[#466370] text-white rounded hover:bg-opacity-90">Generate Token</button>
             </div>
          </form>
        )}

        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
           <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b text-xs uppercase font-bold text-gray-500 tracking-wider">
                <tr>
                  <th className="p-4 w-1/3">Key Registration Identity</th>
                  <th className="p-4">Authorization Token</th>
                  <th className="p-4">Privileges</th>
                  <th className="p-4">Last Authorized</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {keys.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-400">Zero active API hooks provisioned.</td></tr>
                )}
                {keys.map((k: any) => (
                  <tr key={k.id} className={`${k.revoked_at ? 'bg-red-50/30 grayscale opacity-70' : 'hover:bg-gray-50'} transition-colors`}>
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{k.name}</div>
                      <div className="text-xs font-mono text-gray-500 mt-0.5 tracking-tighter">{k.agent_name}</div>
                    </td>
                    <td className="p-4">
                      <code className={`font-mono text-xs px-2 py-1 rounded border ${k.revoked_at ? 'bg-red-100 border-red-200 text-red-600' : 'bg-gray-100 border-gray-200 text-gray-600'}`}>
                        {maskKey(k.key_hash)}
                      </code>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1 flex-wrap">
                         <span className="text-[9px] bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase">Read</span>
                         <span className="text-[9px] bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">Write Workspace</span>
                         {k.can_promote && <span className="text-[9px] bg-purple-50 border border-purple-200 text-purple-700 px-1.5 py-0.5 rounded font-bold uppercase">Promote Truth</span>}
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono text-gray-500">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="p-4 text-right">
                       {!k.revoked_at ? (
                         <button disabled={isLoading} onClick={() => handleRevoke(k.id)} className="text-xs font-bold text-red-600 hover:text-white hover:bg-red-600 px-3 py-1.5 rounded border border-transparent transition-colors">
                           Revoke Key
                         </button>
                       ) : (
                         <span className="text-xs font-bold text-red-500 bg-white px-2 py-1 rounded uppercase tracking-wider">Revoked</span>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      </div>
    </div>
  );
}
