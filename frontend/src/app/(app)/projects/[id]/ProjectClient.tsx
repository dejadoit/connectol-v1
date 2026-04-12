'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import PromotionView from './PromotionView';

export default function ProjectClient({ project, docs, workspaceEntries }: any) {
  const router = useRouter();
  const [activeDocId, setActiveDocId] = useState(docs[0]?.id);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);

  const activeDoc = docs.find((d: any) => d.id === activeDocId);
  const selectedEntry = workspaceEntries.find((we: any) => we.id === selectedEntryId);

  // Filter cleanly separating active pipelines from explicitly rejected proposals
  const activeEntries = workspaceEntries.filter((we: any) => we.status !== 'rejected');
  const rejectedEntries = workspaceEntries.filter((we: any) => we.status === 'rejected');
  
  const displayEntries = showRejected ? [...activeEntries, ...rejectedEntries] : activeEntries;

  const handleSaveDoc = async () => {
    if (!activeDoc || !editContent.trim()) return;
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/connectol/projects/${project.id}/docs/${activeDoc.id}`, {
        method: 'PATCH',
        headers: {
           Authorization: `Bearer ${session?.access_token}`,
           'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
           content: editContent,
           change_summary: 'Manual operator overlay update'
        })
      });
      
      if (!res.ok) {
         const err = await res.json();
         throw new Error(err.error || 'Failed to update canonical document');
      }
      
      setIsEditing(false);
      router.refresh(); // Hard reload SSR layer to reflect new sync properties
    } catch (err) {
      console.error(err);
      alert(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedEntryId && selectedEntry) {
    return (
      <PromotionView 
         project={project} 
         entry={selectedEntry} 
         docs={docs} 
         onBack={() => setSelectedEntryId(null)} 
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] min-h-[calc(100vh-3.5rem)]">
       {/* Project Header Pane */}
       <div className="bg-white px-8 py-5 border-b shrink-0 flex items-center justify-between">
         <div className="flex items-center gap-4">
           <h2 className="text-2xl font-bold text-[#5f5e5e] leading-none">{project.name}</h2>
           <span className="px-2 py-1 bg-gray-100 border border-gray-200 text-[10px] uppercase tracking-wider rounded text-gray-500 font-bold">{project.status}</span>
           <span className="px-2 py-1 bg-[#466370] text-[10px] uppercase tracking-wider rounded border border-[#466370] text-white font-bold">{project.priority}</span>
         </div>
         <div className="flex items-center gap-4">
           {project.repo_url && (
             <a href={project.repo_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
               Code Repository
             </a>
           )}
           <button onClick={() => router.push(`/projects/${project.id}/keys`)} className="text-sm font-semibold bg-gray-100 text-gray-700 border hover:bg-gray-200 transition-colors px-3 py-1.5 rounded">
             Settings & API Keys
           </button>
         </div>
       </div>

       <div className="bg-blue-50 border-b px-8 py-2 text-xs text-blue-800 flex items-center justify-center shrink-0">
         <span className="font-semibold mr-1">How it works:</span> Left side = official Canonical Truth. Right side = incoming AI/human Workspace Inbox. Review and promote useful items into truth.
       </div>

       <div className="flex flex-1 overflow-hidden">
          {/* Canonical Truth Context Pane */}
          <div className="flex-1 flex flex-col border-r bg-white overflow-hidden">
             
             {/* Doc Type Horizontal Tab Array */}
             <div className="flex border-b overflow-x-auto shrink-0 custom-scrollbar">
                {docs.length === 0 && <div className="px-4 py-3 text-sm text-gray-400">No truth documents exist</div>}
                {docs.map((doc: any) => (
                  <button 
                    key={doc.id}
                    onClick={() => setActiveDocId(doc.id)}
                    className={`px-5 py-3 whitespace-nowrap text-sm font-semibold border-b-2 transition-colors focus:outline-none ${activeDocId === doc.id ? 'border-[#466370] text-[#466370]' : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'}`}
                  >
                    {doc.doc_type.replace('_', ' ')}
                  </button>
                ))}
             </div>
             
             {/* Rendered Live Markdown View */}
             <div className="flex-1 overflow-auto p-8 text-[#5f5e5e]">
                {activeDoc ? (
                   <div className="max-w-4xl flex flex-col h-full relative">
                     <div className="flex justify-between items-center mb-6">
                        <h3 className="text-2xl font-bold text-gray-800">{activeDoc.title}</h3>
                        {!isEditing ? (
                          <button onClick={() => { setEditContent(activeDoc.content); setIsEditing(true); }} className="text-sm font-semibold bg-[#f8f9fa] border px-3 py-1.5 rounded hover:bg-gray-100 transition-colors">
                            Edit Document
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-1.5">
                               Cancel
                            </button>
                            <button onClick={handleSaveDoc} disabled={isLoading} className="text-sm font-semibold bg-[#466370] text-white border px-3 py-1.5 rounded hover:bg-opacity-90 transition-colors disabled:opacity-50">
                               {isLoading ? 'Saving...' : 'Save Truth'}
                            </button>
                          </div>
                        )}
                     </div>

                     {isEditing ? (
                       <div className="flex-1 flex flex-col min-h-0 border rounded overflow-hidden shadow-sm">
                           <textarea 
                             className="flex-1 w-full bg-gray-50 p-4 font-mono text-sm leading-relaxed outline-none resize-none" 
                             value={editContent} 
                             onChange={(e) => setEditContent(e.target.value)} 
                           />
                       </div>
                     ) : (
                       <div className="prose prose-slate max-w-none prose-headings:font-medium font-sans whitespace-pre-wrap leading-relaxed">{activeDoc.content}</div>
                     )}

                     {!isEditing && (
                       <div className="mt-12 pt-5 border-t text-xs font-mono text-gray-400 flex justify-between items-center bg-gray-50/50 -mx-8 -mb-8 px-8 py-4 mt-auto">
                        <span>Version {activeDoc.version}</span>
                        <span>
                           Last synchronized via {activeDoc.last_updated_by_label} 
                           <span className="ml-1 uppercase text-[10px] bg-gray-200 text-gray-500 px-1 py-[2px] rounded border">
                              {activeDoc.last_updated_by_type}
                           </span>
                        </span>
                        <span>{new Date(activeDoc.updated_at).toLocaleString()}</span>
                     </div>
                     )}
                   </div>
                ) : (
                   <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <p className="mb-2">Canonical Truth is empty.</p>
                      <p className="text-sm">Human operators may write truth blocks to kickstart alignment.</p>
                   </div>
                )}
             </div>
          </div>

          {/* Workspace Entries Sidebar View */}
          <div className="w-[450px] shrink-0 flex flex-col bg-[#f8f9fa] border-l border-white shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.05)]">
             <div className="px-6 py-4 border-b bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                   <h3 className="font-bold text-sm text-gray-700 uppercase tracking-wide">Workspace Inbox</h3>
                   <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-bold">{activeEntries.length} Live</span>
                </div>
                {rejectedEntries.length > 0 && (
                   <button onClick={() => setShowRejected(!showRejected)} className="text-[10px] uppercase font-bold text-gray-500 hover:bg-gray-100 px-2 py-1 flex items-center gap-1 rounded bg-gray-50 border border-gray-200 transition-colors">
                     {showRejected ? 'Hide' : 'Show'} {rejectedEntries.length} Rejected
                   </button>
                )}
             </div>
             
             <div className="flex-1 overflow-auto p-4 space-y-4">
               {displayEntries.length === 0 && (
                 <div className="text-center text-sm text-gray-500 bg-white border border-dashed rounded-lg p-5 mt-4 mx-2">
                    <p className="font-semibold text-gray-700 mb-2">Workspace Inbox is currently empty.</p>
                    <p className="text-xs leading-relaxed">When human operators or AI agents write drafts, suggestions, or experiments, they will appear here waiting for your review. Promote them to move useful work into the Canonical Truth.</p>
                 </div>
               )}
               {displayEntries.map((entry: any) => (
                  <div key={entry.id} className={`bg-white border rounded-lg shadow-sm p-5 flex flex-col gap-2 transition-all hover:shadow hover:border-gray-300 ${entry.status === 'rejected' ? 'opacity-60 grayscale bg-gray-50' : ''}`}>
                     <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${entry.created_by_type === 'agent' ? 'bg-[#466370]' : 'bg-green-500'}`} />
                           <span className="font-bold text-sm text-gray-800">{entry.created_by_label}</span>
                           {entry.created_by_type === 'agent' && (
                             <span className="text-[9px] uppercase font-bold text-[#466370] bg-blue-50 px-1 py-0.5 rounded border border-blue-100">{entry.agent_name}</span>
                           )}
                        </div>
                        <span className="text-[10px] font-mono text-gray-400">{new Date(entry.created_at).toLocaleDateString()}</span>
                     </div>
                     
                     <h4 className="font-semibold text-gray-900 leading-tight">{entry.title}</h4>
                     <p className="text-sm text-gray-600 line-clamp-4 whitespace-pre-wrap leading-relaxed bg-gray-50/50 rounded mt-1 p-2 border border-transparent hover:border-gray-100">{entry.content}</p>
                     
                     <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 font-mono text-[9px] text-gray-500 uppercase font-semibold">
                        <div className="flex items-center gap-1.5">
                           <span className={entry.confidence === 'high' ? 'text-green-600' : entry.confidence === 'medium' ? 'text-blue-600' : 'text-orange-500'}>
                              {entry.confidence} CONFIDENCE
                           </span>
                        </div>
                        <div className="flex gap-1.5">
                          {entry.status === 'rejected' && <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 font-bold">REJECTED</span>}
                          <div className="bg-gray-100 px-1.5 py-0.5 rounded">{entry.entry_type}</div>
                        </div>
                     </div>
                     
                     {entry.status !== 'rejected' && entry.status !== 'promoted' && (
                       <div className="mt-2 text-right">
                         <button onClick={() => setSelectedEntryId(entry.id)} className="text-xs bg-[#466370] text-white px-3 py-1.5 rounded hover:bg-opacity-90 font-bold tracking-wide shadow-sm">
                           Review & Promote
                         </button>
                       </div>
                     )}
                  </div>
               ))}
             </div>
             
             {/* Bottom interaction block for V2/Promote hooks */}
             <div className="p-4 bg-white border-t text-center text-xs text-gray-500 shrink-0">
               Select entry to view & promote
             </div>
          </div>
       </div>
    </div>
  );
}
