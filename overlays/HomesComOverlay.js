/**
 * HomesComOverlay - Site-specific overlay for Homes.com
 * 
 * Homes.com uses Google Maps with Web Components (Shadow DOM).
 * This overlay extends GoogleMapsOverlayBase with Homes.com-specific
 * Shadow DOM detection.
 */

/**
 * HomesComOverlay - Google Maps overlay for Homes.com
 * 
 * Features:
 * - Detects Google Maps within Shadow DOM
 * - Handles gmp-map and gmp-advanced-marker elements
 * - Traverses Shadow DOM to find map instances
 */
class HomesComOverlay extends GoogleMapsOverlayBase {
  constructor(debug = false) {
    super(debug);
    this.siteId = 'homes.com';
  }

  /**
   * Finds elements matching selector within Shadow DOM
   * @param {Node} root - Root node to search from
   * @param {string} selector - CSS selector
   * @param {Array} found - Accumulator array
   * @returns {Array} Found elements
   * @private
   */
  _findInShadow(root, selector, found = []) {
    if (!root) return found;
    try {
      const elements = root.querySelectorAll(selector);
      elements.forEach(el => found.push(el));
      
      const all = root.querySelectorAll('*');
      for (const s of all) {
        if (s.shadowRoot) {
          // Skip known non-map custom elements
          if (s.tagName.includes('ICON') || s.tagName.includes('BUTTON')) continue;
          this._findInShadow(s.shadowRoot, selector, found);
        }
      }
    } catch(e) {}
    return found;
  }

  /**
   * Checks if a native marker for this POI exists in the DOM
   * Uses base class implementation
   */
  _hasNativeMarker(poi) {
    return super._hasNativeMarker(poi);
  }

  /**
   * @override
   * Detects the Homes.com map container, including Shadow DOM
   * @returns {HTMLElement|null} The map container element
   */
  detect() {
    // Standard selectors
    const selectors = [
      '.gm-style',
      '#map-container',
      '.map-container',
      'gmp-map'
    ];

    // First try standard DOM
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        this.log('Detected Homes.com map container:', selector);
        this.container = el;
        return el;
      }
    }

    // Try Shadow DOM for Web Components
    const shadowElements = this._findInShadow(document, 'gmp-map, gmp-advanced-marker, .gm-style');
    if (shadowElements.length > 0) {
      const el = shadowElements[0];
      this.log('Detected Homes.com map in Shadow DOM');
      this.container = el;
      return el;
    }

    return null;
  }

  /**
   * @override
   * Hijacks the map, handling Web Component maps
   * @param {Object} mapInstance - The map instance
   * @returns {boolean} Success
   */
  hijack(mapInstance) {
    // Handle gmp-map Web Component
    if (mapInstance && !mapInstance.getBounds && mapInstance.map) {
      mapInstance = mapInstance.map;
    }
    if (mapInstance && !mapInstance.getBounds && mapInstance.innerMap) {
      mapInstance = mapInstance.innerMap;
    }
    if (mapInstance && !mapInstance.getBounds && typeof mapInstance.getMap === 'function') {
      mapInstance = mapInstance.getMap();
    }

    return super.hijack(mapInstance);
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HomesComOverlay;
} else if (typeof window !== 'undefined') {
  window.HomesComOverlay = HomesComOverlay;
}
