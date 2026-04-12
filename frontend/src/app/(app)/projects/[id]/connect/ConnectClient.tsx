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

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="mb-8">
        <button onClick={() => router.push(`/projects/${project.id}`)} className="text-sm font-semibold text-gray-500 hover:text-gray-900 mb-4 inline-flex items-center gap-1">
          ← Back to Project
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect AI Ecosystem</h1>
        <p className="text-gray-600 text-lg">
          Integrate external reasoning models like ChatGPT or Claude directly into the global Connectol memory loop. 
        </p>
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
        <div className="space-y-6">
            <div className="bg-white border rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-gray-800 text-lg mb-4">1. Import the Generic OpenAPI Schema</h2>
                <p className="text-sm text-gray-600 mb-4">Create a generic Custom GPT inside your OpenAI account. Under the <strong>Actions</strong> tab, click "Import from URL" and paste the centralized OpenAPI specification below. This single schema dynamically spans all your authorized projects.</p>
                <div className="flex items-center gap-4">
                    <input type="text" readOnly value={openApiUrl} className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono text-gray-800" />
                    <button onClick={() => copyToClipboard(openApiUrl, 'url')} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded font-medium text-sm transition-colors w-32 border">
                        {copiedType === 'url' ? 'Copied!' : 'Copy URL'}
                    </button>
                </div>
            </div>

            <div className="bg-white border rounded-xl shadow-sm p-6">
                <h2 className="font-bold text-gray-800 text-lg mb-4">2. Map your Global Base Authentication</h2>
                <p className="text-sm text-gray-600 mb-2">Within the Action configuration in ChatGPT, click <strong>Authentication ▸ API Key</strong>. Set the Auth Type to Bearer.</p>
                <p className="text-sm text-gray-600">You must use a Global Connectol Agent key. Create one natively from the <a href={`/projects/${project.id}/keys`} className="text-blue-600 font-semibold hover:underline">API Keys Hub</a> and securely paste it into ChatGPT.</p>
            </div>

            <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-8">
                <div className="border-b px-6 py-4 bg-gray-50 flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-gray-800 text-lg">3. Base System Prompt</h2>
                    <p className="text-sm text-gray-500 mt-1">Paste this globally generic block directly into the overall GPT definition to anchor structural tracking metadata.</p>
                </div>
                <button 
                    onClick={() => copyToClipboard(chatGptInstructions, 'prompt')}
                    className={`px-4 py-2 rounded font-bold text-sm transition-colors ${copiedType === 'prompt' ? 'bg-green-100 text-green-700' : 'bg-[#466370] text-white hover:bg-opacity-90'}`}
                >
                    {copiedType === 'prompt' ? 'Copied!' : 'Copy Prompt'}
                </button>
                </div>
                <div className="p-6 bg-gray-900 text-gray-100 font-mono text-sm whitespace-pre-wrap overflow-x-auto">
                {chatGptInstructions}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
