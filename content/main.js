/**
 * POI Injector Main Entry
 * Orchestrates the lifecycle of the extension on the page.
 * 
 * Updated for Phase 7.2: Uses POIStateManager class
 */
(function() {
  console.log('POI Main: Content script loaded and executing.');
  
  // Phase 7.2: Use POIStateManager instance (either from window or create new)
  const state = window.poiState || (window.poiState = new POIStateManager());

  // Stability Loop: Monitors for map container presence/change
  setInterval(() => {
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

  // Inject Bridge Logic into MAIN world manually (Primary Strategy)
  try {
     const status = document.documentElement.getAttribute('data-poi-bridge-status');
     if (!status) {
        console.log('POI Main: Injecting bridge bundle (Force Strategy)...');
        
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('bridge/bridge-bundle.js');
        script.onload = () => script.remove();
        (document.head || document.documentElement).appendChild(script);
        console.log('POI Main: Bundle script tag appended');
     }
  } catch(e) {
     console.error('POI Main: Failed to inject bridge scripts', e);
  }

  // Initialize - use class method if available
  if (typeof state.initializeState === 'function') {
    state.initializeState().then(() => {
      state.refresh();
    });
  } else if (typeof state.initialize === 'function') {
    // ManagerBase pattern
    state.initialize().then(() => {
      state.refresh();
    });
  }
})();
