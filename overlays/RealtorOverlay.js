/**
 * RealtorOverlay - Site-specific overlay for Realtor.com
 * 
 * Realtor.com uses a mix of map technologies depending on the page.
 * Rendering is handled entirely by bridge/modules/renderer.js (poi-native-marker).
 * This class provides domain detection, map compatibility checks, and
 * Shadow DOM traversal for the OverlayRegistry.
 */

class RealtorOverlay extends MapOverlayBase {
  constructor(debug = false) {
    super(debug);
    this.siteId = 'realtor';
    this.detectedMapType = null; // 'google' or 'mapbox'
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
          if (s.tagName.includes('ICON') || s.tagName.includes('BUTTON')) continue;
          this._findInShadow(s.shadowRoot, selector, found);
        }
      }
    } catch(e) {}
    return found;
  }

  /**
   * @override
   * Detects the Realtor.com map container
   * @returns {HTMLElement|null} The map container element
   */
  detect() {
    // Realtor.com selectors (may use either Google Maps or Mapbox)
    const selectors = [
      '.mapboxgl-map',
      '.gm-style',
      'gmp-map',
      '#map-container',
      '[data-testid="map"]',
      '.map-container',
      '#mapboxgl-map'
    ];

    // First try standard DOM
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        this.log('Detected Realtor map container:', selector);
        this.container = el;
        
        // Determine map type from selector
        if (selector.includes('mapbox')) {
          this.detectedMapType = 'mapbox';
        } else if (selector.includes('gm-style') || selector.includes('gmp-')) {
          this.detectedMapType = 'google';
        }
        
        return el;
      }
    }

    // Try Shadow DOM for Web Components
    const shadowElements = this._findInShadow(document, 'gmp-map, .gm-style, .mapboxgl-map');
    if (shadowElements.length > 0) {
      const el = shadowElements[0];
      this.log('Detected Realtor map in Shadow DOM');
      this.container = el;
      return el;
    }

    return null;
  }

  /**
   * @override
   * Checks if the given map instance is compatible
   * @param {Object} mapInstance - The map instance to check
   * @returns {boolean} True if compatible
   */
  isCompatibleMap(mapInstance) {
    if (MapTypeDetector.isGoogleMap(mapInstance)) {
      this.detectedMapType = 'google';
      return true;
    }
    if (MapTypeDetector.isMapbox(mapInstance)) {
      this.detectedMapType = 'mapbox';
      return true;
    }
    return false;
  }

  /**
   * @override
   * Cleanup resources
   */
  cleanup() {
    this.detectedMapType = null;
    super.cleanup();
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RealtorOverlay;
}
if (typeof window !== 'undefined') {
  window.RealtorOverlay = RealtorOverlay;
}
