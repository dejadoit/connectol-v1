import { useState } from 'react';

export default function HandoverBuilder({ project, docs, workspaceEntries, onClose }: any) {
  const [copied, setCopied] = useState(false);

  // Compile the handover context
  let contextStr = `[SYSTEM INSTRUCTION: SMART HANDOVER SESSION START]\n`;
  contextStr += `You are assuming the role of an AI operator working on the project "${project.name}".\n`;
  contextStr += `This is a session continuation (Handover) brief. First, review the project context below. Your goal is to help move the work forward based on the latest state, tasks, and blockers.\n`;
  contextStr += `Stay aligned with this canonical truth. Prompt the user to occasionally save your useful outputs (summaries, decisions, plans, or further handovers) back into Connectol.\n`;
  contextStr += `Do not treat unpromoted workspace drafts as final truth.\n\n---\n\n`;

  contextStr += `Project: ${project.name}\n`;
  if (project.description) contextStr += `Description: ${project.description}\n`;
  contextStr += `\n`;

  if (docs && docs.length > 0) {
    contextStr += `## Canonical Context\n`;
    
    const sortOrder: Record<string, number> = { 'current_state': 1, 'tasks': 2, 'blockers': 3, 'handoff': 4 };
    
    const sortedDocs = [...docs].sort((a, b) => {
      let rankA = 99; let rankB = 99;
      for (const k in sortOrder) { if (a.doc_type.toLowerCase().includes(k)) rankA = sortOrder[k]; }
      for (const k in sortOrder) { if (b.doc_type.toLowerCase().includes(k)) rankB = sortOrder[k]; }
      return rankA - rankB;
    });

    for (const doc of sortedDocs) {
      const text = doc.content || doc.summary || '';
      if (text.length > 15) {
        contextStr += `### ${doc.doc_type.toUpperCase()}\n${text}\n\n`;
      }
    }
  }

  const activeEntries = workspaceEntries.filter((we: any) => we.status === 'active');
  const recentEntries = activeEntries.slice(0, 5); // Take top 5 recent

  if (recentEntries.length > 0) {
    contextStr += `## Recent Workspace Inbox\n`;
    for (const item of recentEntries) {
      const shortContent = item.content.substring(0, 400) + (item.content.length > 400 ? '...' : '');
      contextStr += `- [${item.entry_type || 'note'}] **${item.title}**: ${shortContent.replace(/\n/g, " ")}\n`;
    }
    contextStr += `\n`;
  }

  const [editableContent, setEditableContent] = useState(contextStr);

  const handleCopy = () => {
    navigator.clipboard.writeText(editableContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="text-2xl">📦</span> Smart Handover Builder
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Provides an optimized continuation packet for the next AI or operator.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 px-2 py-1">
            ✕ Close
          </button>
        </div>

        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <p className="text-sm font-semibold mb-2 text-gray-700">Preview & Edit Handover Context</p>
          <textarea
            className="w-full flex-1 border rounded bg-gray-50 p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#466370]"
            value={editableContent}
            onChange={(e) => setEditableContent(e.target.value)}
          />
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-between items-center shrink-0">
          <span className="text-xs text-gray-500">Inject Handover via the extension to avoid manual copy.</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border rounded font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button onClick={handleCopy} className="px-4 py-2 bg-[#466370] text-white rounded font-semibold hover:bg-opacity-90 flex items-center gap-2 transition-colors">
              {copied ? '✓ Copied!' : 'Copy Handover to Clipboard'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
