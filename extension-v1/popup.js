document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const elViewMain = document.getElementById('view-main');
  const elViewSettings = document.getElementById('view-settings');
  
  const btnSettings = document.getElementById('btn-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnCancelSettings = document.getElementById('btn-cancel-settings');
  
  const inputUrl = document.getElementById('config-url');
  const inputKey = document.getElementById('config-key');
  const dropdownProject = document.getElementById('project-select');
  
  const btnPullContext = document.getElementById('btn-pull-context');
  const btnInjectHandover = document.getElementById('btn-inject-handover');
  const btnCapture = document.getElementById('btn-capture');
  
  // State
  let config = await chrome.storage.local.get(['apiUrl', 'apiKey', 'activeProjectId']);
  
  // Initialization
  if (!config.apiKey) {
    showView('settings');
  } else {
    loadProjects();
    prefillCapture();
  }
  
  // Handlers
  btnSettings.addEventListener('click', () => {
    inputUrl.value = config.apiUrl || 'https://acewlqwzbjvjxssdmdlx.supabase.co/functions/v1/connectol';
    inputKey.value = config.apiKey || '';
    showView('settings');
  });
  
  btnCancelSettings.addEventListener('click', () => {
    if (config.apiKey) showView('main');
  });
  
  btnSaveSettings.addEventListener('click', async () => {
    const url = inputUrl.value.trim();
    const key = inputKey.value.trim();
    
    if (!url || !key) {
      showStatus('settings-status', 'URL and Key are required', 'error');
      return;
    }
    
    await chrome.storage.local.set({ apiUrl: url, apiKey: key });
    config = await chrome.storage.local.get(['apiUrl', 'apiKey', 'activeProjectId']);
    
    showStatus('settings-status', 'Saved!', 'success');
    setTimeout(() => {
      showView('main');
      loadProjects();
    }, 1000);
  });
  
  dropdownProject.addEventListener('change', async (e) => {
    const projectId = e.target.value;
    if (projectId) {
      await chrome.storage.local.set({ activeProjectId: projectId });
      config.activeProjectId = projectId;
    }
  });
  
  btnPullContext.addEventListener('click', () => pullContext(false));
  btnInjectHandover.addEventListener('click', () => pullContext(true));
  btnCapture.addEventListener('click', captureOutput);

  // --- Logic Functions ---

  async function prefillCapture() {
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab.url.includes('chatgpt.com') && !tab.url.includes('claude.ai')) return;
      
      chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_OUTPUT' }, (res) => {
         if (res && res.success && res.data) {
            const titleBox = document.getElementById('entry-title');
            const typeBox = document.getElementById('entry-type');
            if (!titleBox.value && res.data.bestTitle) titleBox.value = res.data.bestTitle;
            if (res.data.bestType) typeBox.value = res.data.bestType;
         }
      });
    } catch(e) {}
  }

  function showView(viewId) {
    elViewMain.classList.remove('active');
    elViewSettings.classList.remove('active');
    document.getElementById(`view-${viewId}`).classList.add('active');
  }

  function showStatus(elementId, msg, type) {
    const el = document.getElementById(elementId);
    el.textContent = msg;
    el.className = `status-msg ${type}`;
    setTimeout(() => { el.textContent = ''; el.className = 'status-msg'; }, 3000);
  }

  function loadProjects() {
    chrome.runtime.sendMessage({ action: 'GET_PROJECTS' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('context-status', 'Background worker error', 'error');
        return;
      }
      
      if (!response.success) {
        console.error('Failed to load projects:', response.error);
        dropdownProject.innerHTML = '<option value="">Error loading projects</option>';
        return;
      }
      
      const projects = response.data.projects || response.data;
      dropdownProject.innerHTML = '';
      
      if (!projects || projects.length === 0) {
        dropdownProject.innerHTML = '<option value="">No projects found</option>';
        return;
      }
      
      projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === config.activeProjectId) opt.selected = true;
        dropdownProject.appendChild(opt);
      });
      
      if (!config.activeProjectId && projects.length > 0) {
        config.activeProjectId = projects[0].id;
        chrome.storage.local.set({ activeProjectId: projects[0].id });
      }
    });
  }

  function pullContext(isHandover = false) {
    if (!config.activeProjectId) {
      showStatus('context-status', 'Select a project first', 'error');
      return;
    }
    
    btnPullContext.disabled = true;
    btnInjectHandover.disabled = true;
    showStatus('context-status', 'Pulling...', '');
    
    chrome.runtime.sendMessage(
      { action: 'GET_CONTEXT', projectId: config.activeProjectId }, 
      (response) => {
        btnPullContext.disabled = false;
        btnInjectHandover.disabled = false;
        
        if (chrome.runtime.lastError || !response.success) {
          showStatus('context-status', 'Failed to fetch context', 'error');
          return;
        }
        
        let contextStr = '';
        const handoverPrefix = `[SYSTEM INSTRUCTION: SMART HANDOVER SESSION START]\nThis is a session continuation (Handover). Please review the context below. Aim to move the work forward.\n\n---\n\n`;
        
        if (typeof response.data === 'string') {
           contextStr = isHandover ? handoverPrefix + response.data : response.data;
        } else if (response.data.markdown) {
           contextStr = isHandover ? handoverPrefix + response.data.markdown : response.data.markdown;
        } else {
           const d = response.data;
           if (isHandover) {
              contextStr += `[SYSTEM INSTRUCTION: SMART HANDOVER SESSION START]\n`;
              contextStr += `You are assuming the role of an AI operator working on the project "${d.project?.name || 'Unknown'}".\n`;
              contextStr += `This is a session continuation (Handover) brief. First, review the project context below. Your goal is to help move the work forward based on the latest state, tasks, and blockers.\n`;
              contextStr += `Stay aligned with this canonical truth. Prompt the user to occasionally save your useful outputs (summaries, decisions, plans, or further handovers) back into Connectol.\n`;
              contextStr += `Do not treat unpromoted workspace drafts as final truth.\n\n---\n\n`;
           }
           contextStr += `# Project: ${d.project?.name || 'Unknown'}\n`;
           if (d.project?.status) contextStr += `Status: ${d.project.status} | Priority: ${d.project.priority || 'normal'}\n`;
           if (d.project?.description) contextStr += `Description: ${d.project.description}\n`;
           
           if (d.canonical && Object.keys(d.canonical).length > 0) {
             contextStr += `\n## Canonical Context\n`;
             for (const [docType, docData] of Object.entries(d.canonical)) {
               contextStr += `\n### ${docType.toUpperCase()} (v${docData.version || 1})\n`;
               const txt = docData.content || docData.summary || 'No content provided.';
               contextStr += `${txt}\n`;
             }
           }

           if (d.recent_workspace && d.recent_workspace.length > 0) {
             contextStr += `\n## Recent Workspace Inbox\n`;
             d.recent_workspace.forEach(item => {
               // Limit content length in summary to keep context compact
               const shortContent = item.content ? item.content.substring(0, 200).replace(/\n/g, ' ') + (item.content.length > 200 ? '...' : '') : 'Empty content';
               contextStr += `- [${item.entry_type || 'note'}] **${item.title}** (Conf: ${item.confidence || 'medium'}): ${shortContent}\n`;
             });
           }
        }

        navigator.clipboard.writeText(contextStr).then(() => {
          showStatus('context-status', 'Copied to clipboard!', 'success');
        }).catch(err => {
          showStatus('context-status', 'Failed to copy to clipboard', 'error');
        });
      }
    );
  }

  async function captureOutput() {
    if (!config.activeProjectId) {
      showStatus('capture-status', 'Select a project first', 'error');
      return;
    }
    
    let title = document.getElementById('entry-title').value.trim();
    const type = document.getElementById('entry-type').value;
    const confidence = document.getElementById('entry-confidence').value;
    
    btnCapture.disabled = true;
    showStatus('capture-status', 'Scanning page...', '');

    // Get active tab using Promises
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    // Check if we can inject
    if (!tab.url.includes('chatgpt.com') && !tab.url.includes('claude.ai')) {
       showStatus('capture-status', 'Must be on ChatGPT or Claude', 'error');
       btnCapture.disabled = false;
       return;
    }

    try {
      // Execute extraction on the page
      chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_OUTPUT' }, (extractResponse) => {
        if (chrome.runtime.lastError || !extractResponse) {
          showStatus('capture-status', 'Please reload the page first', 'error');
          btnCapture.disabled = false;
          return;
        }
        
        if (!extractResponse.success) {
          showStatus('capture-status', extractResponse.error || 'Failed to extract', 'error');
          btnCapture.disabled = false;
          return;
        }
        
        const { text, provider, url, bestType, bestTitle } = extractResponse.data;
        showStatus('capture-status', 'Pushing to Connectol...', '');
        
        if (!title && bestTitle) title = bestTitle;
        if (!title) {
            showStatus('capture-status', 'Capture requires a title', 'error');
            btnCapture.disabled = false;
            return;
        }
        
        // Push to Connectol
        const payload = {
          title: title,
          entry_type: type,
          content: text,
          confidence: confidence,
          metadata: {
            source: 'connectol_extension_v1',
            provider: provider,
            context_mode: 'compact',
            source_chat_url: url,
            captured_at: new Date().toISOString()
          }
        };
        
        chrome.runtime.sendMessage(
          { action: 'POST_WORKSPACE', projectId: config.activeProjectId, payload: payload },
          (pushResponse) => {
            btnCapture.disabled = false;
            
            if (chrome.runtime.lastError || !pushResponse.success) {
              showStatus('capture-status', pushResponse.error || 'Writeback failed', 'error');
              return;
            }
            
            showStatus('capture-status', 'Captured successfully!', 'success');
            document.getElementById('entry-title').value = ''; // Reset title
          }
        );
      });
    } catch (err) {
      showStatus('capture-status', 'Could not access page', 'error');
      btnCapture.disabled = false;
    }
  }
});
