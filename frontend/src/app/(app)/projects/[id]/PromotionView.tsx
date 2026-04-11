'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function PromotionView({ project, entry, docs, onBack }: any) {
  const router = useRouter();
  const [targetDocId, setTargetDocId] = useState(docs[0]?.id || '');
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [changeSummary, setChangeSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const targetDoc = docs.find((d: any) => d.id === targetDocId);

  const handlePromote = async () => {
    if (!targetDocId) return alert("Select a target document");
    if (!changeSummary.trim()) return alert("Change summary is required");
    
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/connectol/projects/${project.id}/promote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entry_id: entry.id,
          target_doc_id: targetDocId,
          mode,
          change_summary: changeSummary
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to promote entry');
      }
      
      router.refresh();
      onBack();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchiveOrReject = async (status: 'archived' | 'rejected') => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const updatePayload: any = { status };
      if (status === 'archived') {
         updatePayload.deleted_at = new Date().toISOString();
      }
      
      const { error } = await supabase.from('workspace_entries').update(updatePayload).eq('id', entry.id);

      if (error) throw error;
      
      router.refresh();
      onBack();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] relative">
      <div className="p-4 bg-white border-b flex justify-between items-center shadow-sm z-10">
        <h2 className="font-bold text-[#5f5e5e] text-lg">Promotion Review</h2>
        <button onClick={onBack} className="text-sm font-semibold text-gray-500 hover:text-gray-800">Cancel & Return</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Workspace Entry */}
        <div className="flex-1 flex flex-col border-r bg-white overflow-y-auto">
          <div className="p-6 bg-gray-50 border-b flex items-center justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-gray-500 mb-1 block">Workspace Entry</span>
              <h3 className="text-xl font-bold text-gray-900">{entry.title}</h3>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-[#466370]">{entry.created_by_label}</div>
              <div className={`text-xs uppercase font-bold px-2 py-0.5 mt-1 border rounded inline-block ${entry.confidence === 'high' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {entry.confidence} Confidence
              </div>
            </div>
          </div>
          <div className="p-6 font-mono text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
            {entry.content}
          </div>
        </div>

        {/* Right: Target Canonical Doc */}
        <div className="flex-1 flex flex-col bg-white overflow-y-auto shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)]">
           <div className="p-6 bg-[#f8f9fa] border-b">
             <span className="text-xs uppercase font-bold text-[#466370] mb-2 block">Target Canonical Truth</span>
             <select 
               value={targetDocId}
               onChange={(e) => setTargetDocId(e.target.value)}
               className="w-full border border-gray-300 rounded p-2 text-sm font-bold text-gray-800"
             >
               {docs.length === 0 && <option value="">No canonical documents exist</option>}
               {docs.map((d: any) => (
                 <option key={d.id} value={d.id}>{d.title} ({d.doc_type})</option>
               ))}
             </select>
             
             {targetDoc && (
                <div className="mt-3 flex gap-4 text-xs font-mono text-gray-500">
                   <span>v{targetDoc.version}</span>
                   <span>Last updated by {targetDoc.last_updated_by_label}</span>
                </div>
             )}
           </div>

           <div className="p-6 flex-1 opacity-60 pointer-events-none prose prose-slate max-w-none prose-headings:font-medium font-sans whitespace-pre-wrap leading-relaxed">
             {targetDoc ? targetDoc.content : <p className="text-gray-400 italic">Please select a target document or instruct agents to create truth blocks.</p>}
           </div>

           {/* Execution Controls Bottom Bar */}
           <div className="border-t bg-white p-6 sticky bottom-0">
             <div className="flex gap-4 mb-4">
               <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                 <input type="radio" checked={mode === 'append'} onChange={() => setMode('append')} />
                 Append
               </label>
               <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                 <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                 Replace
               </label>
             </div>
             <input 
               type="text" 
               placeholder="Change Summary (Required)" 
               value={changeSummary}
               onChange={(e) => setChangeSummary(e.target.value)}
               className="w-full border p-2 rounded text-sm mb-4" 
             />
             <div className="flex items-center justify-between">
                <div className="flex gap-2">
                   <button disabled={isLoading} onClick={() => handleArchiveOrReject('rejected')} className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded text-sm font-bold transition-colors">
                     Reject
                   </button>
                   <button disabled={isLoading} onClick={() => handleArchiveOrReject('archived')} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded text-sm font-bold transition-colors">
                     Archive silently
                   </button>
                </div>
                <button disabled={isLoading || !targetDoc} onClick={handlePromote} className="px-6 py-2 bg-[#466370] text-white hover:bg-opacity-90 rounded font-bold transition-opacity">
                  {isLoading ? 'Executing...' : 'Promote Truth'}
                </button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
