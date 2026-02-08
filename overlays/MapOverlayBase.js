/**
 * MapOverlayBase - Base class for all site-specific map overlays
 * 
 * This abstract base class provides the foundation for domain detection,
 * map compatibility checks, and bounds tracking for the OverlayRegistry.
 * Rendering is handled entirely by bridge/modules/renderer.js (poi-native-marker).
 * 
 * @abstract
 */
class MapOverlayBase {
  /**
   * Creates a new MapOverlayBase instance
   * @param {boolean} debug - Enable debug logging
   */
  constructor(debug = false) {
    if (new.target === MapOverlayBase) {
      throw new Error('MapOverlayBase is abstract and cannot be instantiated directly');
    }
    
    console.log(`[${this.constructor.name}][${new.target.name}] Constructor called`);
    
    this.debug = debug;
    this.mapInstance = null;
    this.container = null;
    this.isActive = false;
    this.mapId = null; // Unique identifier for this map instance
    this.domain = null; // Domain this overlay was instantiated for
    this.detectedAt = null; // Timestamp when map was detected
  }

  /**
   * Logs debug messages if debug mode is enabled
   * @param {...any} args - Arguments to log
   */
  log(...args) {
    if (this.debug) {
      console.log(`[${this.constructor.name}]`, ...args);
    }
  }

  /**
   * Generates a unique map ID for this overlay instance
   * @returns {string} Unique map identifier
   */
  generateMapId() {
    return `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================

  /**
   * Detects and returns the map container element for this site
   * @abstract
   * @returns {HTMLElement|null} The map container element or null if not found
   */
  detect() {
    throw new Error('Must implement detect() - returns the map container element');
  }

  /**
   * Checks if the given map instance is compatible with this overlay
   * @abstract
   * @param {Object} mapInstance - The map instance to check
   * @returns {boolean} True if compatible, false otherwise
   */
  isCompatibleMap(mapInstance) {
    throw new Error('Must implement isCompatibleMap(mapInstance)');
  }

  // ============================================
  // Core Lifecycle Methods
  // ============================================

  /**
   * Hijacks/initializes the map instance for this overlay
   * Called after detect() successfully finds a container
   * @param {Object} mapInstance - The map instance to hijack
   */
  hijack(mapInstance) {
    if (!mapInstance) {
      this.log('hijack() called with null map instance');
      return false;
    }

    if (!this.isCompatibleMap(mapInstance)) {
      this.log('Map instance is not compatible with this overlay');
      return false;
    }

    this.mapInstance = mapInstance;
    this.mapId = this.generateMapId();
    this.detectedAt = Date.now();
    this.isActive = true;

    this.log('Map hijacked successfully, mapId:', this.mapId);
    return true;
  }

  /**
   * Clears overlay state (no rendering to clear — handled by renderer.js)
   */
  clear() {
    this.log('Clear called');
  }

  /**
   * Cleans up the overlay and releases resources
   */
  cleanup() {
    this.clear();
    this.mapInstance = null;
    this.container = null;
    this.isActive = false;
    this.log('Overlay cleaned up');
  }

  /**
   * Gets the current map bounds
   * @returns {Object|null} Bounds object with north, south, east, west or null
   */
  getBounds() {
    if (!this.mapInstance) return null;

    try {
      const b = this.mapInstance.getBounds();
      if (!b) return null;

      // Google Maps format
      if (b.getNorthEast && b.getSouthWest) {
        return {
          north: b.getNorthEast().lat(),
          south: b.getSouthWest().lat(),
          east: b.getNorthEast().lng(),
          west: b.getSouthWest().lng()
        };
      }

      // Mapbox format
      if (b.getNorth) {
        return {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest()
        };
      }
    } catch (e) {
      this.log('Error getting bounds:', e);
    }

    return null;
  }

  /**
   * Filters POIs to only those within the current map bounds
   * @param {Array} pois - Array of POI objects
   * @returns {Array} Filtered POIs within bounds
   */
  filterByBounds(pois) {
    const bounds = this.getBounds();
    if (!bounds) return pois;

    return pois.filter(poi => {
      const lat = parseFloat(poi.latitude);
      const lng = parseFloat(poi.longitude);
      return (
        lat >= bounds.south &&
        lat <= bounds.north &&
        lng >= bounds.west &&
        lng <= bounds.east
      );
    });
  }
}

// Export for ES modules and window global for script tag inclusion
if (typeof window !== 'undefined') {
  window.MapOverlayBase = MapOverlayBase;
}
