/**
 * POI Injector Main Entry
 * Orchestrates the lifecycle of the extension on the page.
 * 
 * Event-driven architecture (aligned with master):
 * - Stability loop detects map containers → triggers state.refresh()
 * - state.refresh() sends POI_DATA_UPDATE to bridge via window.postMessage
 * - Bridge announces POI_BRIDGE_READY → events.js triggers state.refresh()
 * - Popup messages and storage changes also trigger state.refresh() via events.js
 */
(async function() {
  // Skip iframes — only run in the top-level frame where the map lives
  if (window !== window.top) return;

  console.log('POI Main: Content script loaded.');

  // Get or create state manager singleton
  const state = window.getPoiStateManager
    ? window.getPoiStateManager()
    : (window.poiState = new POIStateManager());

  // Initialize state from storage FIRST before starting any loops
  await state.initializeState();
  console.log('POI Main: State initialized. Active groups:', 
    Object.keys(state.activeGroups).filter(k => state.activeGroups[k]));

  // Stability Loop: Monitors for map container presence/change.
  // This is the primary driver — when a new container is detected,
  // state.refresh() sends POI data to the bridge.
  // NOTE: We do NOT call state.refresh() eagerly here. The first refresh
  // happens either when a container is detected (below) or when the bridge
  // announces readiness (via POI_BRIDGE_READY in events.js).
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
})();
