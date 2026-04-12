'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ConnectClient({ project }: { project: any }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const instructions = `You are an AI connected to the Connectol Memory Hub for the project "${project.name}".
Your goal is to assist human operators in reasoning, generating code, or proposing system changes.

Instead of just outputting massive text blocks that humans have to manually copy-paste, you must INTERACT with the project directly via its REST API.

## Core Rules:
1. ALWAYS read the project's current context before proposing significant changes:
   GET ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.connectol.app'}/functions/v1/connectol/projects/${project.id}/context?compact=true

2. When you have a draft, feature suggestion, or code block ready, POST exactly to the Workspace Inbox:
   POST ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.connectol.app'}/functions/v1/connectol/projects/${project.id}/workspace
   
   PAYLOAD JSON SCHEMA:
   {
     "title": "Short descriptive title of your draft",
     "content": "The actual full markdown, code, or proposal",
     "entry_type": "suggestion", 
     "metadata": {
       "source": "chatgpt_connector_v1_2",
       "model": "gpt-4o"
     }
   }

3. Auth explicitly: Send the HTTP header 'Authorization: Bearer <API_KEY>' on all requests.
4. Never assume a draft is automatically accepted. Let the human review it in the Workspace Inbox and promote it to Canonical Truth themselves.`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(instructions);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="mb-8">
        <button onClick={() => router.push(`/projects/${project.id}`)} className="text-sm font-semibold text-gray-500 hover:text-gray-900 mb-4 inline-flex items-center gap-1">
          ← Back to Project
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect AI to {project.name}</h1>
        <p className="text-gray-600 text-lg">
          Integrate external reasoning models like ChatGPT or Claude directly into this project's memory loop.
        </p>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-8">
        <div className="border-b px-6 py-4 bg-gray-50 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-800 text-lg">Generic Connector Payload</h2>
            <p className="text-sm text-gray-500 mt-1">Copy and paste this instructional block into ChatGPT Custom Instructions or GPT Builder.</p>
          </div>
          <button 
            onClick={copyToClipboard}
            className={`px-4 py-2 rounded font-bold text-sm transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-[#466370] text-white hover:bg-opacity-90'}`}
          >
            {copied ? 'Copied!' : 'Copy Integration Block'}
          </button>
        </div>
        <div className="p-6 bg-gray-900 text-gray-100 font-mono text-sm whitespace-pre-wrap overflow-x-auto">
          {instructions}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border p-5 rounded-lg shadow-sm">
           <h3 className="font-bold text-gray-800 mb-2 border-b pb-2">1. The Contract</h3>
           <p className="text-sm text-gray-600">Connectol separates canonical verified truth from experimental drafts. External AIs only write to the "Workspace Inbox".</p>
        </div>
        <div className="bg-white border p-5 rounded-lg shadow-sm">
           <h3 className="font-bold text-gray-800 mb-2 border-b pb-2">2. Authentication</h3>
           <p className="text-sm text-gray-600">Generate an API Key for the Agent in the <a href={`/projects/${project.id}/keys`} className="text-blue-600 hover:underline">Settings</a>. Inject it as a Bearer token in the API requests.</p>
        </div>
        <div className="bg-white border p-5 rounded-lg shadow-sm">
           <h3 className="font-bold text-gray-800 mb-2 border-b pb-2">3. Visibility Tracing</h3>
           <p className="text-sm text-gray-600">Using the `metadata` block ensures the inbox transparently renders which model or bot authored the draft proposal.</p>
        </div>
      </div>
    </div>
  );
}
