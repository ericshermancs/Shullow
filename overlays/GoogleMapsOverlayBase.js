/**
 * GoogleMapsOverlayBase - Base class for Google Maps overlays
 * 
 * Extends MapOverlayBase with Google Maps-specific detection.
 * Rendering is handled entirely by bridge/modules/renderer.js (poi-native-marker).
 * This class provides domain detection, map compatibility checks, and site-specific
 * hijack/detect/bounds logic for the OverlayRegistry.
 */

class GoogleMapsOverlayBase extends MapOverlayBase {
  /**
   * Creates a new GoogleMapsOverlayBase instance
   * @param {boolean} debug - Enable debug logging
   */
  constructor(debug = false) {
    super(debug);
    this.log(`[${this.constructor.name}] instance created. Debug:`, debug);
  }

  /**
   * @override
   * Checks if the given map instance is a Google Maps instance
   * @param {Object} mapInstance - The map instance to check
   * @returns {boolean} True if Google Maps
   */
  isCompatibleMap(mapInstance) {
    return MapTypeDetector.isGoogleMap(mapInstance);
  }

  /**
   * @override
   * Cleanup resources
   */
  cleanup() {
    super.cleanup();
  }
}

// Export for different module systems
if (typeof window !== 'undefined') {
  window.GoogleMapsOverlayBase = GoogleMapsOverlayBase;
}
