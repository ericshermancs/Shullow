/**
 * POI Bridge: Sniffer Module
 * 
 * ⚠️ DEPRECATED & DISABLED
 * 
 * This module was used to monitor network traffic for bounds data,
 * but is now disabled for security reasons.
 * 
 * Rationale:
 * - Map bounds are already tracked via instance event listeners (hijack.js)
 * - Instance events provide high-priority data (priority: 100)
 * - Network sniffing was low-priority (priority: 20) and often overridden anyway
 * - Network interception adds security concerns without functional benefit
 * 
 * Migration:
 * - All bounds tracking now comes from:
 *   1. hijack.js: 'idle'/'moveend' event listeners (Google Maps and Mapbox)
 *   2. siteConfig.js: Site-specific features flags for special behaviors
 *   3. portal.js: Priority-based bounds locking prevents low-quality data
 * 
 * This file is kept for reference but is NOT loaded by entry.js

 */

/**
 * NetworkSnifferManager - Monitors network for coordinate data
 * 
 * Features:
 * - Fetch API interception
 * - XMLHttpRequest interception
 * - History API monitoring
 * - Generic bounds extraction from URL and JSON
 */
class NetworkSnifferManager extends ManagerBase {
  constructor() {
    super();
    this.originalFetch = null;
    this.originalXHROpen = null;
    this.originalXHRSend = null;
  }

  /**
   * @override
   * Called during initialization
   */
  async onInitialize() {
    this.installProxies();
    console.log('POI Bridge: Sniffer initialized');
  }

  /**
   * @override
   * Cleanup and restore original methods
   */
  cleanup() {
    // Note: We don't restore original fetch/XHR as it could break the page
    // Just mark as not initialized
    this.initialized = false;
    this.log('NetworkSnifferManager cleaned up');
  }

  /**
   * Installs all network proxies
   */
  installProxies() {
    const self = this;

    // --- 1. Fetch Proxy (Context-Safe) ---
    this.originalFetch = window.fetch;
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
      
      return self.originalFetch.apply(window, args);
    };

    // --- 2. XHR Proxy (Non-destructive) ---
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      this._poiUrl = url;
      return self.originalXHROpen.apply(this, arguments);
    };

    this.originalXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(body) {
      try {
        if (this._poiUrl) self.process(this._poiUrl, body);
      } catch (e) {}
      return self.originalXHRSend.apply(this, arguments);
    };

    // --- 3. History API Proxy (URL updates) ---
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
  }

  /**
   * Alias for init() - backwards compatibility
   */
  init() {
    if (!this.initialized) {
      this.installProxies();
      this.initialized = true;
    }
  }

  /**
   * Processes a URL/body for bounds data
   * NOTE: This only extracts bounds, NOT domain info (per Phase 6.5.3)
   * @param {string} url - The URL
   * @param {string} body - Optional request body
   */
  process(url, body) {
    if (!url) return;
    try {
      const s = url.toString();
      
      // A. URL Query Sniffing
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
          
          // Note: Site-specific parsing handled by siteConfig.js features
          // This is generic bounds finding only
          
          const found = this.findBounds(data);
          if (found) window.poiPortal.update(found, 'network-body');
        } catch (e) {}
      }
    } catch (e) {}
  }

  /**
   * Normalizes an array of 4 values into bounds object
   * @param {Array} v - Array of 4 coordinate values
   * @returns {Object|null} Bounds object or null
   */
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
  }

  /**
   * Recursively searches an object for bounds data
   * @param {Object} obj - Object to search
   * @param {number} depth - Current recursion depth
   * @returns {Object|null} Bounds object or null
   */
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
}

// Create singleton instance and expose on window for backwards compatibility
const snifferManager = new NetworkSnifferManager();
window.poiSniff = snifferManager;

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NetworkSnifferManager;
}
