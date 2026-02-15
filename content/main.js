/**
 * POI Injector Main Entry
 * Orchestrates the lifecycle of the extension on the page.
 * 
 * Event-driven architecture (aligned with master):
 * - Stability loop detects map containers → triggers state.refresh()
 * - state.refresh() sends POI_DATA_UPDATE to bridge via window.postMessage
 * - Bridge announces POI_BRIDGE_READY → events.js triggers state.refresh()
 * - Popup messages and storage changes also trigger state.refresh() via events.js
 * 
 * If the site is disabled at page load, NO code runs and NO DOM is modified.
 * The events listener (events.js) stays active so toggling ON can boot the extension live.
 */
(async function() {
  // Skip iframes — only run in the top-level frame where the map lives
  if (window !== window.top) return;

  // Get or create state manager singleton
  const state = window.getPoiStateManager
    ? window.getPoiStateManager()
    : (window.poiState = new POIStateManager());

  // Initialize state from storage FIRST before doing anything
  await state.initializeState();

  // Check if site is disabled — if so, do NOTHING (no DOM changes, no loops, no bridge)
  const host = window.location.hostname;
  const sitePref = state.preferences.sitePreferences?.[host] || {};
  const siteEnabled = (typeof sitePref.siteEnabled === 'boolean')
    ? sitePref.siteEnabled
    : (typeof sitePref.overlayEnabled === 'boolean' ? sitePref.overlayEnabled : true);

  if (!siteEnabled) {
    console.log('POI Main: Site is disabled, skipping all initialization.');
    // Mark as dormant — events.js toggle-site-enabled handler will boot us
    window.__poiDormant = true;
    return;
  }

  bootExtension(state);
})();

/**
 * Boots the full extension: stability loop, bridge injection.
 * Called on initial load (if enabled) or when toggled ON via events.js.
 */
function bootExtension(state) {
  // Prevent double-boot
  if (window.__poiBooted) return;
  window.__poiBooted = true;
  window.__poiDormant = false;

  console.log('POI Main: Content script loaded. Active groups:', 
    Object.keys(state.activeGroups).filter(k => state.activeGroups[k]));

  // Stability Loop: Monitors for map container presence/change.
  setInterval(() => {
    const d = MapDetector.detectContainer();
    if (d) {
      if (!window.manager || window.manager.container !== d) {
        console.log('POI Main: New map container detected.');
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

  // Inject Bridge Bundle into MAIN world
  try {
    const status = document.documentElement.getAttribute('data-poi-bridge-status');
    if (!status && !document.getElementById('poi-bridge-bundle')) {
      const script = document.createElement('script');
      script.id = 'poi-bridge-bundle';
      script.src = chrome.runtime.getURL('bridge/bridge-bundle.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
      console.log('POI Main: Bridge bundle injected.');
    }
  } catch (e) {
    console.error('POI Main: Failed to inject bridge bundle', e);
  }

  // Listen for messages from popup to reload overlay
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'reload-overlay') {
      console.log('POI Main: Reloading overlay from popup message');
      state.refresh();
      sendResponse({ success: true });
    }
  });
}
