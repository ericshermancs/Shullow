/**
 * POI Injector State Module
 * Manages preferences, active groups, and coordinate state.
 */
let activeGroups = {}; 
let preferences = {
  overlayEnabled: true,
  debugEnabled: false,
  sitePreferences: {},
  groupStyles: {},
  accentColor: '#d1ff00'
};
let nativeMode = false;
let globalBounds = null;
let globalMethod = 'searching...';
let lastMessageTime = 0;

async function initializeState() {
  try {
    const state = await chrome.storage.local.get(['activeGroups', 'preferences']);
    if (state.activeGroups) activeGroups = state.activeGroups;
    if (state.preferences) preferences = { ...preferences, ...state.preferences };
    if (window.manager) { 
      window.manager.updateVisibility(); 
      window.manager.render(); 
    }
  } catch (e) {
    console.error('POI State: Initialization failed', e);
  }
}

async function refresh() {
  try {
    const state = await chrome.storage.local.get(['activeGroups', 'preferences']);
    activeGroups = state.activeGroups || {}; 
    preferences = { ...preferences, ...(state.preferences || {}) };

    if (window.manager) {
      window.manager.updateVisibility();
    }

    const selected = Object.keys(activeGroups).filter(k => activeGroups[k]);
    if (selected.length === 0) { 
      if (window.manager) {
        window.manager.markerData = [];
        window.manager.render(); 
      }
      return; 
    }
    
    const data = await chrome.storage.local.get(['poiGroups']);
    const all = [];
    selected.forEach(g => {
      const groupPois = (data.poiGroups?.[g] || []).map(p => ({ ...p, groupName: g }));
      all.push(...groupPois);
    });
    if (window.manager) window.manager.load(all);
    
    // Bridge Sync: Send POI data to the main world for native rendering
    window.postMessage({
      type: 'POI_DATA_UPDATE',
      pois: all.map(p => {
        const style = preferences.groupStyles[p.groupName] || {};
        return {
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          color: style.color || preferences.accentColor,
          secondaryColor: style.secondaryColor || '#ffffff',
          logoData: style.logoData // Send logo URL/SVG
        };
      })
    }, '*');
  } catch (e) {
    console.error('POI State: Refresh failed', e);
  }
}

// Export to global scope for other modules (since we use manifest-based inclusion)
window.poiState = {
  get activeGroups() { return activeGroups; },
  set activeGroups(val) { activeGroups = val; },
  get preferences() { return preferences; },
  set preferences(val) { preferences = val; },
  get nativeMode() { return nativeMode; },
  set nativeMode(val) { nativeMode = val; },
  get globalBounds() { return globalBounds; },
  set globalBounds(val) { globalBounds = val; },
  get globalMethod() { return globalMethod; },
  set globalMethod(val) { globalMethod = val; },
  get lastMessageTime() { return lastMessageTime; },
  set lastMessageTime(val) { lastMessageTime = val; },
  initializeState,
  refresh
};
