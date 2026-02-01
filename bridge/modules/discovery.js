/**
 * POI Bridge: Discovery Module
 * Penetrates Shadow DOM and React trees to find existing maps.
 * 
 * Converted to OOP class extending ManagerBase for singleton pattern
 * and initialization lifecycle management.
 * 
 * NOTE: Redfin-specific logic (Redux store, RF_CONTEXT) has been extracted
 * to RedfinOverlay.js as per Phase 5.1. This class now only handles
 * generic discovery.
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
   * Registers a discovered map with the OverlayRegistry
   * Domain detection happens HERE at discovery time.
   * @param {Object} map - The map instance
   * @param {HTMLElement} [container] - The container element
   * @private
   */
  _registerMap(map, container = null) {
    if (!map) return;
    
    // Add to hijack's activeMaps for backwards compatibility
    window.poiHijack.activeMaps.add(map);
    window.poiHijack.attachListeners(map);
    
    // PHASE 6.5: Register with OverlayRegistry
    // Domain is detected HERE and locked to this map
    if (window.overlayRegistry) {
      const entry = window.overlayRegistry.register(map, container);
      if (entry && entry.overlay) {
        this.log(`Registered map ${entry.id} with overlay for domain: ${entry.domain}`);
      }
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
    
    // A. Mapbox Global Registry
    this._discoverMapboxGlobal();
    
    // B. Web Components (Realtor/Homes)
    this._discoverWebComponents();
    
    // C. DOM & Fiber
    this._discoverDOMAndFiber();
  }

  /**
   * Discover maps via Mapbox global registry
   * @private
   */
  _discoverMapboxGlobal() {
    try { 
      if (window.mapboxgl?.getInstances) {
        const instances = window.mapboxgl.getInstances();
        instances?.forEach(map => {
          if (map && typeof map.getBounds === 'function') {
            // PHASE 6.5: Use _registerMap instead of direct add
            const container = map._container || null;
            this._registerMap(map, container);
          }
        });
      }
    } catch(e) {}
  }

  /**
   * Discover maps via Web Components (Shadow DOM)
   * @private
   */
  _discoverWebComponents() {
    try {
      this.findAllInShadow(document, 'gmp-map, gmp-advanced-marker').forEach(el => {
        const map = el.map || el.innerMap || el.getMap?.();
        if (map && typeof map.getBounds === 'function') {
           // PHASE 6.5: Use _registerMap, pass the element as container context
           this._registerMap(map, el);
        }
      });
    } catch(e) {}
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
    const mapProps = ['map', 'mapInstance', 'innerMap', '__google_map__', 'mapObject', 'viewer'];
    
    selectors.forEach(sel => {
      this.findAllInShadow(document, sel).forEach(el => {
        let curr = el;
        for (let i = 0; i < 5 && curr; i++) {
          for (const p of mapProps) { 
            try { 
              if (curr[p] && typeof curr[p].getBounds === 'function') {
                // PHASE 6.5: Use _registerMap with container context
                this._registerMap(curr[p], el);
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
                      this.log('Discovery found map via Fiber prop:', p);
                      // PHASE 6.5: Use _registerMap with container context
                      this._registerMap(val, el);
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
