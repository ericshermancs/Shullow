/**
 * GenericMapOverlay - Fallback overlay for unknown sites
 * 
 * This overlay handles both Google Maps and Mapbox instances,
 * detecting the map type for the OverlayRegistry.
 * Rendering is handled entirely by bridge/modules/renderer.js (poi-native-marker).
 * This class provides domain detection, map compatibility checks, and
 * Web Component unwrapping for the OverlayRegistry.
 */

class GenericMapOverlay extends MapOverlayBase {
  constructor(debug = false) {
    try {
      super(debug);
      console.log('[GenericMapOverlay] Constructor called');
      this.siteId = 'generic';
      this.detectedMapType = null; // 'google' or 'mapbox'
      console.log('[GenericMapOverlay] Constructor complete');
    } catch (err) {
      console.error('[GenericMapOverlay] CRITICAL ERROR in constructor:', err);
      throw err;
    }
  }

  /**
   * Override hijack to unwrap Web Component wrappers
   * Some sites (like apartments.com) wrap the map in a Web Component (gmp-map)
   * We need to unwrap it to get the actual Google Maps instance
   * @param {Object} mapInstance - The map instance to hijack
   * @returns {Object} - The result from parent hijack
   */
  hijack(mapInstance) {
    console.log('[GenericMapOverlay] hijack() called with mapInstance:', {
      type: typeof mapInstance,
      constructor: mapInstance?.constructor?.name,
      hasBounds: typeof mapInstance?.getBounds === 'function'
    });

    // Handle gmp-map Web Component wrapper
    if (mapInstance && !mapInstance.getBounds) {
      if (mapInstance.map) {
        console.log('[GenericMapOverlay] Unwrapping via .map property');
        mapInstance = mapInstance.map;
      } else if (mapInstance.innerMap) {
        console.log('[GenericMapOverlay] Unwrapping via .innerMap property');
        mapInstance = mapInstance.innerMap;
      } else if (typeof mapInstance.getMap === 'function') {
        console.log('[GenericMapOverlay] Unwrapping via .getMap() method');
        mapInstance = mapInstance.getMap();
      }
    }

    console.log('[GenericMapOverlay] After unwrapping:', {
      type: typeof mapInstance,
      constructor: mapInstance?.constructor?.name,
      hasBounds: typeof mapInstance?.getBounds === 'function'
    });

    return super.hijack(mapInstance);
  }

  /**
   * @override
   * Detects map container using multiple fallback strategies
   * @returns {HTMLElement|null} The map container element
   */
  detect() {
    // 8 fallback detection strategies
    const selectors = [
      '.gm-style',           // Google Maps
      '.mapboxgl-map',       // Mapbox GL JS
      '.leaflet-container',  // Leaflet
      'canvas',              // Canvas-based maps
      '#map-container',      // Common ID
      '.map-container',      // Common class
      '[data-rf-test-id="map"]', // Redfin specific
      'div[class*="Map"]',   // Generic Map class
      'div[class*="map"]'    // Generic map class (lowercase)
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        this.log('Detected generic map container:', selector);
        this.container = el;
        return el;
      }
    }

    return null;
  }

  /**
   * @override
   * Checks if the given map instance is compatible (Google or Mapbox)
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
  module.exports = GenericMapOverlay;
}
if (typeof window !== 'undefined') {
  window.GenericMapOverlay = GenericMapOverlay;
}
