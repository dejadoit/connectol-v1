async function getConfig() {
  const data = await chrome.storage.local.get(['apiUrl', 'apiKey', 'activeProjectId']);
  return {
    apiUrl: data.apiUrl || 'https://acewlqwzbjvjxssdmdlx.supabase.co/functions/v1/connectol',
    apiKey: data.apiKey || '',
    activeProjectId: data.activeProjectId || null
  };
}

async function fetchWithAuth(endpoint, options = {}) {
  const config = await getConfig();
  if (!config.apiKey || !config.apiUrl) {
    throw new Error('Connectol API Key or URL is missing.');
  }

  const baseUrl = config.apiUrl.replace(/\/$/, '');
  const url = `${baseUrl}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    let errorMsg = `API Error: ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody.error) errorMsg = errBody.error;
    } catch(e) {}
    throw new Error(errorMsg);
  }

  return response.json();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_PROJECTS') {
    fetchWithAuth('/projects')
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (request.action === 'GET_CONTEXT') {
    if (!request.projectId) {
      sendResponse({ success: false, error: 'No project selected.' });
      return;
    }
    fetchWithAuth(`/projects/${request.projectId}/context`)
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'POST_WORKSPACE') {
    if (!request.projectId) {
      sendResponse({ success: false, error: 'No project selected.' });
      return;
    }
    fetchWithAuth(`/projects/${request.projectId}/workspace`, {
      method: 'POST',
      body: JSON.stringify(request.payload)
    })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
