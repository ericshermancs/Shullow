/**
 * POI Injector Events Module
 * Handles message passing and storage synchronization.
 */
(function() {
  const getEffectiveHost = () => {
    if (window.top === window) return window.location.hostname;
    try {
      if (document.referrer) return new URL(document.referrer).hostname;
    } catch (e) {}
    return window.location.hostname;
  };
  const host = getEffectiveHost();
  let lastMessageUpdate = 0; // Track last message-based update to prevent double refresh
  let storageRefreshPending = false; // Debounce storage listener refreshes
  let storageRefreshTimer = null;
  let fullListenersRegistered = false;
  let messageListener = null;
  let storageListener = null;
  let windowMessageListener = null;

  const getSiteEnabledFromPrefs = (preferences) => {
    const sitePref = preferences?.sitePreferences?.[host];
    if (sitePref && typeof sitePref.siteEnabled === 'boolean') return sitePref.siteEnabled;
    if (sitePref && typeof sitePref.overlayEnabled === 'boolean') return sitePref.overlayEnabled;
    return true;
  };

  const getController = () => {
    if (!window.__poiController) {
      window.__poiController = {
        enabled: false,
        start() {},
        stop() {},
        injectBridgeBundle() {},
        enableBridge() {},
        disableBridge() {}
      };
    }
    return window.__poiController;
  };
  
  // Check if listener is already registered
  if (window.__poiEventsListenerRegistered) {
    return;
  }
  window.__poiEventsListenerRegistered = true;

  // 1. Minimal Message Listener (toggle only)
  chrome.runtime.onMessage.addListener((msg, sender, resp) => {
    if (msg.action === 'toggle-site-enabled') {
      if (msg.host && msg.host !== host) {
        resp({ status: 'ignored' });
        return true;
      }
      const controller = getController();
      if (msg.enabled) {
        controller.start();
        registerFullListeners();
      } else {
        controller.stop();
        unregisterFullListeners();
      }
      resp({ status: 'ok' });
      return true;
    }
    return true;
  });

  const registerFullListeners = () => {
    if (fullListenersRegistered) return;
    fullListenersRegistered = true;

    messageListener = (msg, sender, resp) => {
      if (msg.action === 'update-active-groups' || msg.action === 'refresh-pois') {
        // Only respond in the main frame (window.top === window) to avoid processing in iframes
        if (window.top !== window) {
          return;
        }
        if (!getController().enabled) {
          resp({ status: 'disabled' });
          return true;
        }
        const state = window.getPoiStateManager ? window.getPoiStateManager() : window.poiState;
        if (!state) {
          resp({ status: 'no-state' });
          return true;
        }
        if (msg.activeGroups) state.activeGroups = msg.activeGroups;
        if (msg.preferences) state.preferences = msg.preferences;
        lastMessageUpdate = Date.now();
        state._skipStorageRead = true;
        storageRefreshPending = false;
        if (storageRefreshTimer) clearTimeout(storageRefreshTimer);
        const styleChanged = !!(msg.preferences && msg.preferences.groupStyles);
        const styleChangedGroup = msg.styleChangedGroup || null;
        console.log(`[EVENTS] Message received: styleChanged=${styleChanged}, styleChangedGroup=${styleChangedGroup}, groupStyles=${Object.keys(msg.preferences?.groupStyles || {}).join(',')}`);
        state.refresh({ styleChanged, styleChangedGroup }).then(() => resp({ status: 'ok' }));
      }
      return true;
    };

    storageListener = (changes, area) => {
      if (area === 'local') {
        const controller = getController();
        if (changes.preferences) {
          const nextEnabled = getSiteEnabledFromPrefs(changes.preferences.newValue || {});
          if (nextEnabled && !controller.enabled) {
            controller.start();
          } else if (!nextEnabled && controller.enabled) {
            controller.stop();
          }
        }

        // Only process in main frame to avoid duplicate refreshes from iframes
        if (window.top !== window) {
          return; // Ignore storage changes in iframes
        }

        if (!controller.enabled) {
          return; // Do not refresh overlays when disabled
        }

        const state = window.getPoiStateManager ? window.getPoiStateManager() : window.poiState;
        if (!state) return;

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
            }
            storageRefreshTimer = setTimeout(() => {
              storageRefreshPending = false;
              storageRefreshTimer = null;
              state.refresh();
            }, 50); // 50ms debounce to catch rapid storage changes
            storageRefreshPending = true;
          }
        }
        // Also refresh when POI data changes (new group added, group deleted, rename, etc.)
        if (changes.poiGroups) {
          // Always invalidate cache so renames are reflected immediately
          state._poiCache = null;
          state._poiCacheTime = 0;

          const activeGroups = Object.keys(state._activeGroups).filter(g => state._activeGroups[g]);
          const currentPoiKeys = Object.keys(changes.poiGroups.newValue || {});
          const deletedActiveGroup = activeGroups.find(g => !currentPoiKeys.includes(g));
          
          if (deletedActiveGroup && window.manager && window.manager.markerData.length > 0) {
            window.manager.removeMarkersForGroup(deletedActiveGroup);
            
            const filtered = window.manager.markerData.filter(p => p.groupName !== deletedActiveGroup);
            window.manager.markerData = filtered;
            
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
          } else {
            if (!skipRefresh) {
              if (storageRefreshTimer) clearTimeout(storageRefreshTimer);
              storageRefreshTimer = setTimeout(() => {
                storageRefreshPending = false;
                storageRefreshTimer = null;
                state.refresh();
              }, 50);
              storageRefreshPending = true;
            }
          }
        }
      }
    };

    windowMessageListener = (event) => {
      if (!getController().enabled) return;
      const state = window.getPoiStateManager ? window.getPoiStateManager() : window.poiState;
      if (!state) return;

      if (event.data) {
        if (event.data.type === 'POI_BOUNDS_UPDATE') {
          state.globalBounds = event.data.bounds;
          state.globalMethod = event.data.method + (event.data.isIframe ? ' (IFRAME)' : '');
          state.lastMessageTime = Date.now();
          if (window.manager) window.manager.extractBounds();
        } else if (event.data.type === 'POI_NATIVE_ACTIVE') {
          if (!state.nativeMode) {
            state.nativeMode = true;
            if (window.manager) window.manager.render();
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
    };

    chrome.runtime.onMessage.addListener(messageListener);
    chrome.storage.onChanged.addListener(storageListener);
    window.addEventListener('message', windowMessageListener);
  };

  const unregisterFullListeners = () => {
    if (!fullListenersRegistered) return;
    fullListenersRegistered = false;
    if (messageListener) chrome.runtime.onMessage.removeListener(messageListener);
    if (storageListener) chrome.storage.onChanged.removeListener(storageListener);
    if (windowMessageListener) window.removeEventListener('message', windowMessageListener);
    messageListener = null;
    storageListener = null;
    windowMessageListener = null;
  };

  // Register full listeners if already enabled
  chrome.storage.local.get(['preferences']).then(({ preferences }) => {
    if (getSiteEnabledFromPrefs(preferences)) {
      registerFullListeners();
    }
  }).catch(() => {});
})();
