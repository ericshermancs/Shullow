/**
 * POI Bridge: Main Entry
 * Orchestrates the lifecycle of the bridge in the page's MAIN world.
 * 
 * Event-driven architecture:
 * - Bridge starts immediately on script load
 * - Announces readiness via POI_BRIDGE_READY → content script responds with POI data
 * - Listens for POI_DATA_UPDATE from content script → renders via poiRenderer (native markers)
 * - Loop continuously re-renders from cached POI data for any newly discovered maps
 * 
 * Rendering: ALL rendering goes through window.poiRenderer (poi-native-marker).
 * Site configurations from siteConfig.js provide per-site styles, selectors, and features.
 */
(function() {
  const PREFIX = '[BRIDGE] ';
  let attempts = 0;
  let registryInitialized = false;
  let lastReceivedPois = []; // Cache POIs received from content script

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
   * Initializes the overlay registry
   * Only called once when all dependencies are ready
   */
  function initializeRegistry() {
    if (registryInitialized) return;
    
    if (window.overlayRegistry) {
      registryInitialized = true;
      console.log(PREFIX + 'OverlayRegistry initialized');
    }
  }

  let loopCount = 0;
  function loop() {
    loopCount++;
    // Log heartbeat every 20 iterations (10 seconds)
    if (loopCount % 20 === 0) {
      const maps = window.poiHijack ? window.poiHijack.activeMaps.size : '?';
      console.log(`${PREFIX}heartbeat #${loopCount}: maps=${maps}, cachedPois=${lastReceivedPois.length}`);
    }

    // 1. Dependency Guard
    if (!window.poiHijack || !window.poiDiscovery || !window.poiPortal) {
      if (attempts < 20) {
         attempts++;
         return; 
      }
      console.warn(PREFIX + 'Bridge modules missing after 20s.');
      return;
    }

    // 2. Initialize Registry (once) — still used for domain detection & bounds tracking
    initializeRegistry();
    
    // 3. RE-HIJACK: Try to hijack Google Maps if it loaded after initial attempt
    if (window.google?.maps?.Map && !window.google.maps.Map._isHijacked) {
      console.log(PREFIX + 'Google Maps now available, hijacking...');
      window.poiHijack.hijackGoogle(window.google.maps);
    }

    // 4. Announce bridge readiness (once)
    if (!window.poiBridgeReady) {
       window.poiBridgeReady = true;
       console.log(PREFIX + 'POI Bridge Active');
       document.documentElement.setAttribute('data-poi-bridge-status', 'ONLINE');
       // Event: Tell content script we're ready to receive POI data
       window.postMessage({ type: 'POI_BRIDGE_READY' }, '*');
    }

    // 5. Capture & Discovery (isolated try-catches)
    try {
      window.poiHijack.apply();
    } catch(e) {
      console.error(PREFIX + 'Hijack error:', e);
    }
    
    try {
      window.poiDiscovery.run();
    } catch(e) {
      console.error(PREFIX + 'Discovery error:', e);
    }

    try {
      // 6. Update Portal from captured instances
      for (const map of window.poiHijack.activeMaps) {
        const res = extractBounds(map);
        if (res && res.north) { 
          window.poiPortal.update(res, 'instance-capture'); 
          if (window.overlayRegistry) {
            window.overlayRegistry.updateBounds(map, res);
          }
          break; 
        }
      }
      
      // 7. Continuous re-render via native renderer
      // poiRenderer iterates poiHijack.activeMaps directly — the sole rendering path.
      if (window.poiRenderer && lastReceivedPois.length > 0) {
        window.poiRenderer.update(lastReceivedPois);
      }
    } catch(e) {
      console.error(PREFIX + 'Loop error:', e);
    }
  }

  // ─── Start Orchestration ────────────────────────────────────────────
  setInterval(loop, 500);
  
  // Periodic registry cleanup (every 5 minutes)
  setInterval(() => {
    if (window.overlayRegistry) {
      window.overlayRegistry.cleanup();
    }
  }, 300000);
  
  // ─── Listen for Data from Content Script ────────────────────────────
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'POI_DATA_UPDATE') {
       console.log(`${PREFIX}POI_DATA_UPDATE received: ${event.data.pois.length} POIs`);
       lastReceivedPois = event.data.pois;

       // Render via native renderer — the sole rendering path
       if (window.poiRenderer) {
          window.poiRenderer.update(event.data.pois);
       }
    }
  });
  
  // Force immediate apply on script load
  if (window.poiHijack) window.poiHijack.apply();
  
  loop();
})();
