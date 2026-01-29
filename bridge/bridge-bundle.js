/**
 * POI Bridge: Portal Module
 * Handles cross-world communication and attribute mirroring.
 */
window.poiPortal = {
  lastBounds: null,
  lastUpdateTime: 0,
  lastPriority: 0,

  PRIORITIES: {
    'instance-event': 100,      // Highest: Direct user interaction
    'redfin-redux-sub': 90,     // High: Real-time subscription
    'redfin-api': 85,           // High: API response is very fresh
    'instance-capture': 80,     // Medium: Extracted from active map instance
    'redfin-redux': 50,         // Low: Polled state (might be slightly stale)
    'redfin-global': 40,        // Lower: Polled global variable (often stale)
    'network-url': 20,          // Lowest: One-off network sniff
    'network-body': 20
  },

  update(bounds, method) {
    if (!bounds || typeof bounds.north !== 'number' || isNaN(bounds.north)) return;
    
    // Priority Check
    const priority = this.PRIORITIES[method] || 30;
    const now = Date.now();
    
    // STRICTER LOCK: If we have locked onto a high-quality source (>= 80),
    // ignore any low-quality polling (< 80) PERMANENTLY unless the high-quality source goes silent for > 5 seconds.
    if (this.lastPriority >= 80 && priority < 80) {
       if (now - this.lastUpdateTime < 5000) return;
       // Reset lock if silence for 5s
       this.lastPriority = 0; 
    }

    // Always allow high-priority updates (e.g. from user interaction or API)
    // Only filter low-priority polling if a high-priority event happened very recently
    if (priority <= 50 && this.lastPriority > 50 && (now - this.lastUpdateTime < 500)) {
       return;
    }

    // Round for stability and JSON comparison
    const rounded = {
      north: parseFloat(bounds.north.toFixed(6)),
      south: parseFloat(bounds.south.toFixed(6)),
      east: parseFloat(bounds.east.toFixed(6)),
      west: parseFloat(bounds.west.toFixed(6))
    };

    const json = JSON.stringify(rounded);
    
    // Update state even if bounds are same, to refresh priority timestamp if it's high priority
    if (priority >= this.lastPriority) {
        this.lastPriority = priority;
        this.lastUpdateTime = now;
    }

    if (json === this.lastBounds) return;
    this.lastBounds = json;

    const timestamp = now.toString();
    // ... rest of function

    // Mirror to DOM for Isolated World access
    document.documentElement.setAttribute('data-poi-bounds', json);
    document.documentElement.setAttribute('data-poi-map-type', method);
    document.documentElement.setAttribute('data-poi-timestamp', timestamp);
    
    const payload = { 
      type: 'POI_BOUNDS_UPDATE', 
      bounds: rounded, 
      method: method, 
      url: window.location.href, 
      isIframe: window.self !== window.top,
      timestamp: timestamp
    };
    
    window.postMessage(payload, '*');
    if (window.self !== window.top) window.parent.postMessage(payload, '*');
  }
};
/**
 * POI Bridge: Hijack Module
 * Captures map instances via constructor interception.
 */
