/**
 * POI Bridge: Main Entry
 * Orchestrates the lifecycle of the bridge.
 * 
 * Updated for Phase 7.1: Uses new manager classes and OverlayRegistry
 */
(function() {
  const PREFIX = ' [POI TITAN] ';
  let attempts = 0;
  let registryInitialized = false;

  function extractBounds(map) {
    try {
      const b = map.getBounds();
      if (!b) return null;
      if (b.getNorthEast) return { north: b.getNorthEast().lat(), south: b.getSouthWest().lat(), east: b.getNorthEast().lng(), west: b.getSouthWest().lng() };
      if (b.getNorth) return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
    } catch(e) {}
    return null;
  }

  /**
   * Initializes the overlay registry with factory
   * Only called once when all dependencies are ready
   */
  function initializeRegistry() {
    if (registryInitialized) return;
    
    if (window.overlayRegistry && window.overlayFactory) {
      // Link registry to factory
      window.overlayRegistry.setFactory(window.overlayFactory);
      
      // Register all overlay classes from window
      window.overlayFactory.registerFromWindow();
      
      registryInitialized = true;
      console.log(PREFIX + 'OverlayRegistry initialized with factory');
    }
  }

  function loop() {
    // 1. Dependency Guard
    if (!window.poiHijack || !window.poiDiscovery || !window.poiPortal || !window.poiSniff) {
      if (attempts < 20) {
         attempts++;
         return; 
      }
      console.warn(PREFIX + 'Bridge modules missing after 20s. Manual check required.');
      return;
    }

    // 1.5. Initialize Registry (Phase 7.1)
    initializeRegistry();

    // 2. Initialize Sniffers (Once)
    if (!window.poiSniff.initialized) {
       window.poiSniff.init();
       console.log(PREFIX + 'Omni-Sniffer v12.10 Active');
       document.documentElement.setAttribute('data-poi-bridge-status', 'ONLINE');
    }

    // 3. Capture & Discovery
    try {
      // Force immediate hijack attempt (crucial for document_start)
      window.poiHijack.apply();
      
      // Also apply discovery (throttled inside run() if maps exist)
      window.poiDiscovery.run();
      
    // 4. Update Portal from captured instances
      for (const map of window.poiHijack.activeMaps) {
        const res = extractBounds(map);
        if (res && res.north) { 
          window.poiPortal.update(res, 'instance-capture'); 
          
          // Phase 6.5: Also update bounds in registry (does NOT change domain/overlay)
          if (window.overlayRegistry) {
            window.overlayRegistry.updateBounds(map, res);
          }
          break; 
        }
      }
      
      // 5. Renderer Check - Use registry-based overlays first, fallback to legacy renderer
      if (window.overlayRegistry) {
        const activeEntries = window.overlayRegistry.getActiveEntries();
        for (const entry of activeEntries) {
          if (entry.overlay && window.poiRenderer?.lastPoiData?.length > 0) {
            // Use the entry's overlay for rendering
            entry.overlay.renderMarkers(window.poiRenderer.lastPoiData, entry.mapInstance);
          }
        }
      } else if (window.poiRenderer && window.poiRenderer.lastPoiData.length > 0) {
         // Legacy fallback
         window.poiRenderer.update(window.poiRenderer.lastPoiData);
      }
    } catch(e) {
      console.error(PREFIX + 'Main loop failure:', e);
    }
  }

  // Start Orchestration
  // 1000ms interval: Reduced frequency as native markers are persistent and fluid
  setInterval(loop, 1000); 
  
  // Periodic registry cleanup (every 5 minutes)
  setInterval(() => {
    if (window.overlayRegistry) {
      window.overlayRegistry.cleanup();
    }
  }, 300000);
  
  // Listen for Data from Content Script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'POI_DATA_UPDATE') {
       // Phase 7.1: Route to registry-based overlays first
       if (window.overlayRegistry) {
          const entries = window.overlayRegistry.getActiveEntries();
          for (const entry of entries) {
            if (entry.overlay) {
              entry.overlay.renderMarkers(event.data.pois, entry.mapInstance);
            }
          }
       }
       
       // Legacy fallback
       if (window.poiRenderer) {
          window.poiRenderer.update(event.data.pois);
          // Signal back success that native renderer is active
          if (window.poiHijack.activeMaps.size > 0) {
             window.postMessage({ type: 'POI_NATIVE_ACTIVE' }, '*');
          }
       }
    }
  });
  
  // Force immediate apply on script load
  if (window.poiHijack) window.poiHijack.apply();
  
  loop();
})();
