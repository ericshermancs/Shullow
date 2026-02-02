/**
 * POI Injector Events Module
 * Handles message passing and storage synchronization.
 */
(function() {
  const state = window.poiState;
  let lastMessageUpdate = 0; // Track last message-based update to prevent double refresh
  let storageRefreshPending = false; // Debounce storage listener refreshes
  let storageRefreshTimer = null;
  
  // Check if listener is already registered
  if (window.__poiEventsListenerRegistered) {
    console.log('[POI DEBUG] WARNING: Events listener being registered again! Previous instance still active.');
    return;
  }
  window.__poiEventsListenerRegistered = true;
  console.log('[POI DEBUG] Events listener registered');

  // 1. Message from Popup
  chrome.runtime.onMessage.addListener((msg, sender, resp) => {
    if (msg.action === 'update-active-groups' || msg.action === 'refresh-pois') {
      // Only respond in the main frame (window.top === window) to avoid processing in iframes
      if (window.top !== window) {
        console.log('[POI DEBUG] Message in iframe, ignoring (main frame should handle)');
        return;
      }
      console.log(`[POI DEBUG] Message listener: ${msg.action}, from=${sender.url}, activeGroups=${msg.activeGroups ? Object.keys(msg.activeGroups).join(',') : 'none'}`);
      if (msg.activeGroups) state.activeGroups = msg.activeGroups;
      if (msg.preferences) state.preferences = msg.preferences;
      lastMessageUpdate = Date.now();
      state._skipStorageRead = true; // Tell refresh() we already have the data
      storageRefreshPending = false; // Cancel any pending storage refresh
      if (storageRefreshTimer) clearTimeout(storageRefreshTimer);
      state.refresh().then(() => resp({ status: 'ok' }));
    }
    return true; 
  });

  // 2. Storage Changes (Real-time sync between tabs)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      // Only process in main frame to avoid duplicate refreshes from iframes
      if (window.top !== window) {
        return; // Ignore storage changes in iframes
      }
      
      // Skip if this is the same update we just handled via message (within 2 seconds to account for slow storage reads)
      const skipRefresh = (Date.now() - lastMessageUpdate) < 2000;
      
      if (changes.preferences) {
        state.preferences = { ...state.preferences, ...(changes.preferences.newValue || {}) };
        if (window.manager && !skipRefresh) {
          window.manager.updateVisibility();
          window.manager.render();
        }
      }
      if (changes.activeGroups) {
        state.activeGroups = changes.activeGroups.newValue || state.activeGroups;
        if (!skipRefresh) {
          // Debounce: only schedule one refresh, clear previous timer
          if (storageRefreshTimer) {
            clearTimeout(storageRefreshTimer);
            console.log('[POI DEBUG] Storage listener: canceling previous pending refresh, scheduling new one');
          }
          storageRefreshTimer = setTimeout(() => {
            console.log('[POI DEBUG] Storage listener triggering refresh for activeGroups change');
            storageRefreshPending = false;
            storageRefreshTimer = null;
            state.refresh();
          }, 50); // 50ms debounce to catch rapid storage changes
          storageRefreshPending = true;
        } else {
          console.log('[POI DEBUG] Storage listener skipping refresh (recent message update)');
        }
      }
      // Also refresh when POI data changes (new group added, group deleted, etc.)
      if (changes.poiGroups) {
        console.log('[POI DEBUG] poiGroups changed in storage');
        
        // Check if a group that's currently active was deleted
        const activeGroups = Object.keys(state._activeGroups).filter(g => state._activeGroups[g]);
        const currentPoiKeys = Object.keys(changes.poiGroups.newValue || {});
        const deletedActiveGroup = activeGroups.find(g => !currentPoiKeys.includes(g));
        
        if (deletedActiveGroup) {
          console.log(`[POI DEBUG] Active group "${deletedActiveGroup}" was deleted, filtering markers`);
          // A group that was active was deleted - filter it out from existing markers
          if (state._poiCache) {
            // Remove deleted group from cache
            delete state._poiCache[deletedActiveGroup];
          }
          
          // Just remove markers from the deleted group, don't re-render all
          if (window.manager && window.manager.markerData.length > 0) {
            window.manager.removeMarkersForGroup(deletedActiveGroup);
            
            // Filter the marker data
            const filtered = window.manager.markerData.filter(p => p.groupName !== deletedActiveGroup);
            window.manager.markerData = filtered;
            
            // Also update bridge
            const bridgeFiltered = filtered.map(p => {
              const style = state._preferences.groupStyles[p.groupName] || {};
              return {
                id: p.id,
                name: p.name,
                latitude: p.latitude,
                longitude: p.longitude,
                color: style.color || state._preferences.accentColor,
                secondaryColor: style.secondaryColor || '#ffffff',
                logoData: style.logoData
              };
            });
            
            window.postMessage({
              type: 'POI_DATA_UPDATE',
              pois: bridgeFiltered
            }, '*');
          }
        } else {
          console.log('[POI DEBUG] Deleted group was not active, no refresh needed');
          // Deleted group wasn't active, just invalidate cache in case it's re-added
          state._poiCache = null;
          state._poiCacheTime = 0;
        }
      }
    }
  });

  // 3. Portal Updates (from Bridge)
  window.addEventListener('message', (event) => {
      if (event.data) {
        if (event.data.type === 'POI_BOUNDS_UPDATE') {
          state.globalBounds = event.data.bounds;
          state.globalMethod = event.data.method + (event.data.isIframe ? ' (IFRAME)' : '');
          state.lastMessageTime = Date.now();
          if (window.manager) window.manager.extractBounds();
        } else if (event.data.type === 'POI_NATIVE_ACTIVE') {
          if (!state.nativeMode) {
             console.log('[POI TITAN] Native rendering active. Switching off DOM overlay.');
             state.nativeMode = true;
             if (window.manager) window.manager.render(); // Re-render to clear DOM pins
          }
        } else if (event.data.type === 'POI_MARKER_CLICK') {
           if (window.manager) {
              window.manager.handleNativeClick(event.data.id, event.data.lat, event.data.lng);
           }
        } else if (event.data.type === 'POI_MARKER_HOVER') {
           if (window.manager) {
              window.manager.handleNativeHover(event.data.id, event.data.lat, event.data.lng);
           }
        } else if (event.data.type === 'POI_MARKER_LEAVE') {
           if (window.manager) {
              window.manager.handleNativeLeave(event.data.id);
           }
        }
      }
  });
})();
