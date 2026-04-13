// Connectol V2 Content Script

let activeProjectId = null;
let activeProjectName = 'NO_PROJ';
let sessionTextHashes = new Set();
let capturedDataCache = null; // Stores text temporarily during confirm sheet

// === Hashing for Duplicate Protection ===
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return hash.toString();
}

function computeStateHash(provider, projId, text) {
  return djb2Hash(`${provider}_${projId}_${text.substring(0, 1000)}`);
}

// === Sync State from Storage ===
async function syncConfig() {
  const data = await chrome.storage.local.get(['activeProjectId']);
  activeProjectId = data.activeProjectId || null;
  
  if (activeProjectId) {
    // Optionally fetch project name asynchronously, but for now just use ID or query background
    chrome.runtime.sendMessage({ action: 'GET_PROJECTS' }, (response) => {
      if (response && response.success) {
        const projects = response.data.projects || response.data;
        const proj = projects.find(p => p.id === activeProjectId);
        if (proj) {
          activeProjectName = proj.name;
          updateUIPState();
          evaluateSessionReadiness();
        }
      }
    });
  } else {
    activeProjectName = 'SELECT PRJ';
    updateUIPState();
    evaluateSessionReadiness();
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.activeProjectId) {
    syncConfig();
  }
});

// === DOM Helpers ===
function getProvider() {
  if (window.location.hostname.includes('chatgpt.com')) return 'chatgpt';
  if (window.location.hostname.includes('claude.ai')) return 'claude';
  return 'unknown';
}

function getComposer() {
  if (getProvider() === 'chatgpt') {
    return document.querySelector('#prompt-textarea');
  } else {
    // Claude uses ProseMirror
    return document.querySelector('.ProseMirror') || document.querySelector('fieldset div[contenteditable="true"]');
  }
}

// === Context Injection Strategy ===
function injectContextText(contextStr) {
  const composer = getComposer();
  if (!composer) {
    alert('Connectol V2: Could not find input composer. Ensure the page has loaded.');
    return false;
  }

  // Actively focus to instantiate lazily-rendered textareas (e.g., ChatGPT React node mapping)
  composer.focus();

  // Determine existing text
  let existingText = '';
  if (composer.tagName.toLowerCase() === 'textarea') {
    existingText = composer.value || '';
  } else if (composer.isContentEditable) {
    existingText = composer.innerText || '';
    if (existingText === '\n') existingText = '';
  }

  // Formatting non-destructive draft preservation
  let payloadStr = `[Connectol Context]\n\n${contextStr}\n\n---\n\n`;
  if (existingText.trim()) {
    payloadStr += existingText;
  }

  let finalSuccess = false;

  if (composer.tagName.toLowerCase() === 'textarea') {
    // React Textarea bypassing
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(composer, payloadStr);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      finalSuccess = true;
    } else {
      composer.value = payloadStr;
      composer.dispatchEvent(new Event('input', { bubbles: true }));
      finalSuccess = true;
    }
  } else {
    // ProseMirror / contenteditable generally requires execCommand
    // Select all so existing text is replaced by the composite string
    document.execCommand('selectAll', false, null);
    const success = document.execCommand('insertText', false, payloadStr);
    
    if (!success) {
      // Fallback: clipboard paste simulation
      navigator.clipboard.writeText(payloadStr).then(() => {
        setStatusMsg('Injection blocked. Context copied to clipboard.', 'error');
      });
      finalSuccess = false; // Officially blocked natively
    } else {
      finalSuccess = true;
    }
  }
  
  if (finalSuccess) setStatusMsg('Context injected!', 'success');
  return finalSuccess;
}

let stagedContextStr = null;

