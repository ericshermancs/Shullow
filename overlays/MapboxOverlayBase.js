/**
 * MapboxOverlayBase - Base class for Mapbox GL JS overlays
 * 
 * Extends MapOverlayBase with Mapbox-specific detection.
 * Rendering is handled entirely by bridge/modules/renderer.js (poi-native-marker-mapbox).
 * This class provides domain detection, map compatibility checks, and site-specific
 * hijack/detect/bounds logic for the OverlayRegistry.
 */

class MapboxOverlayBase extends MapOverlayBase {
  /**
   * Creates a new MapboxOverlayBase instance
   * @param {boolean} debug - Enable debug logging
   */
  constructor(debug = false) {
    super(debug);
    this.log(`[${this.constructor.name}] instance created. Debug:`, debug);
  }

  /**
   * @override
   * Checks if the given map instance is a Mapbox GL JS instance
   * @param {Object} mapInstance - The map instance to check
   * @returns {boolean} True if Mapbox GL JS
   */
  isCompatibleMap(mapInstance) {
    return MapTypeDetector.isMapbox(mapInstance);
  }

  /**
   * @override
   * Gets the current map bounds from a Mapbox map
   * @returns {Object|null} Bounds object with north, south, east, west or null
   */
  getBounds() {
    if (!this.mapInstance) return null;

    try {
      const b = this.mapInstance.getBounds();
      if (!b) return null;

      return {
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest()
      };
    } catch (e) {
      this.log('Error getting bounds:', e);
    }

    return null;
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
  window.MapboxOverlayBase = MapboxOverlayBase;
}
