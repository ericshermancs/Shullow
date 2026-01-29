/**
 * POI Bridge: Main Entry
 * Orchestrates the lifecycle of the bridge.
 */
(function() {
  const PREFIX = ' [POI TITAN] ';
  let attempts = 0;

  function extractBounds(map) {
    try {
      const b = map.getBounds();
      if (!b) return null;
      if (b.getNorthEast) return { north: b.getNorthEast().lat(), south: b.getSouthWest().lat(), east: b.getNorthEast().lng(), west: b.getSouthWest().lng() };
      if (b.getNorth) return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
    } catch(e) {}
    return null;
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

    // 2. Initialize Sniffers (Once)
    if (!window.poiSniff._initialized) {
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
        if (res && res.north) { window.poiPortal.update(res, 'instance-capture'); break; }
      }
      
      // 5. Renderer Check (Retry if needed)
      if (window.poiRenderer && window.poiRenderer.lastPoiData.length > 0) {
         window.poiRenderer.update(window.poiRenderer.lastPoiData);
      }
    } catch(e) {
      console.error(PREFIX + 'Main loop failure:', e);
    }
  }

  // Start Orchestration
  // 1000ms interval: Reduced frequency as native markers are persistent and fluid
  setInterval(loop, 1000); 
  
  // Listen for Data from Content Script
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'POI_DATA_UPDATE') {
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