window.poiHijack = {
  activeMaps: new Set(),
  attachListeners(instance) {
    if (!instance || instance._poiListener) return;
    console.log('[POI TITAN] Attaching listeners to captured instance');
    
    // Unwrap if it's a wrapper (Redfin specific)
    let target = instance;
    if (!target.addListener && !target.on) {
       if (target.map && (target.map.addListener || target.map.on)) target = target.map;
       else if (target.getMap && typeof target.getMap === 'function') {
          const m = target.getMap();
          if (m && (m.addListener || m.on)) target = m;
       }
    }

    try {
      if (target.on) { // Mapbox
        const update = () => {
          if (typeof target.getBounds === 'function') {
            const b = target.getBounds();
            if (b) {
              window.poiPortal.update({
                north: b.getNorth(), south: b.getSouth(),
                east: b.getEast(), west: b.getWest()
              }, 'instance-event');
            }
          }
        };
        // Redfin might throttle 'move', try 'moveend' too
        const safeUpdate = () => {
           try { update(); } catch(e) {}
        };
        
        // OPTIMIZATION: Only listen to 'moveend' to reduce flicker and load during drag
        // 'move' fires 60fps, which is unnecessary for POI updates
        // target.on('move', safeUpdate); 
        target.on('moveend', safeUpdate);
        // target.on('zoom', safeUpdate);
        target.on('zoomend', safeUpdate);
        
        instance._poiListener = true; // Mark original instance as processed
      } else if (target.addListener) { // Google Maps
        const update = () => {
          // console.log('[POI TITAN] Google Maps event fired');
          if (typeof target.getBounds === 'function') {
            const b = target.getBounds();
            // Google Maps getBounds returns LatLngBounds
            // getNorthEast() and getSouthWest() are standard
            if (b && b.getNorthEast && b.getSouthWest) {
              window.poiPortal.update({
                north: b.getNorthEast().lat(), south: b.getSouthWest().lat(),
                east: b.getNorthEast().lng(), west: b.getSouthWest().lng()
              }, 'instance-event');
            }
          }
        };
        
        // OPTIMIZATION: Only listen to 'idle' (fires when map is stable)
        // target.addListener('bounds_changed', update);
        target.addListener('idle', update); 
        // target.addListener('center_changed', update);
        // target.addListener('zoom_changed', update);
        instance._poiListener = true; // Mark original instance as processed
      }
    } catch(e) {
       console.error('[POI TITAN] Failed to attach listeners', e);
    }
  },

  apply() {
    const self = this;
    
    // TRAP: Google Maps (window.google)
    if (window.google?.maps?.Map) {
       this.hijackGoogle(window.google.maps);
    } else {
       if (!window._poiTrappedGoogle) {
          let _google = window.google;
          
          Object.defineProperty(window, 'google', {
             get() { return _google; },
             set(val) {
                _google = val;
                
                // If maps is already there, hijack immediately
                if (val?.maps) {
                   if (val.maps.Map) {
                      self.hijackGoogle(val.maps);
                   }
                   
                   // ALWAYS replace google.maps with a Proxy to catch lazy definition of Map
                   try {
                      const mapsProxy = new Proxy(val.maps, {
                         set(target, prop, value) {
                            if (prop === 'Map') {
                               const Original = value;
                               function HijackedMap(...args) {
                                  if (!new.target) return new HijackedMap(...args);
                                  const instance = new Original(...args);
                                  self.activeMaps.add(instance);
                                  self.attachListeners(instance);
                                  return instance;
                               }
                               HijackedMap.prototype = Original.prototype;
                               HijackedMap._isHijacked = true;
                               Object.assign(HijackedMap, Original);
                               target[prop] = HijackedMap;
                               return true;
                            }
                            target[prop] = value;
                            return true;
                         }
                      });
                      _google.maps = mapsProxy;
                   } catch(e) {}
                }
             },
             configurable: true
          });
          window._poiTrappedGoogle = true;
       }
    }

    try {
      if (window.mapboxgl?.Map && !window.mapboxgl.Map._isHijacked) {
        const Original = window.mapboxgl.Map;
        const self = this;
        function HijackedMap(...args) {
          const instance = new Original(...args);
          self.activeMaps.add(instance);
          self.attachListeners(instance);
          return instance;
        }
        HijackedMap.prototype = Original.prototype;
        HijackedMap._isHijacked = true;
        Object.assign(HijackedMap, Original);
        window.mapboxgl.Map = HijackedMap;
      }
    } catch(e) {}
  },

  hijackGoogle(mapsObj) {
     try {
       if (mapsObj.Map && !mapsObj.Map._isHijacked) {
         const Original = mapsObj.Map;
         const self = this;
         function HijackedMap(...args) {
           if (!new.target) return new HijackedMap(...args);
           const instance = new Original(...args);
           self.activeMaps.add(instance);
           self.attachListeners(instance);
           return instance;
         }
         HijackedMap.prototype = Original.prototype;
         HijackedMap._isHijacked = true;
         Object.assign(HijackedMap, Original);
         mapsObj.Map = HijackedMap;
       }
       
       // BACKDOOR: Prototype Hijack
       // Even if constructor hijack fails (race condition), we catch the instance 
       // when it calls standard methods.
       if (mapsObj.Map && mapsObj.Map.prototype) {
          const proto = mapsObj.Map.prototype;
          const methods = ['setCenter', 'setZoom', 'setOptions', 'fitBounds', 'panTo', 'panBy', 'set'];
          
          methods.forEach(method => {
             if (proto[method] && !proto[method]._isHijacked) {
                const origMethod = proto[method];
                proto[method] = function(...args) {
                   // Capture instance using Duck Typing
                   // Use window.poiHijack.activeMaps directly to avoid scope issues
                   if (this && typeof this.getDiv === 'function' && typeof this.getBounds === 'function') {
                      if (window.poiHijack && window.poiHijack.activeMaps && !window.poiHijack.activeMaps.has(this)) {
                         console.log('[POI TITAN] Backdoor capture via', method);
                         window.poiHijack.activeMaps.add(this);
                         window.poiHijack.attachListeners(this);
                      }
                   }
                   return origMethod.apply(this, args);
                };
                proto[method]._isHijacked = true;
             }
          });
       }
     } catch(e) {}
  }
};/**
 * POI Bridge: Sniffer Module
 * Monitors network traffic for coordinate data using non-destructive interception.
 */