function parseContextPayload(data, isHandover = false) {
  let contextStr = '';
  if (typeof data === 'string') return data;
  else if (data.markdown) return data.markdown;
  
  if (isHandover) {
    contextStr += `[SYSTEM INSTRUCTION: SMART HANDOVER SESSION START]\n`;
    contextStr += `You are assuming the role of an AI operator working on the project "${data.project?.name || 'Unknown'}".\n`;
    contextStr += `This is a session continuation (Handover) brief. First, review the project context below. Your goal is to help move the work forward based on the latest state, tasks, and blockers.\n`;
    contextStr += `Stay aligned with this canonical truth. Prompt the user to occasionally save your useful outputs (summaries, decisions, plans, or further handovers) back into Connectol.\n`;
    contextStr += `Do not treat unpromoted workspace drafts as final truth.\n\n---\n\n`;
  }

  contextStr += `Project: ${data.project?.name || 'Unknown'}\n`;
  if (data.project?.description) contextStr += `Description: ${data.project.description}\n`;
  contextStr += `\n`;
  
  if (data.canonical) {
    contextStr += `## Canonical Context\n`;
    
    // Fuzzy search mapping to guarantee variations like 'current state' or 'status' are caught
    const sortOrder = { 'current_state': 1, 'current state': 1, 'state': 1, 'status': 1, 'tasks': 2, 'blockers': 3, 'handoff': 4 };
    
    const entries = Object.entries(data.canonical).sort((a, b) => {
      let rankA = 99; let rankB = 99;
      for (const k in sortOrder) { if (a[0].toLowerCase().includes(k)) rankA = sortOrder[k]; }
      for (const k in sortOrder) { if (b[0].toLowerCase().includes(k)) rankB = sortOrder[k]; }
      return rankA - rankB;
    });

    const debugLog = [];

    for (const [k, v] of entries) {
      const text = (v.content && v.content.trim()) ? v.content.trim() : (v.summary || '').trim();
      const lower = text.toLowerCase();
      const keyLower = k.toLowerCase();
      
      let rejectReason = null;
      
      // Logic flags
      const isSubstantial = text.length > 250;
      const isInstructionalFiller = /bugs or flaws currently tracked|log important engineering and design/i.test(lower);
      const isShortPlaceholder = !isSubstantial && /scaffold|placeholder|to be determined|\btbd\b|^no content provided/i.test(lower);
      const isEmptyAssertion = !isSubstantial && /no decisions|no known issues|none yet|no updates/i.test(lower);
      const isNoisySection = /decisions|changelog|known_issues|known issues|blockers/i.test(keyLower);
      
      // Rules execution
      if (!text) rejectReason = "Empty content";
      else if (text.length < 15) rejectReason = "Too short (<15 chars)";
      else if (isInstructionalFiller) rejectReason = "Instructional filler boilerplate";
      else if (isShortPlaceholder) rejectReason = "Short generic placeholder";
      else if (isEmptyAssertion) rejectReason = "Empty assertion detected";
      else if (isNoisySection && text.length < 125) {
        rejectReason = "Low-signal section with too little context";
      }

      if (rejectReason) {
        debugLog.push({ section: k, status: "FILTERED", reason: rejectReason, preview: text.substring(0, 40).replace(/\n/g, ' ') });
        continue;
      }
      
      debugLog.push({ section: k, status: "KEPT", preview: text.substring(0, 40).replace(/\n/g, ' ') });
      contextStr += `### ${k.toUpperCase()}\n${text}\n\n`;
    }
    
    console.log("Connectol V2.5 Filter Debug:", JSON.parse(JSON.stringify(debugLog)));
  }
  
  if (data.recent_workspace && data.recent_workspace.length > 0) {
    const useables = data.recent_workspace.filter(item => {
      const type = (item.entry_type || '').toLowerCase();
      if (type === 'meta' || type === 'chat' || type === 'system') return false;
      
      // Stronger threshold: Must be substantial text, not just a one-liner
      if (!item.content || item.content.trim().length < 50) return false;
      
      // Explicit title noise filter
      const titleLower = (item.title || '').toLowerCase();
      if (titleLower.includes('chatgpt reply') || titleLower.includes('claude reply')) return false;
      
      return true;
    }).slice(0, 2);

    if (useables.length > 0) {
      contextStr += `## Recent Workspace Inbox\n`;
      useables.forEach((item, index) => {
        const shortContent = item.content.substring(0, 250).replace(/\n/g, ' ') + (item.content.length > 250 ? '...' : '');
        contextStr += `- [${item.entry_type || 'note'}] **${item.title}**: ${shortContent}\n`;
      });
      contextStr += `\n`;
    }
  }
  return contextStr;
}

