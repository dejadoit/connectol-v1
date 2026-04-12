'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CreateProjectModal from './CreateProjectModal';

export default function ProjectSwitcher({ projects = [] }: { projects: any[] }) {
  const pathname = usePathname();
  const router = useRouter();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine current context label
  const isDashboard = pathname === '/';
  const projectMatch = pathname.match(/\/projects\/([a-zA-Z0-9-]+)/);
  const activeProjectId = projectMatch ? projectMatch[1] : null;
  
  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null;
  const currentLabel = isDashboard ? 'Dashboard' : (activeProject?.name || 'Loading Project...');

  return (
    <>
      <div className="relative ml-4" ref={dropdownRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm font-semibold text-[#466370]"
        >
          {currentLabel}
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col">
            <div className="p-2 border-b bg-gray-50/50">
              <button 
                onClick={() => { setIsOpen(false); router.push('/'); }}
                className="w-full text-left px-3 py-2 text-sm font-semibold rounded hover:bg-gray-200 text-gray-700"
              >
                ← Return to Dashboard
              </button>
            </div>
            
            <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-1">
              <div className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 mt-1">Your Projects</div>
              {projects.length === 0 && <div className="px-3 py-2 text-xs text-gray-500 italic">No projects exist yet.</div>}
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setIsOpen(false); router.push(`/projects/${p.id}`); }}
                  className={`w-full text-left px-3 py-2 text-sm rounded ${p.id === activeProjectId ? 'bg-[#466370]/10 text-[#466370] font-bold' : 'text-gray-700 hover:bg-gray-100 font-medium'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <div className="p-2 border-t bg-gray-50/50">
              <button 
                onClick={() => { setIsOpen(false); setIsModalOpen(true); }}
                className="w-full text-left px-3 py-2 text-sm font-bold text-[#466370] rounded hover:bg-[#466370]/10 flex items-center gap-2"
              >
                <span className="text-lg leading-none">+</span> Create New Project
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
