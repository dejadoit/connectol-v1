'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProjectAction } from '@/app/(app)/actions';

export default function CreateProjectModal({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorStr, setErrorStr] = useState("");

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("medium");
  const [repoStr, setRepoStr] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStr("");
    setIsSubmitting(true);
    
    try {
      const res = await createProjectAction({
        name,
        description: desc,
        priority,
        repo_url: repoStr
      });
      
      if (res.success) {
        onClose();
        // Reset form
        setName(""); setDesc(""); setPriority("medium"); setRepoStr("");
        // Redirect to new project dynamically
        router.push(`/projects/${res.projectId}`);
      }
    } catch (err: any) {
      setErrorStr(err.message || "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b bg-gray-50/50 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 tracking-tight">Create New Project</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold p-1">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Project Name <span className="text-red-500">*</span></label>
            <input 
              required
              autoFocus
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)}
              className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#466370] text-gray-800" 
              placeholder="e.g. Athena Payment Gateway" 
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea 
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#466370] text-gray-800 h-20 resize-none" 
              placeholder="Briefly describe the context of this architecture."
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
              <select 
                value={priority} 
                onChange={e => setPriority(e.target.value)}
                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#466370] text-gray-800 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Repository URL</label>
              <input 
                type="url" 
                value={repoStr}
                onChange={e => setRepoStr(e.target.value)}
                className="w-full border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-[#466370] text-gray-800 placeholder-gray-300"
                placeholder="https://github.com/..." 
              />
            </div>
          </div>

          {errorStr && <p className="text-red-600 bg-red-50 text-sm font-semibold p-3 border border-red-200 rounded">{errorStr}</p>}

          <div className="mt-4 flex justify-end gap-3 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-sm font-bold bg-[#466370] text-white rounded-lg shadow-sm hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                 <>
                   <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                   Provisioning Scaffold...
                 </>
              ) : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