function markSessionInjected() {
  const btn = document.getElementById('cn-btn-inject');
  if (btn) {
    btn.classList.remove('auto-ready');
    btn.innerHTML = `<span class="connectol-btn-icon">⬇</span> Inject Context`;
  }
  
  const uuid = getChatUUID();
  if (uuid) {
    let injectedList = [];
    try { injectedList = JSON.parse(sessionStorage.getItem('cn_injected_uuids') || '[]'); } catch(e) {}
    if (!injectedList.includes(uuid)) {
      injectedList.push(uuid);
      sessionStorage.setItem('cn_injected_uuids', JSON.stringify(injectedList));
    }
  }
}

function handleContextPull(isHandover = false) {
  if (!activeProjectId) {
    setStatusMsg('Select project first', 'error');
    return;
  }
  
  if (stagedContextStr) {
    // If auto-pulled, we should re-apply the isHandover condition. Staged was pulled without awareness, so we just run parseContextPayload again?
    // Wait, stagedContextStr is already parsed. We can just prepend if needed.
    if (isHandover && stagedContextStr && !stagedContextStr.includes('SMART HANDOVER SESSION START')) {
       let hStr = `[SYSTEM INSTRUCTION: SMART HANDOVER SESSION START]\nThis is a session continuation (Handover). Please review the context below. Aim to move the work forward.\n\n---\n\n`;
       stagedContextStr = hStr + stagedContextStr;
    }
    const success = injectContextText(stagedContextStr);
    if (success) {
      stagedContextStr = null;
      markSessionInjected();
    }
    return;
  }
  
  setStatusMsg('Pulling...', '');
  const btn = document.getElementById('cn-btn-inject');
  const btnHandover = document.getElementById('cn-btn-inject-handover');
  if (btn) btn.disabled = true;
  if (btnHandover) btnHandover.disabled = true;

  chrome.runtime.sendMessage({ action: 'GET_CONTEXT', projectId: activeProjectId }, (response) => {
    if (btn) btn.disabled = false;
    if (btnHandover) btnHandover.disabled = false;
    
    if (chrome.runtime.lastError || !response || !response.success) {
      setStatusMsg('Pull failed', 'error');
      return;
    }
    
    const fetchedContext = parseContextPayload(response.data, isHandover);
    const success = injectContextText(fetchedContext);
    if (success) {
      markSessionInjected();
    }
  });
}

// === Output Capture Strategy ===
function findLatestResponse() {
  const provider = getProvider();
  
  const selection = window.getSelection().toString().trim();
  if (selection) return selection;

  let extractedText = '';
  if (provider === 'chatgpt') {
    const msgs = document.querySelectorAll('[data-message-author-role="assistant"]');
    if (msgs.length > 0) extractedText = msgs[msgs.length - 1].innerText;
  } else if (provider === 'claude') {
    const msgs = document.querySelectorAll('.font-claude-message, [data-is-streaming="false"] .prose');
    if (msgs.length > 0) extractedText = msgs[msgs.length - 1].innerText;
  }
  
  return extractedText;
}

