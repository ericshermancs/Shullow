/**
 * POI Injector Events Module
 * Handles message passing and storage synchronization.
 */
(function() {
  const state = window.poiState;

  // 1. Message from Popup
  chrome.runtime.onMessage.addListener((msg, sender, resp) => {
    if (msg.action === 'update-active-groups' || msg.action === 'refresh-pois') { 
      if (msg.activeGroups) state.activeGroups = msg.activeGroups;
      if (msg.preferences) state.preferences = msg.preferences;
      state.refresh().then(() => resp({ status: 'ok' }));
    }
    return true; 
  });

  // 2. Storage Changes (Real-time sync between tabs)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.preferences) {
        state.preferences = { ...state.preferences, ...(changes.preferences.newValue || {}) };
        if (window.manager) {
          window.manager.updateVisibility();
          window.manager.render();
        }
      }
      if (changes.activeGroups) {
        state.activeGroups = changes.activeGroups.newValue || state.activeGroups;
        state.refresh();
      }
    }
  });

  // 3. Portal Updates (from Bridge)
  window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'POI_BOUNDS_UPDATE') {
          state.globalBounds = event.data.bounds;
          state.globalMethod = event.data.method + (event.data.isIframe ? ' (IFRAME)' : '');
          state.lastMessageTime = Date.now();
          if (window.manager) window.manager.extractBounds();
      }
  });
})();