(function() {
  if (window.poiSniff) return;

  window.poiSniff = {
    init() {
      if (this._initialized) return;
      this._initialized = true;

      const self = this;

      // --- 1. Fetch Proxy (Context-Safe) ---
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        try {
          const input = args[0];
          const init = args[1];
          
          let url = '';
          if (typeof input === 'string') url = input;
          else if (input instanceof URL) url = input.toString();
          else if (input && typeof input === 'object') url = input.url;

          if (url) {
            const body = (typeof init?.body === 'string') ? init.body : null;
            self.process(url, body);
          }
        } catch (e) {}
        
        return originalFetch(...args);
      };

      // --- 2. XHR Proxy (Non-destructive) ---
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        this._poiUrl = url;
        return originalOpen.apply(this, arguments);
      };

      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function(body) {
        try {
          if (this._poiUrl) self.process(this._poiUrl, body);
        } catch (e) {}
        return originalSend.apply(this, arguments);
      };

      // --- 3. History API Proxy (Redfin URL updates) ---
      const wrapHistory = (type) => {
         const orig = history[type];
         return function() {
            const rv = orig.apply(this, arguments);
            const e = new Event(type);
            e.arguments = arguments;
            window.dispatchEvent(e);
            return rv;
         };
      };
      history.pushState = wrapHistory('pushState');
      history.replaceState = wrapHistory('replaceState');

      window.addEventListener('pushState', () => self.process(window.location.href));
      window.addEventListener('replaceState', () => self.process(window.location.href));
      window.addEventListener('popstate', () => self.process(window.location.href));

      console.log('POI Bridge: Sniffer initialized');
    },

    process(url, body) {
      if (!url) return;
      try {
        const s = url.toString();
        
        // A. URL Query Sniffing
        // Redfin Specific (URL often contains map location if updated)
        // e.g. /city/30749/NY/New-York/filter/viewport=...
        const p = [
          /bounds=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/,
          /sw=([\d.-]+),([\d.-]+)&ne=([\d.-]+),([\d.-]+)/,
          /viewport=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/,
          /bbox=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/,
          /points=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/
        ];
        
        for (const pattern of p) {
          const m = s.match(pattern);
          if (m) {
            const v = m.slice(1, 5).map(parseFloat);
            const b = this.normalizeBounds(v);
            if (b) {
              window.poiPortal.update(b, 'network-url');
              return;
            }
          }
        }

        // B. Body/JSON Sniffing
        if (body && typeof body === 'string') {
          // SAFETY: Limit parsing to reasonable size to prevent main thread blocking
          if (body.length > 500000) return; // Skip bodies > 500KB
          
          try {
            const data = JSON.parse(body);
            
            // Redfin API Specific
            if (s.includes('/api/gis')) {
               const b = this.findRedfinBounds(data);
               if (b) {
                  window.poiPortal.update(b, 'redfin-api');
                  return;
               }
            }

            const found = this.findBounds(data);
            if (found) window.poiPortal.update(found, 'network-body');
          } catch (e) {}
        }
      } catch (e) {}
    },

    findRedfinBounds(data) {
       // Look for Redfin specific response structure
       // e.g. payload.sections[0].rows...
       // Sometimes "bound" is not explicit, but we can infer from homes if needed (not preferred)
       try {
          // If response has explicit viewport/bounds
          if (data?.payload?.viewport) return data.payload.viewport;
          if (data?.payload?.bounds) return data.payload.bounds;
       } catch(e) {}
       return null; 
    },

    normalizeBounds(v) {
      const lats = v.filter(x => Math.abs(x) < 90);
      const lngs = v.filter(x => Math.abs(x) > 60 && Math.abs(x) < 180);
      
      if (lats.length >= 2 && lngs.length >= 2) {
        return {
          north: Math.max(...lats),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          west: Math.min(...lngs)
        };
      }
      return null;
    },

    findBounds(obj, depth = 0) {
      if (!obj || depth > 12 || typeof obj !== 'object') return null;
      
      try {
        // Specialized: Homes.com / Realtor
        let inner = obj.scms ? JSON.parse(obj.scms) : obj;
        if (inner.mapCriteria?.boundingBox) {
          const b = inner.mapCriteria.boundingBox;
          return { north: b.tl.lt, south: b.br.lt, west: b.tl.ln, east: b.br.ln };
        }
        
        if (obj.viewport && typeof obj.viewport.north === 'number') return obj.viewport;

        // Generic patterns
        if (typeof obj.north === 'number' && typeof obj.south === 'number' && obj.north !== obj.south) return obj;
        if (obj.ne && obj.sw && typeof obj.ne.lat === 'number') return { north: obj.ne.lat, south: obj.sw.lat, east: obj.ne.lng, west: obj.sw.lng };
        
        for (const k in obj) {
          if (obj[k] && typeof obj[k] === 'object') {
            const r = this.findBounds(obj[k], depth + 1);
            if (r) return r;
          }
        }
      } catch (e) {}
      return null;
    }
  };
})();
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
/**
 * POI Bridge: Renderer Module
 * Handles injecting native map markers into hijacked map instances.
 */