function handleCaptureIntent() {
  if (!activeProjectId) {
    setStatusMsg('Select project first', 'error');
    return;
  }

  const text = findLatestResponse();
  if (!text) {
    setStatusMsg('Nothing to capture', 'error');
    return;
  }

  const provider = getProvider();
  const hash = computeStateHash(provider, activeProjectId, text);
  let isDup = sessionTextHashes.has(hash);
  
  capturedDataCache = { text, hash, provider };

  const sheet = document.getElementById('connectol-v2-confirm-sheet');
  if (!sheet) return;
  
  const titleInput = document.getElementById('cn-sheet-title');
  const typeSelect = document.getElementById('cn-sheet-type');
  
  // -- V3 Smart Save Classifier (Heuristics) --
  const lowerText = text.toLowerCase();
  
  // Determine Type
  let bestType = 'summary'; // default
  
  const codeRatio = (text.match(/`/g) || []).length / text.length;
  
  const decisionCues = ['decision:', 'we decided', 'going forward', 'chosen direction', 'why this was chosen', 'expected benefit', 'this is the chosen direction'];
  const isDecision = decisionCues.some(cue => lowerText.includes(cue));

  if (codeRatio > 0.05 || lowerText.includes('const ') || lowerText.includes('def ')) {
    bestType = 'snippet';
  } else if (isDecision) {
    bestType = 'decision';
  } else if (lowerText.includes('next steps') || lowerText.includes('remaining tasks') || lowerText.includes('blocker') || lowerText.includes('to do')) {
    // Distinguish between plan and handover
    if (lowerText.includes('handoff') || lowerText.includes('continue from here') || lowerText.includes('resume')) {
      bestType = 'handover';
    } else {
      bestType = 'plan';
    }
  }

  // Determine Title
  let bestTitle = '';
  // Try to find the first heading
  const headingMatch = text.match(/^#+\s+(.+)$/m);
  if (headingMatch) {
    bestTitle = headingMatch[1].trim();
  } else {
    // First substantive line up to 6 words, skipping generic AI intros
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const validLine = lines.find(l => !/^(understood|decision acknowledged|okay|ok,|i understand)/i.test(l)) || lines[0] || '';
    if (validLine) {
      const words = validLine.split(/\s+/);
      bestTitle = words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '');
    }
  }
  
  if (!bestTitle || bestTitle.length < 3) {
    const d = new Date();
    bestTitle = `${provider.toUpperCase()} Reply ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  titleInput.value = `${isDup ? '[DUPLICATE?] ' : ''}${bestTitle}`;
  typeSelect.value = bestType;
  
  if (isDup) alert("Warning: You recently captured this exact text for this project. Save again?");

  sheet.classList.add('open');
  titleInput.focus();
}

function executeCapture() {
  const sheet = document.getElementById('connectol-v2-confirm-sheet');
  const btn = document.getElementById('cn-sheet-save');
  const title = document.getElementById('cn-sheet-title').value || 'Captured Snippet';
  const type = document.getElementById('cn-sheet-type').value;
  const conf = document.getElementById('cn-sheet-conf').value;

  if (!capturedDataCache) return;
  
  btn.innerText = 'Saving...';
  btn.disabled = true;

  const payload = {
    title: title,
    entry_type: type,
    content: capturedDataCache.text,
    confidence: conf,
    metadata: {
      source: 'connectol_extension_v2_5',
      provider: capturedDataCache.provider,
      context_mode: 'compact',
      source_chat_url: window.location.href,
      captured_at: new Date().toISOString()
    }
  };

  chrome.runtime.sendMessage({ action: 'POST_WORKSPACE', projectId: activeProjectId, payload }, (res) => {
    btn.innerText = 'Save';
    btn.disabled = false;
    
    if (chrome.runtime.lastError || !res || !res.success) {
      alert("Connectol V2.5 Error: " + (res?.error || "Network error."));
      return;
    }

    sessionTextHashes.add(capturedDataCache.hash);
    sheet.classList.remove('open');
    setStatusMsg('Saved!', 'success');
    capturedDataCache = null;
  });
}

// === UI Construction & Idempotent Mounting ===
function updateUIPState() {
  const badge = document.getElementById('cn-active-badge');
  if (badge) badge.innerText = typeof activeProjectName === 'string' && activeProjectName.length > 10 ? activeProjectName.substring(0,10) + '...' : activeProjectName;
}

function setStatusMsg(msg, type) {
  const el = document.getElementById('cn-status');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'success' ? '#10b981' : '#ef4444';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

function toggleProjectList() {
  const list = document.getElementById('cn-project-list');
  if (!list) return;
  list.classList.toggle('open');
  
  if (list.classList.contains('open')) {
    list.innerHTML = '<div class="connectol-project-option">Loading...</div>';
    chrome.runtime.sendMessage({ action: 'GET_PROJECTS' }, (response) => {
      if (response && response.success) {
        const projs = response.data.projects || response.data;
        list.innerHTML = '';
        projs.forEach(p => {
          const div = document.createElement('div');
          div.className = 'connectol-project-option';
          div.innerText = p.name;
          div.onclick = () => {
            chrome.storage.local.set({ activeProjectId: p.id });
            list.classList.remove('open');
          };
          list.appendChild(div);
        });
      } else {
        list.innerHTML = '<div class="connectol-project-option" style="color:red">Error loading</div>';
      }
    });
  }
}

function injectUI() {
  if (document.getElementById('connectol-v2-minibar')) return; // Idempotent check

  const isCollapsed = sessionStorage.getItem('connectol_collapsed') === 'true';

  const bar = document.createElement('div');
  bar.id = 'connectol-v2-minibar';
  if (isCollapsed) bar.classList.add('connectol-collapsed');

  bar.innerHTML = `
    <!-- Collapse Button -->
    <button class="connectol-collapse-toggle" id="cn-collapse-btn">
      ${isCollapsed ? '➕' : '➖'}
    </button>
    
    <div class="connectol-full-ui">
      <!-- Project Badge -->
      <div style="position: relative;">
        <div class="connectol-project-badge" id="cn-active-badge">...</div>
        <div class="connectol-project-switcher-dropdown" id="cn-project-list"></div>
      </div>
      
      <div class="connectol-divider"></div>

      <!-- Action Buttons -->
      <button class="connectol-btn" id="cn-btn-inject-handover" title="Inject handover for a new session">
        <span class="connectol-btn-icon">📦</span>
        Inject Handover
      </button>

      <button class="connectol-btn" id="cn-btn-inject" title="Inject context into composer">
        <span class="connectol-btn-icon">⬇</span>
        Inject Context
      </button>

      <button class="connectol-btn primary" id="cn-btn-capture" title="Save assistant reply or selected text">
        <span class="connectol-btn-icon">⬆</span>
        <span id="cn-lbl-capture">Save Latest</span>
      </button>
      
      <span class="connectol-status" id="cn-status"></span>
    </div>

    <!-- Confirm Sheet overlay -->
    <div id="connectol-v2-confirm-sheet">
      <div class="connectol-sheet-header">Workspace Writeback</div>
      <div class="connectol-sheet-input-group">
        <div class="connectol-sheet-label">Title</div>
        <input type="text" id="cn-sheet-title" class="connectol-sheet-input">
      </div>
      <div class="connectol-sheet-row">
        <div class="connectol-sheet-input-group">
          <div class="connectol-sheet-label">Type</div>
          <select id="cn-sheet-type" class="connectol-sheet-select">
            <option value="summary">Summary</option>
            <option value="decision">Decision</option>
            <option value="snippet">Snippet</option>
            <option value="plan">Plan</option>
            <option value="handover">Handover</option>
          </select>
        </div>
        <div class="connectol-sheet-input-group">
          <div class="connectol-sheet-label">Confidence</div>
          <select id="cn-sheet-conf" class="connectol-sheet-select">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div class="connectol-sheet-actions">
        <button class="connectol-btn" id="cn-sheet-cancel">Cancel</button>
        <button class="connectol-btn primary" id="cn-sheet-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(bar);

  document.getElementById('cn-collapse-btn').addEventListener('click', () => {
    const b = document.getElementById('connectol-v2-minibar');
    const collapsed = b.classList.toggle('connectol-collapsed');
    document.getElementById('cn-collapse-btn').innerText = collapsed ? '➕' : '➖';
    sessionStorage.setItem('connectol_collapsed', collapsed ? 'true' : 'false');
  });

  document.getElementById('cn-active-badge').addEventListener('click', toggleProjectList);
  document.getElementById('cn-btn-inject-handover').addEventListener('click', () => handleContextPull(true));
  document.getElementById('cn-btn-inject').addEventListener('click', () => handleContextPull(false));
  document.getElementById('cn-btn-capture').addEventListener('click', handleCaptureIntent);
  
  document.getElementById('cn-sheet-cancel').addEventListener('click', () => {
    document.getElementById('connectol-v2-confirm-sheet').classList.remove('open');
    capturedDataCache = null;
  });
  document.getElementById('cn-sheet-save').addEventListener('click', executeCapture);
  
  document.getElementById('connectol-v2-confirm-sheet').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') executeCapture();
  });

  setInterval(() => {
    const lbl = document.getElementById('cn-lbl-capture');
    if (!lbl) return;
    const sel = window.getSelection().toString().trim();
    if (sel && lbl.innerText !== 'Save Selected') lbl.innerText = 'Save Selected';
    else if (!sel && lbl.innerText !== 'Save Latest') lbl.innerText = 'Save Latest';
  }, 1000);

  updateUIPState();
}

// === SPA Hooking & Lifecycles ===
function getChatUUID() {
  const url = window.location.href;
  if (url.includes('chatgpt.com/c/')) return url.split('chatgpt.com/c/')[1].split('?')[0];
  if (url.includes('claude.ai/chat/')) return url.split('claude.ai/chat/')[1].split('?')[0];
  return null;
}

function isNewChatRoute() {
  const url = window.location.href;
  if (url.match(/chatgpt\.com\/?(\?.*)?$/)) return true;
  if (url.match(/claude\.ai\/new\/?(\?.*)?$/)) return true;
  return false;
}

function evaluateSessionReadiness() {
  const btn = document.getElementById('cn-btn-inject');
  if (!btn) return;
  
  const uuid = getChatUUID();
  const isNew = isNewChatRoute();
  
  let shouldAutoReady = false;
  
  if (isNew) {
    shouldAutoReady = true;
  } else if (uuid) {
    let injectedList = [];
    try { injectedList = JSON.parse(sessionStorage.getItem('cn_injected_uuids') || '[]'); } catch(e) {}
    shouldAutoReady = !injectedList.includes(uuid);
  }

  if (shouldAutoReady) {
    if (!btn.classList.contains('auto-ready')) {
       // Fire automatic staging
       if (activeProjectId) {
         chrome.runtime.sendMessage({ action: 'GET_CONTEXT', projectId: activeProjectId }, (res) => {
           if (res && res.success && res.data) {
             stagedContextStr = parseContextPayload(res.data);
             btn.classList.add('auto-ready');
             btn.innerHTML = `✨ Auto-Ready: Inject Context`;
           }
         });
       }
    }
  } else {
    btn.classList.remove('auto-ready');
    btn.innerHTML = `<span class="connectol-btn-icon">⬇</span> Inject Context`;
    stagedContextStr = null;
  }
}

function onRouteUpdate() {
  injectUI();
  evaluateSessionReadiness();
}

// History API Hooks
const originalPushState = history.pushState;
history.pushState = function(...args) {
  originalPushState.apply(this, args);
  setTimeout(onRouteUpdate, 500);
};

const originalReplaceState = history.replaceState;
history.replaceState = function(...args) {
  originalReplaceState.apply(this, args);
  setTimeout(onRouteUpdate, 500);
};

window.addEventListener('popstate', onRouteUpdate);

// Mutation Observer
const observer = new MutationObserver(() => {
  if (!document.getElementById('connectol-v2-minibar')) {
    injectUI();
    evaluateSessionReadiness();
  }
});

// Init
syncConfig().then(() => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectUI();
      evaluateSessionReadiness();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    injectUI();
    evaluateSessionReadiness();
    observer.observe(document.body, { childList: true, subtree: true });
  }
});

// Handle messages from the extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_OUTPUT') {
    const text = findLatestResponse();
    const provider = getProvider();
    const url = window.location.href;
    
    // Heuristics
    let bestType = 'summary';
    let bestTitle = 'Captured Snippet';
    if (text) {
      const lowerText = text.toLowerCase();
      const codeRatio = (text.match(/`/g) || []).length / text.length;
      
      const decisionCues = ['decision:', 'we decided', 'going forward', 'chosen direction', 'why this was chosen', 'expected benefit', 'this is the chosen direction'];
      const isDecision = decisionCues.some(cue => lowerText.includes(cue));
      
      if (codeRatio > 0.05 || lowerText.includes('const ') || lowerText.includes('def ')) bestType = 'snippet';
      else if (isDecision) bestType = 'decision';
      else if (lowerText.includes('next steps') || lowerText.includes('remaining tasks') || lowerText.includes('blocker')) {
        bestType = lowerText.includes('handoff') || lowerText.includes('continue from here') ? 'handover' : 'plan';
      }
      const headingMatch = text.match(/^#+\s+(.+)$/m);
      if (headingMatch) bestTitle = headingMatch[1].trim();
      else {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const validLine = lines.find(l => !/^(understood|decision acknowledged|okay|ok,|i understand)/i.test(l)) || lines[0] || '';
        if (validLine) {
          const words = validLine.split(/\s+/);
          bestTitle = words.slice(0, 6).join(' ') + (words.length > 6 ? '...' : '');
        }
      }
    }
    
    sendResponse({ success: true, data: { text, provider, url, bestType, bestTitle } });
  }
  return true;
});
