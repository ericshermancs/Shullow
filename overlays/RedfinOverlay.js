/**
 * RedfinOverlay - Site-specific overlay for Redfin.com
 * 
 * Redfin uses Google Maps and has specialized data extraction methods:
 * - Redux store subscription for real-time bounds updates
 * - window.RF_CONTEXT / window.__map_bounds__ global variable scraping
 * - Redfin API response parsing
 * 
 * This overlay extends GoogleMapsOverlayBase with all Redfin-specific
 * logic that was previously in discovery.js and sniff.js.
 */

/**
 * RedfinOverlay - Google Maps overlay for Redfin.com
 * 
 * Features:
 * - Redux store subscription for real-time bounds
 * - Global variable scraping (RF_CONTEXT, __map_bounds__)
 * - API response parsing
 * - Integrated bounds extraction
 */
class RedfinOverlay extends GoogleMapsOverlayBase {
  constructor(debug = false) {
    super(debug);
    this.siteId = 'redfin';
    this.reduxStore = null;
    this.reduxUnsubscribe = null;
    this._storeSubscribed = false;
  }

  /**
   * @override
   * Detects the Redfin map container
   * @returns {HTMLElement|null} The map container element
   */
  detect() {
    const selectors = [
      '.gm-style',
      '[data-rf-test-id="map"]',
      '#map-container',
      '.MapContainer',
      '.HomeViews'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        this.log('Detected Redfin map container:', selector);
        this.container = el;
        return el;
      }
    }

    return null;
  }

  /**
   * @override
   * Hijacks the map and sets up Redfin-specific subscriptions
   * @param {Object} mapInstance - The map instance
   * @returns {boolean} Success
   */
  hijack(mapInstance) {
    const result = super.hijack(mapInstance);
    
    if (result) {
      // Set up Redux store subscription
      this.subscribeToStore();
    }
    
    return result;
  }

  /**
   * Subscribes to Redfin's Redux store for real-time bounds updates
   */
  subscribeToStore() {
    if (this._storeSubscribed) return;

    try {
      // Find Redux store
      let store = window.App?.store || window.redfin?.context?.store;
      
      // Fiber Probe for Store
      if (!store) {
        const root = document.getElementById('root') || document.querySelector('#content');
        if (root) {
          const key = Object.keys(root).find(k => k.startsWith('__reactContainer'));
          if (key && root[key]) {
            let fiber = root[key];
            while (fiber && !store) {
              if (fiber.stateNode && fiber.stateNode.store) store = fiber.stateNode.store;
              else if (fiber.memoizedProps && fiber.memoizedProps.store) store = fiber.memoizedProps.store;
              fiber = fiber.child || fiber.return;
            }
          }
        }
      }

      if (store) {
        this.reduxStore = store;
        
        // Get initial bounds
        const s = store.getState();
        if (s?.map?.viewport?.bounds) {
          window.poiPortal.update(s.map.viewport.bounds, 'redfin-redux');
        }
        
        // Subscribe for real-time updates
        if (typeof store.subscribe === 'function') {
          let lastBounds = store.getState()?.map?.viewport?.bounds;
          this.reduxUnsubscribe = store.subscribe(() => {
            const ns = store.getState();
            const newBounds = ns?.map?.viewport?.bounds;
            // Strict equality check to prevent updates if bounds object hasn't changed
            if (newBounds && newBounds !== lastBounds) {
              lastBounds = newBounds;
              window.poiPortal.update(newBounds, 'redfin-redux-sub');
            }
          });
          this._storeSubscribed = true;
          this.log('Subscribed to Redux store');
        }
      }
    } catch (e) {
      this.log('Failed to subscribe to Redux store:', e);
    }
  }

  /**
   * Extracts bounds from global variables (RF_CONTEXT, __map_bounds__)
   * @returns {Object|null} Bounds object or null
   */
  extractGlobalBounds() {
    try {
      // Check __map_bounds__ global
      if (window.__map_bounds__ && window.poiPortal.lastPriority < 80) {
        const b = window.__map_bounds__;
        const keys = Object.keys(b).filter(k => b[k] && typeof b[k].lo === 'number' && typeof b[k].hi === 'number');
        if (keys.length >= 2) {
          const b1 = b[keys[0]];
          const b2 = b[keys[1]];
          let latB, lngB;
          // Geographic Heuristic: Longitude is negative and larger magnitude in NYC/US context
          if (b1.lo < 0 || Math.abs(b1.lo) > Math.abs(b2.lo)) { 
            lngB = b1; 
            latB = b2; 
          } else { 
            lngB = b2; 
            latB = b1; 
          }
          
          return { 
            north: latB.hi, 
            south: latB.lo, 
            east: lngB.hi, 
            west: lngB.lo 
          };
        }
      }
    } catch (e) {
      this.log('Failed to extract global bounds:', e);
    }
    return null;
  }

  /**
   * Parses Redfin API response for bounds data
   * @param {Object} data - Parsed JSON response
   * @returns {Object|null} Bounds object or null
   */
  parseNetworkBounds(data) {
    try {
      // Look for Redfin specific response structure
      if (data?.payload?.viewport) return data.payload.viewport;
      if (data?.payload?.bounds) return data.payload.bounds;
    } catch (e) {
      this.log('Failed to parse network bounds:', e);
    }
    return null;
  }

  /**
   * Runs Redfin-specific discovery (global bounds extraction)
   * This should be called periodically to supplement Redux subscription
   */
  runDiscovery() {
    // Extract global bounds as fallback
    const bounds = this.extractGlobalBounds();
    if (bounds) {
      window.poiPortal.update(bounds, 'redfin-global');
    }
  }

  /**
   * @override
   * Cleanup resources
   */
  cleanup() {
    if (this.reduxUnsubscribe) {
      try {
        this.reduxUnsubscribe();
      } catch (e) {}
      this.reduxUnsubscribe = null;
    }
    this.reduxStore = null;
    this._storeSubscribed = false;
    
    super.cleanup();
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RedfinOverlay;
} else if (typeof window !== 'undefined') {
  window.RedfinOverlay = RedfinOverlay;
}
