/**
 * POI Bridge: Discovery Module
 * Penetrates Shadow DOM and React trees to find existing maps.
 * 
 * Converted to OOP class extending ManagerBase for singleton pattern
 * and initialization lifecycle management.
 * 
 * NOTE: Site-specific logic is now handled by siteConfig.js which provides
 * selectors, features flags, and Shadow DOM detection capabilities.
 * 
 * PHASE 6.5: This module now registers discovered maps with OverlayRegistry.
 * Domain detection happens AT DISCOVERY TIME, not globally.
 */

/**
 * MapDiscoveryManager - Discovers map instances in the DOM
 * 
 * Features:
 * - Shadow DOM traversal
 * - React Fiber scanning
 * - Web Components detection (gmp-map, gmp-advanced-marker)
 * - Multiple fallback selector strategies
 * - Phase 6.5: Registers maps with OverlayRegistry for domain isolation
 */
class MapDiscoveryManager extends ManagerBase {
  constructor() {
    super();
    this.observers = [];
    this.scanInterval = null;
    this._idleCounter = 0;
  }

  /**
   * Attempts to extract a map-like instance from a candidate object
   * @param {any} candidate
   * @returns {any|null}
   * @private
   */
  _extractMapFromCandidate(candidate) {
    try {
      if (!candidate || typeof candidate !== 'object') return null;
      if (typeof candidate.getBounds === 'function' || typeof candidate.setCenter === 'function') {
        return candidate;
      }

      const visited = new WeakSet();
      const queue = [candidate];
      let depth = 0;

      while (queue.length > 0 && depth < 2) {
        const nextQueue = [];
        for (const obj of queue) {
          if (!obj || typeof obj !== 'object') continue;
          if (visited.has(obj)) continue;
          visited.add(obj);

          const keys = Object.keys(obj);
          for (const key of keys) {
            try {
              const val = obj[key];
              if (!val || typeof val !== 'object') continue;
              if (typeof val.getBounds === 'function' || typeof val.setCenter === 'function') {
                return val;
              }
              nextQueue.push(val);
            } catch (e) {}
          }
        }
        queue.length = 0;
        queue.push(...nextQueue);
        depth++;
      }
    } catch (e) {}

    return null;
  }

  /**
   * Registers a discovered map with the OverlayRegistry
   * Domain detection happens HERE at discovery time.
   * @param {Object} map - The map instance
   * @param {HTMLElement} [container] - The container element
   * @private
   */
  _registerMap(map, container = null) {
    if (!map) return;
    
    console.log('[MapDiscoveryManager] _registerMap called with map:', map);
    
    // Add to hijack's activeMaps for backwards compatibility
    window.poiHijack.activeMaps.add(map);
    window.poiHijack.attachListeners(map);

    // PHASE 6.5: Register with OverlayRegistry
    // Domain is detected HERE and locked to this map
    if (window.overlayRegistry) {
      console.log('[MapDiscoveryManager] Calling overlayRegistry.register()');
      const entry = window.overlayRegistry.register(map, container);
      if (entry && entry.overlay) {
        this.log(`Registered map ${entry.id} with overlay for domain: ${entry.domain}`);
      }
    } else {
      console.warn('[MapDiscoveryManager] overlayRegistry not available!');
    }
  }

  /**
   * @override
   * Called during initialization
   */
  async onInitialize() {
    this.log('MapDiscoveryManager initialized');
  }

  /**
   * @override
   * Cleanup observers and intervals
   */
  cleanup() {
    this.stopScanning();
    this.observers.forEach(obs => obs.disconnect());
    this.observers = [];
    this.initialized = false;
    this.log('MapDiscoveryManager cleaned up');
  }

  /**
   * Starts continuous scanning for maps
   */
  startScanning() {
    if (this.scanInterval) return;
    this.scanInterval = setInterval(() => this.run(), 1000);
    this.log('Started scanning');
  }

