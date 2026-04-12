'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ConnectClient({ project }: { project: any }) {
  const router = useRouter();
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('chatgpt');

  const openApiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.connectol.app'}/functions/v1/connectol/openapi.json`;
  const baseRestUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://api.connectol.app'}/functions/v1/connectol`;

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

  const claudeInstructions = `<connectol_system_rules>
  <role>You are a Global AI Assistant tethered to the Connectol Memory Hub workflow. You must execute project memory reads and writes by generating exact cURL commands for the human operator to run in their terminal.</role>

  <discovery_phase>
    Whenever a human asks you to draft or review material for Connectol, ALWAYS generate this command first to discover their available Project IDs:
    <curl_command>curl -s -X GET "${baseRestUrl}/projects" -H "Authorization: Bearer <HUMAN_WILL_PASTE_KEY_HERE>"</curl_command>
    Wait for the human to paste the JSON array back to you. Select the target project ID with the user.
  </discovery_phase>

  <read_phase>
    Once you have a target Project ID, generate a command to read current project truth:
    <curl_command>curl -s -X GET "${baseRestUrl}/projects/{selected_id}/context?compact=true" -H "Authorization: Bearer <HUMAN_WILL_PASTE_KEY_HERE>"</curl_command>
    Absorb the canonical context the human pastes back to you before drafting.
  </read_phase>

  <write_phase>
    When you have finished formulating a draft proposal or code block, you MUST generate a final insertion command to safely store it into the Workspace Inbox:
    <curl_command>
      curl -s -X POST "${baseRestUrl}/projects/{selected_id}/workspace" \\
      -H "Authorization: Bearer <HUMAN_WILL_PASTE_KEY_HERE>" \\
      -H "Content-Type: application/json" \\
      -d '{
        "title": "Your Short Draft Title",
        "content": "Full markdown of your drafted proposal...",
        "entry_type": "suggestion",
        "metadata": { "source": "claude_global", "model": "claude-3.5-sonnet" }
      }'
    </curl_command>
  </write_phase>
</connectol_system_rules>`;

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
          <strong>Setup Limitations:</strong> There is no "magic 1-click" seamless integration. Setup requires manual copy-pasting to tether an external AI (like ChatGPT or Claude) securely behind your isolated keys. This is operator-first memory; humans will ALWAYS need to manually review and promote the automated AI drafts inside the Workspace visual interface.
      </div>

      <div className="flex border-b mb-6">
        <button 
           className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'chatgpt' ? 'border-[#466370] text-[#466370]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           onClick={() => setActiveTab('chatgpt')}
        >
          ChatGPT (Custom GPT)
        </button>
        <button 
           className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'claude' ? 'border-[#466370] text-[#466370]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
           onClick={() => setActiveTab('claude')}
        >
          Claude (Anthropic)
        </button>
      </div>

      {/* CHATGPT TAB */}
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


      {/* CLAUDE TAB */}
      {activeTab === 'claude' && (
         <div className="space-y-6 relative">
            <div className="absolute left-6 top-8 bottom-4 w-0.5 bg-gray-200 z-0 hidden sm:block"></div>

            <div className="relative z-10 bg-white border border-yellow-200 rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-yellow-500 bg-yellow-50/30">
                <h2 className="font-bold text-yellow-900 text-lg mb-2">Claude Integration Reality Check</h2>
                <p className="text-sm text-yellow-800">
                   Unlike ChatGPT, the official <strong>Claude Web Interface (claude.ai)</strong> completely blocks outbound internet requests. Claude cannot physically fetch Connectol URLs natively in the browser. 
                   <br/><br/>
                   <strong>The Manual Solution:</strong> We provide Claude a strict framework via "Claude Projects". Claude acts as the architect by writing exact REST `<code className="bg-yellow-200 px-1 rounded">cURL</code>` lines; you act as the execution proxy by physically running those lines in your terminal and pasting the responses back. This guarantees true shared-memory continuity across LLMs without rewriting backend infrastructure.
                </p>
            </div>

            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-[#466370]">
                <h2 className="font-bold text-gray-800 text-lg mb-2">Step 1: Generate your Connectol API Key</h2>
                <p className="text-sm text-gray-600">Navigate to the <a href={`/projects/${project.id}/keys`} target="_blank" className="text-blue-600 font-semibold hover:underline">API Keys Hub</a> and generate a key mapped to "Claude". Keep it safe as you will need to paste it locally over to Claude shortly.</p>
            </div>

            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-[#466370]">
                <h2 className="font-bold text-gray-800 text-lg mb-2">Step 2: Create a Claude Project</h2>
                <p className="text-sm text-gray-600">Open Claude.ai and construct a dedicated "Connectol AI" Project workspace. This allows the system instructions to explicitly bind to your chat context permanently.</p>
            </div>

            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-[#466370]">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="font-bold text-gray-800 text-lg">Step 3: Paste Custom System Instructions</h2>
                        <p className="text-sm text-gray-600">Paste constraints below into the <strong>Project Custom Instructions</strong> field. These dictate exactly how Claude structures read/write curl arrays utilizing standard Connectol JSON formatting.</p>
                    </div>
                    <button 
                        onClick={() => copyToClipboard(claudeInstructions, 'claude_prompt')}
                        className={`px-4 py-2 rounded shrink-0 font-bold text-sm transition-colors ${copiedType === 'claude_prompt' ? 'bg-green-100 text-green-700' : 'bg-[#466370] text-white hover:bg-opacity-90'}`}
                    >
                        {copiedType === 'claude_prompt' ? 'Copied!' : 'Copy Blueprints'}
                    </button>
                </div>
                
                <div className="bg-gray-100 p-4 border rounded-md mb-4 text-xs text-gray-700 border-gray-200 flex items-start gap-3">
                    <div className="text-lg">🌍</div>
                    <div>
                        <strong className="block mb-1 text-gray-900">How Project Targeting Works:</strong>
                        Claude is not tethered natively to one project! The XML constraints tell Claude to ALWAYS request and scan the `/projects` array manually up front, prompting you to negotiate which context to operate under before drafting.
                    </div>
                </div>

                <div className="p-4 bg-gray-900 text-gray-100 rounded-md font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                    {claudeInstructions}
                </div>
            </div>

            <div className="relative z-10 bg-white border rounded-xl shadow-sm p-6 ml-0 sm:ml-12 border-l-4 border-l-green-600">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="font-bold text-green-800 text-lg">Step 4: Kickoff the Manual Operator Loop</h2>
                        <p className="text-sm text-gray-600">Start a chat inside your new Claude Project and test the bounds using this explicitly phrased prompt.</p>
                    </div>
                    <button 
                        onClick={() => copyToClipboard("I want to draft a new structural idea for Connectol memory. Please generate the discovery cURL command first so I can fetch my projects array.", 'claude_test')}
                        className={`px-3 py-1.5 rounded shrink-0 font-bold text-xs transition-colors border ${copiedType === 'claude_test' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'}`}
                    >
                        {copiedType === 'claude_test' ? 'Copied!' : 'Copy Prompt'}
                    </button>
                </div>
                <div className="p-4 bg-green-50 border border-green-100 rounded-md text-green-900 text-sm font-medium italic">
                    "I want to draft a new structural idea for Connectol memory. Please generate the discovery cURL command first so I can fetch my projects array."
                </div>
            </div>

         </div>
      )}

    </div>
  );
}