window.poiRenderer = {
  activeMarkers: new Map(), // Map<id, NativeMarker>
  lastPoiData: [],
  
  update(pois) {
    this.lastPoiData = pois;
    
    // We iterate over all active maps found by Hijack module
    if (!window.poiHijack || !window.poiHijack.activeMaps) return;
    
    for (const map of window.poiHijack.activeMaps) {
      if (this.isGoogleMap(map)) {
        this.renderGoogle(map, pois);
      } else if (this.isMapbox(map)) {
        this.renderMapbox(map, pois);
      }
    }
  },

  isGoogleMap(map) {
    return (map.overlayMapTypes !== undefined || typeof map.getDiv === 'function');
  },

  isMapbox(map) {
    return (map.addSource !== undefined && map.addLayer !== undefined && map.on !== undefined);
  },

  renderGoogle(map, pois) {
    // Check if OverlayView is available
    if (!window.google || !window.google.maps || !window.google.maps.OverlayView) return;

    // Define Custom Overlay Class if not defined
    if (!window.PoiCustomOverlay) {
       class PoiCustomOverlay extends window.google.maps.OverlayView {
          constructor(poi, element) {
             super();
             this.poi = poi;
             this.element = element;
          }
          onAdd() {
             this.getPanes().floatPane.appendChild(this.element);
          }
          draw() {
             const overlayProjection = this.getProjection();
             const position = new window.google.maps.LatLng(this.poi.latitude, this.poi.longitude);
             const pos = overlayProjection.fromLatLngToDivPixel(position);
             if (pos) {
                this.element.style.left = pos.x + 'px';
                this.element.style.top = pos.y + 'px';
             }
          }
          onRemove() {
             if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
          }
       }
       window.PoiCustomOverlay = PoiCustomOverlay;
    }

    // NEW: Batch Overlay for Massive Performance
    // Instead of N overlay views, we use ONE overlay view for ALL markers on this map.
    if (!window.PoiBatchOverlay) {
       class PoiBatchOverlay extends window.google.maps.OverlayView {
          constructor(mapInstance) {
             super();
             this.mapInstance = mapInstance;
             this.container = document.createElement('div');
             this.container.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
             this.pois = [];
             this.markerPool = []; // Pool of DIVs
             this.activeElements = new Map(); // POI ID -> Element
             this.hasPendingDraw = false;
             
             // Event Delegation
             this.container.addEventListener('click', (e) => {
                const target = e.target.closest('.poi-native-marker');
                if (target) {
                   e.stopPropagation();
                   // Read data attributes
                   const id = target.getAttribute('data-id');
                   const lat = parseFloat(target.getAttribute('data-lat'));
                   const lng = parseFloat(target.getAttribute('data-lng'));
                   window.postMessage({ type: 'POI_MARKER_CLICK', id, lat, lng }, '*');
                }
             }, true); // Capture phase to beat Google Maps listeners
             
             this.container.addEventListener('mouseenter', (e) => {
                const target = e.target.closest('.poi-native-marker');
                if (target) {
                   target.style.zIndex = '1000000';
                   const id = target.getAttribute('data-id');
                   const lat = parseFloat(target.getAttribute('data-lat'));
                   const lng = parseFloat(target.getAttribute('data-lng'));
                   window.postMessage({ type: 'POI_MARKER_HOVER', id, lat, lng }, '*');
                }
             }, true);
             
             this.container.addEventListener('mouseleave', (e) => {
                const target = e.target.closest('.poi-native-marker');
                if (target) {
                   target.style.zIndex = '102'; // Restore base z-index
                   const id = target.getAttribute('data-id');
                   window.postMessage({ type: 'POI_MARKER_LEAVE', id }, '*');
                }
             }, true);
          }
          
          updatePois(newPois) {
             this.pois = newPois;
             // Trigger redraw
             if (this.getProjection()) this.draw();
          }

          onAdd() {
             this.getPanes().floatPane.appendChild(this.container);
          }

          onRemove() {
             if (this.container.parentNode) this.container.parentNode.removeChild(this.container);
          }

          draw() {
             if (this.hasPendingDraw) return;
             this.hasPendingDraw = true;
             
             requestAnimationFrame(() => {
                this.hasPendingDraw = false;
                this._drawBatch();
             });
          }
          
          _drawBatch() {
             const projection = this.getProjection();
             if (!projection) return;
             
             const bounds = this.mapInstance.getBounds();
             if (!bounds) return;
             
             // Diff Strategy:
             // 1. Identify POIs currently in view
             // 2. Recycle elements for POIs no longer in view
             // 3. Create/Reuse elements for POIs now in view
             
             const visibleIds = new Set();
             const fragment = document.createDocumentFragment();
             
             this.pois.forEach(poi => {
                const lat = parseFloat(poi.latitude);
                const lng = parseFloat(poi.longitude);
                const latLng = new window.google.maps.LatLng(lat, lng);
                
                // Bounds Check
                if (!bounds.contains(latLng)) return;
                
                const id = poi.id || poi.name;
                visibleIds.add(id);
                
                const pos = projection.fromLatLngToDivPixel(latLng);
                
                let el = this.activeElements.get(id);
                
                if (!el) {
                   // Get from pool or create
                   if (this.markerPool.length > 0) {
                      el = this.markerPool.pop();
                   } else {
                      el = document.createElement('div');
                      el.className = 'poi-native-marker';
                      // Styles are set once, only transform changes
                      el.style.cssText = `
                        position: absolute; width: 32px; height: 32px;
                        background-size: contain; background-repeat: no-repeat;
                        pointer-events: auto; cursor: pointer; z-index: 102;
                        will-change: transform; top: 0; left: 0;
                        filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
                      `;
                   }
                   
                   // Update visual content (Logo/Color)
                   const color = poi.color || '#ff0000';
                   const secondaryColor = poi.secondaryColor || '#ffffff';
                   // Inline SVG construction (optimized string concat)
                   const svg = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`
                     <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="${secondaryColor}" stroke-width="1"/>
                     </svg>`);
                   el.style.backgroundImage = `url('${poi.logoData || svg}')`;
                   
                   // Store Data Attributes for Delegation
                   el.setAttribute('data-id', id);
                   el.setAttribute('data-lat', lat);
                   el.setAttribute('data-lng', lng);
                   
                   this.activeElements.set(id, el);
                   fragment.appendChild(el);
                } else {
                   // Ensure it's attached (might be re-added if logic changes, but usually stays in DOM)
                   // If we are reusing, we don't append to fragment unless it was detached.
                   // Here we assume it stays attached.
                }
                
                // Update Position (Transform is faster than top/left)
                // translate(-50%, -100%) handles the anchor point (bottom center)
                el.style.transform = `translate(-50%, -100%) translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
             });
             
             // Append new elements
             if (fragment.childElementCount > 0) {
                this.container.appendChild(fragment);
             }
             
             // Cleanup hidden elements (Return to pool)
             this.activeElements.forEach((el, id) => {
                if (!visibleIds.has(id)) {
                   el.remove(); // Detach from DOM
                   this.markerPool.push(el); // Add to pool
                   this.activeElements.delete(id);
                }
             });
          }
       }
       window.PoiBatchOverlay = PoiBatchOverlay;
    }

    // Identify/Create Batch Layer for this map instance
    if (!map._poiBatchLayer) {
       map._poiBatchLayer = new window.PoiBatchOverlay(map);
       map._poiBatchLayer.setMap(map);
    }
    
    // Update Data
    map._poiBatchLayer.updatePois(pois);
  },

  renderMapbox(map, pois) {
    if (!window.mapboxgl || !window.mapboxgl.Marker) return;
    
    if (!map._poiUid) map._poiUid = Math.random().toString(36).substr(2, 9);
    const usedIds = new Set();

    pois.forEach(poi => {
       const id = `${map._poiUid}-${poi.id || poi.name}`;
       usedIds.add(id);
       
       if (this.activeMarkers.has(id)) return;

       const el = document.createElement('div');
       el.className = 'poi-native-marker-mapbox';
       const color = poi.color || '#ff0000';
       const secondaryColor = poi.secondaryColor || '#ffffff';
       const logo = poi.logoData;
       
       // Fallback SVG if no logo
       const fallbackSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
           <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="${secondaryColor}" stroke-width="1"/>
         </svg>
       `)}`;

       el.style.cssText = `
         width: 32px; height: 32px; cursor: pointer; z-index: 5000;
         background-image: url('${logo || fallbackSvg}');
         background-size: contain; background-repeat: no-repeat;
         filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
       `;
       
       el.onclick = (e) => {
          e.stopPropagation();
          window.postMessage({ type: 'POI_MARKER_CLICK', id: poi.id, lat: poi.latitude, lng: poi.longitude }, '*');
       };
       
       // Hover Listeners
       el.onmouseenter = () => {
          el.style.zIndex = '1000000';
          window.postMessage({ type: 'POI_MARKER_HOVER', id: poi.id, lat: poi.latitude, lng: poi.longitude }, '*');
       };
       
       el.onmouseleave = () => {
          el.style.zIndex = '5000';
          window.postMessage({ type: 'POI_MARKER_LEAVE', id: poi.id }, '*');
       };

       const marker = new window.mapboxgl.Marker({ element: el })
          .setLngLat([parseFloat(poi.longitude), parseFloat(poi.latitude)])
          .addTo(map);
          
       this.activeMarkers.set(id, marker);
    });

    for (const [id, marker] of this.activeMarkers) {
       if (id.startsWith(map._poiUid) && !usedIds.has(id)) {
          marker.remove();
          this.activeMarkers.delete(id);
       }
    }
  }
};
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
