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
    if (!window.poiHijack || !window.poiDiscovery || !window.poiPortal) {
      if (attempts < 20) {
         attempts++;
         return; 
      }
      console.warn(PREFIX + 'Bridge modules missing after 20s. Manual check required.');
      return;
    }

    // 1.5. Initialize Registry (Phase 7.1)
    initializeRegistry();

    // 2. Setup Bridge Status
    if (!window.poiBridgeReady) {
       window.poiBridgeReady = true;
       console.log(PREFIX + 'POI Bridge v7.1 Active (Secure Mode - No Network Sniffing)');
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
      
      // 4.5. PRE-RENDER CHECK: Before rendering overlays, check if native markers are available
      // This ensures we switch to native pins automatically as soon as they appear
      if (window.overlayRegistry) {
        const activeEntries = window.overlayRegistry.getActiveEntries();
        for (const entry of activeEntries) {
          if (entry.overlay) {
            // Trigger native marker detection check with count verification
            const selector = entry.overlay._getNativeMarkerSelector?.();
            if (selector) {
              const nativeMarkers = document.querySelectorAll(selector);
              if (nativeMarkers.length > 0) {
                // Native markers detected! Set flag and clear overlay
                if (!entry.overlay._nativeMarkersInjected) {
                  entry.overlay._nativeMarkersInjected = true;
                  console.log(PREFIX + `Native markers detected (pre-render check: ${nativeMarkers.length} found), clearing overlay`);
                  entry.overlay.clear();
                }
              }
            }
          }
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
  // 500ms interval: Fast enough to catch native marker injection within ~500ms window
  setInterval(loop, 500); 
  
  // Periodic registry cleanup (every 5 minutes)
  setInterval(() => {
    if (window.overlayRegistry) {
      window.overlayRegistry.cleanup();
    }
  }, 300000);
  
  // Listen for Data from Content Script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'POI_DATA_UPDATE') {
       let nativeRenderSuccess = false;
       
       // Phase 7.1: Route to registry-based overlays first
       if (window.overlayRegistry) {
          const entries = window.overlayRegistry.getActiveEntries();
          for (const entry of entries) {
            if (entry.overlay && entry.mapInstance) {
              entry.overlay.renderMarkers(event.data.pois, entry.mapInstance);
              // If we have active markers after render, native mode is working
              const hasActiveMarkers = 
                (entry.overlay.activeMarkers && entry.overlay.activeMarkers.size > 0) ||
                (entry.overlay.activeElements && entry.overlay.activeElements.size > 0);
              if (hasActiveMarkers) {
                nativeRenderSuccess = true;
              }
            }
          }
          // Signal native mode active if we successfully rendered native markers
          if (nativeRenderSuccess) {
            window.postMessage({ type: 'POI_NATIVE_ACTIVE' }, '*');
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
