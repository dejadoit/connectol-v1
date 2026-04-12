'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ConnectClient({ project }: { project: any }) {
  const router = useRouter();
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('chatgpt');

  const openApiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.connectol.app'}/functions/v1/connectol/openapi.json`;

  const chatGptInstructions = `You are a Global AI Assistant formally tied to the Connectol Memory Hub.
Your primary role is to natively fetch project context, reason through software workflows, and propose code or features directly into the target project's Workspace Inbox rather than outputting massive manual copy-paste blocks.

# Global Routing Logic
When requested to verify something, read logic, or capture an idea:
1. Always list projects first via \`listProjects\` to identify the target Project ID dynamically.
2. Interrogate the target project's existing canonical baseline via \`getProjectContext\`.
3. Push structured drafts, proposals, or findings directly via \`createWorkspaceEntry\`. 
   MANDATORY - When writing workspace entries you MUST include this metadata payload:
   {
       "source": "chatgpt_global",
       "model": "gpt-4o"
   }
`;

  const testPrompt = `List my available Connectol projects. Review the list, select the one you find most interesting, fetch its context, and then draft a quick suggestion into its Workspace Inbox titled "First Setup Test Run".`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      
      {/* 1. Explaining the Loop & Connectol */}
      <div className="mb-4">
        <button onClick={() => router.push(`/projects/${project.id}`)} className="text-sm font-semibold text-gray-500 hover:text-gray-900 mb-4 inline-flex items-center gap-1">
          ← Back to Project
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect AI Ecosystem</h1>
        <p className="text-gray-600 text-lg">
          Integrate external reasoning models directly into your Connectol memory loop. 
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-5 mb-8 text-blue-900 shadow-sm flex items-start gap-4">
        <div className="text-2xl pt-1">🧠</div>
        <div>
           <h3 className="font-bold text-lg mb-1">The Shared Memory Loop</h3>
           <ul className="list-disc pl-5 space-y-1 text-sm text-blue-800">
               <li><strong>Connectol</strong> is the shared source of truth.</li>
               <li><strong>AI reads</strong> pure canonical context without massive copy-pasting.</li>
               <li><strong>AI writes</strong> draft outputs straight into your Workspace Inbox.</li>
               <li><strong>Humans review</strong> and promote raw drafts into canonical permanent truth.</li>
           </ul>
        </div>
      </div>

      {/* Explicit Limitations Clause */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8 text-sm text-yellow-900">
          <strong>Setup Limitations:</strong> There is no "magic 1-click" integration. Connecting an AI like ChatGPT requires manual copy-pasting to build a Custom GPT securely behind your keys. This is operator-first memory; humans will ALWAYS need to manually review and promote the automated drafts inside the Workspace.
      </div>

      <div className="flex border-b mb-6">
        <button 
           className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'chatgpt' ? 'border-[#466370] text-[#466370]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           onClick={() => setActiveTab('chatgpt')}
        >
          ChatGPT (Custom GPT)
        </button>
        <button 
           className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'claude' ? 'border-[#466370] text-[#466370]' : 'border-transparent text-gray-500 hover:text-gray-700 opacity-50 cursor-not-allowed'}`}
           disabled
        >
          Claude (Coming Soon)
        </button>
      </div>

      {activeTab === 'chatgpt' && (
        <div className="space-y-6 relative">
            <div className="absolute left-6 top-8 bottom-4 w-0.5 bg-gray-200 z-0 hidden sm:block"></div>
            
            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-[#466370]">
                <h2 className="font-bold text-gray-800 text-lg mb-2">Step 1: Generate an Agent Key</h2>
                <p className="text-sm text-gray-600">Navigate to the <a href={`/projects/${project.id}/keys`} target="_blank" className="text-blue-600 font-semibold hover:underline">API Keys Hub</a> and generate a new key for this Agent. Copy it immediately to your clipboard.</p>
            </div>

            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-[#466370]">
                <h2 className="font-bold text-gray-800 text-lg mb-2">Step 2: Create a Custom GPT</h2>
                <p className="text-sm text-gray-600">Open ChatGPT and navigate to <strong>Explore GPTs ▸ Create</strong>. Give your GPT a name like <em>"Connectol Hub"</em>.</p>
            </div>

            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-[#466370]">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="font-bold text-gray-800 text-lg">Step 3: Import the OpenAPI Schema</h2>
                        <p className="text-sm text-gray-600">Under the <strong>Actions</strong> tab, click <em>Import from URL</em> and paste this exact link.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4 bg-gray-50 border p-2 rounded-lg">
                    <input type="text" readOnly value={openApiUrl} className="flex-1 bg-transparent px-2 text-sm font-mono text-gray-800 focus:outline-none" />
                    <button onClick={() => copyToClipboard(openApiUrl, 'url')} className="px-4 py-2 bg-white border shadow-sm hover:bg-gray-50 text-gray-800 rounded font-medium text-sm transition-colors w-32 shrink-0">
                        {copiedType === 'url' ? 'Copied!' : 'Copy URL'}
                    </button>
                </div>
            </div>

            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-[#466370]">
                <h2 className="font-bold text-gray-800 text-lg mb-2">Step 4: Lock Down Authorization</h2>
                <p className="text-sm text-gray-600">In the Actions pane, click the gear next to <strong>Authentication</strong>. Set the Type to <strong>API Key</strong>, Auth Type to <strong>Bearer</strong>, and paste the Connectol Key you copied in Step 1.</p>
            </div>

            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-[#466370]">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="font-bold text-gray-800 text-lg">Step 5: Paste System Constraints</h2>
                        <p className="text-sm text-gray-600">Back in the main Configure tab, paste these exact rules into the <strong>Instructions</strong> box so the GPT handles memory natively.</p>
                    </div>
                    <button 
                        onClick={() => copyToClipboard(chatGptInstructions, 'prompt')}
                        className={`px-4 py-2 rounded shrink-0 font-bold text-sm transition-colors ${copiedType === 'prompt' ? 'bg-green-100 text-green-700' : 'bg-[#466370] text-white hover:bg-opacity-90'}`}
                    >
                        {copiedType === 'prompt' ? 'Copied!' : 'Copy Rules'}
                    </button>
                </div>
                
                {/* Multi-Project Caveat Panel embedded right below rules */}
                <div className="bg-gray-100 p-4 border rounded-md mb-4 text-xs text-gray-700 border-gray-200 flex items-start gap-3">
                    <div className="text-lg">🌍</div>
                    <div>
                        <strong className="block mb-1 text-gray-900">How Project Targeting Works:</strong>
                        This rule block does NOT hardcode an ID! Because you provided a generic OpenAPI spec, this Custom GPT spans ALL your authorized projects natively. It actively queries Connectol to figure out what projects you have during the chat session.
                    </div>
                </div>

                <div className="p-4 bg-gray-900 text-gray-100 rounded-md font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                    {chatGptInstructions}
                </div>
            </div>

            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-green-600">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="font-bold text-green-800 text-lg">Step 6: Run Your First Test</h2>
                        <p className="text-sm text-gray-600">Save the GPT. Open a new chat window with it, and paste this exact command to test the read/write circuit!</p>
                    </div>
                    <button 
                        onClick={() => copyToClipboard(testPrompt, 'test')}
                        className={`px-3 py-1.5 rounded shrink-0 font-bold text-xs transition-colors border ${copiedType === 'test' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}
                    >
                        {copiedType === 'test' ? 'Copied!' : 'Copy Prompt'}
                    </button>
                </div>
                <div className="p-4 bg-green-50 border border-green-100 rounded-md text-green-900 text-sm font-medium italic">
                    "{testPrompt}"
                </div>
            </div>

        </div>
      )}
    </div>
  );
}
