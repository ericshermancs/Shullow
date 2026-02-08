/**
 * POI Injector Main Entry
 * Orchestrates the lifecycle of the extension on the page.
 * 
 * Updated for Phase 7.2: Uses POIStateManager class
 */
(async function() {

  const getEffectiveHost = () => {
    if (window.top === window) return window.location.hostname;
    try {
      if (document.referrer) return new URL(document.referrer).hostname;
    } catch (e) {}
    return window.location.hostname;
  };
  const host = getEffectiveHost();
  let state = null;

  const getSiteEnabledFromPrefs = (preferences) => {
    const sitePref = preferences?.sitePreferences?.[host];
    if (sitePref && typeof sitePref.siteEnabled === 'boolean') return sitePref.siteEnabled;
    if (sitePref && typeof sitePref.overlayEnabled === 'boolean') return sitePref.overlayEnabled;
    return true;
  };

  const controller = window.__poiController || {
    enabled: false,
    intervalId: null,
    injectBridgeBundle() {
      try {
        const status = document.documentElement.getAttribute('data-poi-bridge-status');
        if (status === 'ONLINE') return;
        if (document.getElementById('poi-bridge-bundle')) return;
        const script = document.createElement('script');
        script.id = 'poi-bridge-bundle';
        script.src = chrome.runtime.getURL('bridge/bridge-bundle.js');
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
      } catch (e) {
        console.error('POI Main: Failed to inject bridge bundle', e);
      }
    },
    async start() {
      if (this.enabled) return;
      this.enabled = true;

      console.log('POI Main: Enabled for site, starting.');

      this.injectBridgeBundle();
      this.enableBridge();

      if (!state) {
        if (window.getPoiStateManager) {
          state = window.getPoiStateManager();
        } else if (typeof POIStateManager !== 'undefined') {
          state = window.poiState || (window.poiState = new POIStateManager());
        }
      }

      if (!state) {
        console.error('POI Main: POIStateManager unavailable, aborting start');
        this.enabled = false;
        return;
      }

      if (typeof state.initializeState === 'function') {
        await state.initializeState();
        console.log('POI Main: State initialized. Active groups:', Object.keys(state.activeGroups).filter(k => state.activeGroups[k]));
      } else if (typeof state.initialize === 'function') {
        await state.initialize();
      }

      await state.refresh();

      if (!this.intervalId) {
        this.intervalId = setInterval(() => {
          const d = MapDetector.detectContainer();
          if (d) {
            if (!window.manager || window.manager.container !== d) {
              console.log('POI Main: New map container detected. Re-booting...');
              if (window.manager) window.manager.destroy();
              window.manager = new OverlayManager(d);
              state.refresh();
            } else {
              window.manager.sync();
            }
          } else if (window.manager) {
            console.log('POI Main: Map container lost.');
            window.manager.destroy();
            window.manager = null;
          }
        }, 250);
      }
    },
    stop() {
      if (!this.enabled) return;
      this.enabled = false;

      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }

      if (window.manager) {
        window.manager.destroy();
        window.manager = null;
      }

      if (window.poiState) {
        window.poiState.nativeMode = false;
      }

      // Clear native markers and overlay markers immediately
      window.postMessage({ type: 'POI_DATA_UPDATE', pois: [] }, '*');

      this.disableBridge();
    },
    enableBridge() {
      try {
        window.postMessage({ type: 'POI_BRIDGE_ENABLE', enabled: true }, '*');
      } catch (e) {
        console.error('POI Main: Failed to enable bridge', e);
      }
    },
    disableBridge() {
      try {
        window.postMessage({ type: 'POI_BRIDGE_ENABLE', enabled: false }, '*');
      } catch (e) {
        console.error('POI Main: Failed to disable bridge', e);
      }
    }
  };

  window.__poiController = controller;

  try {
    const { preferences } = await chrome.storage.local.get(['preferences']);
    const enabled = getSiteEnabledFromPrefs(preferences);
    if (enabled) {
      controller.start();
    } else {
      controller.stop();
    }
  } catch (e) {
    console.error('POI Main: Failed to read preferences, defaulting to enabled', e);
    controller.start();
  }
})();