  /**
   * Stops continuous scanning
   */
  stopScanning() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      this.log('Stopped scanning');
    }
  }

  /**
   * Finds all elements matching selector within Shadow DOM
   * @param {Node} root - Root node to search from
   * @param {string} selector - CSS selector
   * @param {Array} found - Accumulator array
   * @returns {Array} Found elements
   */
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
  }

  /**
   * Main discovery run - finds and registers maps
   */
  run() {
    // IDLE CHECK: If we already have active maps, we don't need to scan aggressively.
    // Scan only every 10th call (assuming 1s loop = every 10s)
    if (window.poiHijack.activeMaps.size > 0) {
       this._idleCounter = (this._idleCounter || 0) + 1;
       if (this._idleCounter % 10 !== 0) return; 
    }
    
    console.log('[MapDiscoveryManager] run() called, activeMaps:', window.poiHijack.activeMaps.size);
    
    // A. Mapbox Global Registry
    this._discoverMapboxGlobal();
    
    // B. Web Components (Realtor/Homes)
    this._discoverWebComponents();
    
    // C. DOM & Fiber
    this._discoverDOMAndFiber();
    
    // D. FALLBACK: If we still have 0 maps, try window.google.maps directly (for hijacked instances)
    if (window.poiHijack.activeMaps.size === 0 && window.google?.maps) {
      console.log('[MapDiscoveryManager] No maps found via discovery, checking window.google.maps...');
      // The hijack should have captured any maps created via the Google Maps constructor
      // If not, there might be maps created before hijack was installed
      // Try to find them via window.google.maps internals (varies by version)
      if (window.google.maps._instances) {
        console.log('[MapDiscoveryManager] Found window.google.maps._instances');
        for (const instance of window.google.maps._instances) {
          if (instance && typeof instance.getBounds === 'function') {
            console.log('[MapDiscoveryManager] Registering map from window.google.maps._instances');
            this._registerMap(instance, null);
          }
        }
      }
    }
    
    console.log('[MapDiscoveryManager] run() complete, now have:', window.poiHijack.activeMaps.size, 'maps');
  }

  /**
   * Discover maps via Mapbox global registry
   * @private
   */
  _discoverMapboxGlobal() {
    try { 
      if (window.mapboxgl?.getInstances) {
        const instances = window.mapboxgl.getInstances();
        console.log('[MapDiscoveryManager] Mapbox global registry found:', instances?.length || 0, 'instances');
        instances?.forEach(map => {
          if (map && typeof map.getBounds === 'function') {
            // PHASE 6.5: Use _registerMap instead of direct add
            const container = map._container || null;
            console.log('[MapDiscoveryManager] Registering Mapbox map');
            this._registerMap(map, container);
          }
        });
      }
    } catch(e) {
      console.error('[MapDiscoveryManager] Error in Mapbox discovery:', e);
    }
  }

  /**
   * Discover maps via Web Components (Shadow DOM)
   * @private
   */
  _discoverWebComponents() {
    try {
      // Only look for gmp-map (map containers), NOT gmp-advanced-marker (individual markers)
      // gmp-advanced-marker elements will have map references that shouldn't be treated as new maps
      const elements = this.findAllInShadow(document, 'gmp-map');
      
      elements.forEach(el => {
        const map = el.map || el.innerMap || el.getMap?.();
        if (map && typeof map.getBounds === 'function') {
          console.log('[MapDiscoveryManager] Registering gmp-map');
           // PHASE 6.5: Use _registerMap, pass the element as container context
           this._registerMap(map, el);
        }
      });
    } catch(e) {
      console.error('[MapDiscoveryManager] Error in web components discovery:', e);
    }
  }

  /**
   * Discover maps via DOM selectors and React Fiber
   * @private
   */
  _discoverDOMAndFiber() {
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
    const mapProps = ['map', 'mapInstance', 'innerMap', '__google_map__', 'mapObject', 'viewer', '__e3_'];
    
    let foundCount = 0;
    console.log('[MapDiscoveryManager] _discoverDOMAndFiber: checking', selectors.length, 'selectors...');
    
    // Quick test: can we find .gm-style directly?
    const quickTest = document.querySelector('.gm-style');
    console.log('[MapDiscoveryManager] Quick test: document.querySelector(".gm-style"):', !!quickTest);
    
    // If found, try to get map from it
    if (quickTest) {
      let curr = quickTest;
      for (let i = 0; i < 5 && curr; i++) {
        for (const p of mapProps) {
          try {
            const candidate = curr[p];
            if (candidate && typeof candidate.getBounds === 'function') {
              console.log('[MapDiscoveryManager] FOUND MAP via property', p);
              foundCount++;
              this._registerMap(candidate, quickTest);
              break;
            }
          } catch(e) {}
        }
        curr = curr.parentElement;
      }
    }
    
    selectors.forEach(sel => {
      try {
        const elements = this.findAllInShadow(document, sel);
        console.log('[MapDiscoveryManager] Selector "' + sel + '": found', elements.length, 'elements');
        
        elements.forEach(el => {
          let curr = el;
          
          for (let i = 0; i < 5 && curr; i++) {
            for (const p of mapProps) { 
              try { 
                const candidate = curr[p];
                if (candidate && typeof candidate.getBounds === 'function') {
                  console.log('[MapDiscoveryManager] Found map instance via', p, 'on selector:', sel);
                  foundCount++;
                  this._registerMap(candidate, el);
                } else if (candidate && typeof candidate === 'object') {
                  const extracted = this._extractMapFromCandidate(candidate);
                  if (extracted) {
                    console.log('[MapDiscoveryManager] Extracted map instance via', p, 'on selector:', sel);
                    foundCount++;
                    this._registerMap(extracted, el);
                  }
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
                      if (val && (typeof val.getBounds === 'function' || typeof val.setCenter === 'function')) {
                        console.log('[MapDiscoveryManager] Found map via Fiber prop:', p);
                        this._registerMap(val, el);
                      } else if (val && typeof val === 'object') {
                        const extracted = this._extractMapFromCandidate(val);
                        if (extracted) {
                          console.log('[MapDiscoveryManager] Extracted map via Fiber prop:', p);
                          this._registerMap(extracted, el);
                        }
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
      } catch(e) {
        console.error('[MapDiscoveryManager] Error processing selector "' + sel + '":', e);
      }
    });
    console.log('[MapDiscoveryManager] _discoverDOMAndFiber found:', foundCount, 'maps total');
  }

  /**
   * Discovers maps and returns them (for use by overlays)
   * @returns {Array} Array of discovered map instances
   */
  discoverMaps() {
    this.run();
    return Array.from(window.poiHijack.activeMaps);
  }
}

// Create singleton instance and expose on window for backwards compatibility
const discoveryManager = new MapDiscoveryManager();
window.poiDiscovery = discoveryManager;

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapDiscoveryManager;
}
