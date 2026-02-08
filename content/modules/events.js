/**
 * POI Injector Events Module
 * Central event coordination hub — all event-driven communication flows through here.
 * 
 * Event sources:
 * 1. Popup → Content: chrome.runtime.onMessage (update-active-groups, refresh-pois)
 * 2. Storage changes: chrome.storage.onChanged (cross-tab sync)
 * 3. Bridge → Content: window.postMessage (POI_BRIDGE_READY, POI_BOUNDS_UPDATE, marker events)
 */
(function() {
  // Skip iframes
  if (window !== window.top) return;

  // Prevent double registration
  if (window.__poiEventsListenerRegistered) return;
  window.__poiEventsListenerRegistered = true;

  const getState = () => {
    return window.getPoiStateManager ? window.getPoiStateManager() : window.poiState;
  };

  let lastMessageUpdate = 0;
  let storageRefreshTimer = null;

  // ─── 1. Chrome Runtime Messages (from Popup) ────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, resp) => {
    if (msg.action === 'update-active-groups' || msg.action === 'refresh-pois') {
      const state = getState();
      if (!state) {
        resp({ status: 'no-state' });
        return true;
      }

      if (msg.activeGroups) state.activeGroups = msg.activeGroups;
      if (msg.preferences) state.preferences = msg.preferences;
      lastMessageUpdate = Date.now();
      state._skipStorageRead = true;
      if (storageRefreshTimer) clearTimeout(storageRefreshTimer);

      const styleChanged = !!(msg.preferences && msg.preferences.groupStyles);
      const styleChangedGroup = msg.styleChangedGroup || null;

      // If style changed for an active group, do remove-then-readd to force re-render
      if (styleChanged && styleChangedGroup && state.activeGroups[styleChangedGroup]) {
        const wasActive = state.activeGroups[styleChangedGroup];
        state.activeGroups[styleChangedGroup] = false;
        state._skipStorageRead = true;
        state.refresh().then(async () => {
          state.activeGroups[styleChangedGroup] = wasActive;
          state._poiCache = null;
          state._poiCacheTime = 0;
          state._skipStorageRead = true;
          await state.refresh();
          resp({ status: 'ok' });
        });
      } else {
        state.refresh().then(() => resp({ status: 'ok' }));
      }
      return true;
    }

    if (msg.action === 'toggle-site-enabled') {
      const state = getState();
      if (state) {
        if (msg.preferences) state.preferences = msg.preferences;
        state._skipStorageRead = false; // Force storage read to get latest siteEnabled
        state.refresh().then(() => resp({ status: 'ok' }));
      } else {
        resp({ status: 'no-state' });
      }
      return true;
    }

    return true;
  });

  // ─── 2. Storage Changes (cross-tab sync, preference updates) ────────
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    const state = getState();
    if (!state) return;

    // Skip if this is the same update we just handled via message
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
        if (storageRefreshTimer) clearTimeout(storageRefreshTimer);
        storageRefreshTimer = setTimeout(() => {
          storageRefreshTimer = null;
          state.refresh();
        }, 50);
      }
    }

    if (changes.poiGroups) {
      // Invalidate cache so renames/deletes are reflected immediately
      state._poiCache = null;
      state._poiCacheTime = 0;

      if (!skipRefresh) {
        if (storageRefreshTimer) clearTimeout(storageRefreshTimer);
        storageRefreshTimer = setTimeout(() => {
          storageRefreshTimer = null;
          state.refresh();
        }, 50);
      }
    }
  });

  // ─── 3. Bridge Events (from main world via window.postMessage) ──────
  window.addEventListener('message', (event) => {
    if (!event.data) return;
    const state = getState();

    switch (event.data.type) {
      case 'POI_BRIDGE_READY':
        // Bridge just loaded and is ready to receive data.
        // Re-send POI data so the bridge gets it even if the initial send was lost.
        console.log('[EVENTS] Bridge ready signal received, triggering state.refresh()');
        if (state) state.refresh();
        break;

      case 'POI_BOUNDS_UPDATE':
        // Bridge reporting map bounds from captured map instances
        if (state) {
          state.globalBounds = event.data.bounds;
          state.globalMethod = event.data.method || 'bridge';
          state.lastMessageTime = Date.now();
        }
        if (window.manager) window.manager.extractBounds();
        break;

      case 'POI_MARKER_CLICK':
        if (window.manager?.handleNativeClick) {
          window.manager.handleNativeClick(event.data.id, event.data.lat, event.data.lng);
        }
        break;

      case 'POI_MARKER_HOVER':
        if (window.manager?.handleNativeHover) {
          window.manager.handleNativeHover(event.data.id, event.data.lat, event.data.lng);
        }
        break;

      case 'POI_MARKER_LEAVE':
        if (window.manager?.handleNativeLeave) {
          window.manager.handleNativeLeave(event.data.id);
        }
        break;
    }
  });

  console.log('[EVENTS] Event listeners registered');
})();
