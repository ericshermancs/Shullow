/**
 * POI Bridge: Discovery Module
 * Penetrates Shadow DOM and React trees to find existing maps.
 */
window.poiDiscovery = {
  findAllInShadow(root, selector, found = []) {
    if (!root) return found;
    try {
      const elements = root.querySelectorAll(selector);
      elements.forEach(el => found.push(el));
      
      // Optimization: Limit shadow root crawl depth or skip common non-map containers
      // This is a heavy operation.
      const all = root.querySelectorAll('*');
      for (const s of all) {
        if (s.shadowRoot) {
           // Skip known non-map custom elements if possible
           if (s.tagName.includes('ICON') || s.tagName.includes('BUTTON')) continue;
           this.findAllInShadow(s.shadowRoot, selector, found);
        }
      }
    } catch(e) {}
    return found;
  },

  run() {
    // IDLE CHECK: If we already have active maps, we don't need to scan aggressively.
    // Scan only every 10th call (assuming 1s loop = every 10s)
    if (window.poiHijack.activeMaps.size > 0) {
       this._idleCounter = (this._idleCounter || 0) + 1;
       if (this._idleCounter % 10 !== 0) return; 
    }
    // A. Mapbox Global Registry
    try { 
      if (window.mapboxgl?.getInstances) {
        const instances = window.mapboxgl.getInstances();
        instances?.forEach(map => {
          if (map && typeof map.getBounds === 'function') {
            window.poiHijack.activeMaps.add(map);
            window.poiHijack.attachListeners(map);
          }
        });
      }
    } catch(e) {}
    
    // B. Redfin Specialized Probe
    try {
      // B1. Redux Store (with Subscription)
      let store = window.App?.store || window.redfin?.context?.store;
      
      // Fiber Probe for Store
      if (!store) {
         const root = document.getElementById('root') || document.querySelector('#content');
         if (root) {
            const key = Object.keys(root).find(k => k.startsWith('__reactContainer'));
            if (key && root[key]) {
               let fiber = root[key];
               while(fiber && !store) {
                  if (fiber.stateNode && fiber.stateNode.store) store = fiber.stateNode.store;
                  else if (fiber.memoizedProps && fiber.memoizedProps.store) store = fiber.memoizedProps.store;
                  fiber = fiber.child || fiber.return;
                  // Limit depth slightly to avoid freezing?
               }
            }
         }
      }

      if (store) {
        const s = store.getState();
        if (s?.map?.viewport?.bounds) {
          window.poiPortal.update(s.map.viewport.bounds, 'redfin-redux');
        }
        // Subscribe for real-time updates on move
        if (!store._poiSubscribed && typeof store.subscribe === 'function') {
          let lastBounds = store.getState()?.map?.viewport?.bounds;
          store.subscribe(() => {
            const ns = store.getState();
            const newBounds = ns?.map?.viewport?.bounds;
            // Strict equality check to prevent updates if bounds object hasn't changed
            if (newBounds && newBounds !== lastBounds) {
              lastBounds = newBounds;
              window.poiPortal.update(newBounds, 'redfin-redux-sub');
            }
          });
          store._poiSubscribed = true;
        }
      }
      
      // B2. Global Bounds Scraper (__map_bounds__)
      // Optimization: Only run this fallback if we haven't locked onto a better source
      if (window.__map_bounds__ && window.poiPortal.lastPriority < 80) {
        const b = window.__map_bounds__;
        const keys = Object.keys(b).filter(k => b[k] && typeof b[k].lo === 'number' && typeof b[k].hi === 'number');
        if (keys.length >= 2) {
          const b1 = b[keys[0]];
          const b2 = b[keys[1]];
          let latB, lngB;
          // Geographic Heuristic: Longitude is negative and larger magnitude in NYC/US context
          if (b1.lo < 0 || Math.abs(b1.lo) > Math.abs(b2.lo)) { lngB = b1; latB = b2; }
          else { lngB = b2; latB = b1; }
          
          window.poiPortal.update({ 
            north: latB.hi, south: latB.lo, 
            east: lngB.hi, west: lngB.lo 
          }, 'redfin-global');
        }
      }
    } catch(e) {}

    // C. Web Components (Realtor/Homes)
    try {
      this.findAllInShadow(document, 'gmp-map, gmp-advanced-marker').forEach(el => {
        const map = el.map || el.innerMap || el.getMap?.();
        if (map && typeof map.getBounds === 'function') {
           window.poiHijack.activeMaps.add(map);
           window.poiHijack.attachListeners(map);
        }
      });
    } catch(e) {}

    // D. DOM & Fiber
    const selectors = [
       '.gm-style', 
       '.mapboxgl-map', 
       '.leaflet-container', 
       'canvas',
       '#map-container',
       '.map-container',
       '[data-rf-test-id="map"]',
       'div[class*="Map"]',
       'div[class*="map"]'
    ];
    const mapProps = ['map', 'mapInstance', 'innerMap', '__google_map__', 'mapObject', 'viewer'];
    
    selectors.forEach(sel => {
      this.findAllInShadow(document, sel).forEach(el => {
        let curr = el;
        for (let i = 0; i < 5 && curr; i++) {
          for (const p of mapProps) { 
            try { 
              if (curr[p] && typeof curr[p].getBounds === 'function') {
                window.poiHijack.activeMaps.add(curr[p]); 
                window.poiHijack.attachListeners(curr[p]);
              }
            } catch(e) {} 
          }
          const fiberKey = Object.keys(curr).find(k => k.startsWith('__reactFiber'));
          if (fiberKey) {
            let fiber = curr[fiberKey];
            while (fiber) {
              if (fiber.memoizedProps) { 
                for (const p of mapProps) { 
                  try { 
                    const val = fiber.memoizedProps[p];
                    // Relaxed Check: getBounds OR setCenter (Duck Typing)
                    if (val && (typeof val.getBounds === 'function' || typeof val.setCenter === 'function')) {
                      console.log('[POI TITAN] Discovery found map via Fiber prop:', p);
                      window.poiHijack.activeMaps.add(val); 
                      window.poiHijack.attachListeners(val);
                    }
                  } catch(e) {} 
                } 
              }
              fiber = fiber.return;
            }
          }
          curr = curr.parentElement || (curr.parentNode instanceof ShadowRoot ? curr.parentNode.host : null);
        }
      });
    });
  }
};
