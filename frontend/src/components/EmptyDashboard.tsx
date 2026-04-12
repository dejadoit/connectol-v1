'use client';

import { useState } from 'react';
import CreateProjectModal from './CreateProjectModal';

export default function EmptyDashboard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center p-12 mt-12 bg-white rounded-xl border border-dashed text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Welcome to Connectol.</h2>
      
      <p className="text-gray-600 max-w-lg mb-8 leading-relaxed">
        Connectol is a multi-AI project memory hub. It strictly separates official project requirements (<span className="font-semibold text-gray-800">Canonical Truth</span>) from ongoing agent experiments and notes (<span className="font-semibold text-gray-800">Workspace Inbox</span>).
      </p>

      <button 
        onClick={() => setIsOpen(true)}
        className="bg-[#466370] text-white px-6 py-3 rounded-lg font-bold shadow hover:bg-opacity-90 transition-all text-sm"
      >
        Create your first project
      </button>

      <CreateProjectModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}
