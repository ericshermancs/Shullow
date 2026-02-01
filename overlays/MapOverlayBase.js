/**
 * MapOverlayBase - Base class for all site-specific map overlays
 * 
 * This abstract base class provides the foundation for rendering POI markers
 * on different mapping platforms (Google Maps, Mapbox, etc.). Site-specific
 * overlays should extend this class and implement the abstract methods.
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
    
    this.debug = debug;
    this.mapInstance = null;
    this.container = null;
    this.isActive = false;
    this.pois = [];
    this.markers = new Map(); // id -> marker instance
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

  /**
   * Renders markers for the given POIs on the map
   * @abstract
   * @param {Array} pois - Array of POI objects with latitude, longitude, and metadata
   * @param {Object} mapInstance - The map instance to render on
   */
  renderMarkers(pois, mapInstance) {
    throw new Error('Must implement renderMarkers(pois, mapInstance)');
  }

  /**
   * Creates a single marker for a POI
   * @abstract
   * @param {Object} poi - POI object with latitude, longitude, and metadata
   * @param {Object} map - The map instance
   * @returns {Object} The created marker instance
   */
  createMarker(poi, map) {
    throw new Error('Must implement createMarker(poi, map)');
  }

  // ============================================
  // Optional Override Methods
  // ============================================

  /**
   * Updates an existing marker with new POI data
   * Override in subclass if needed
   * @param {Object} marker - The marker instance to update
   * @param {Object} poi - Updated POI data
   */
  updateMarker(marker, poi) {
    // Default: no-op, subclasses can override
  }

  /**
   * Removes a marker from the map
   * Override in subclass if needed
   * @param {Object} marker - The marker instance to remove
   */
  removeMarker(marker) {
    // Default implementation - subclasses should override for proper cleanup
    if (marker && marker.remove) {
      marker.remove();
    } else if (marker && marker.setMap) {
      marker.setMap(null);
    }
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
   * Inserts POI markers into the map
   * This is the main entry point called by the system
   * @param {Array} pois - Array of POI objects
   */
  insert(pois) {
    if (!this.mapInstance) {
      this.log('insert() called but no map instance available');
      return;
    }

    if (!Array.isArray(pois)) {
      this.log('insert() called with non-array pois');
      return;
    }

    this.pois = pois;
    this.renderMarkers(pois, this.mapInstance);
  }

  /**
   * Legacy render method - now delegates to renderMarkers
   * @deprecated Use insert() or renderMarkers() instead
   */
  render() {
    if (this.pois.length > 0 && this.mapInstance) {
      this.renderMarkers(this.pois, this.mapInstance);
    }
  }

  /**
   * Clears all markers from the map
   */
  clear() {
    this.markers.forEach((marker, id) => {
      this.removeMarker(marker);
    });
    this.markers.clear();
    this.log('All markers cleared');
  }

  /**
   * Cleans up the overlay and releases resources
   */
  cleanup() {
    this.clear();
    this.mapInstance = null;
    this.container = null;
    this.isActive = false;
    this.pois = [];
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
   * Checks if a native marker for this POI exists in the DOM
   * Logs only once per overlay session, not per POI.
   * Can be overridden by subclasses for site-specific logic
   * @param {Object} poi - POI object
   * @returns {boolean} True if native marker exists
   */
  _hasNativeMarker(poi) {
    if (typeof this._hasLoggedNativeMarker === 'undefined') {
      this._hasLoggedNativeMarker = false;
      this._nativeMarkerPreviouslyFound = false;
    }
    // Only check for EXACT class "poi-native-marker" - overlay markers have suffixes like -generic, -mapbox, -realtor
    const selector = `.poi-native-marker[data-id="${MapUtils.getPoiId(poi)}"]`;
    const found = !!document.querySelector(selector);
    // Only log once when native marker is first detected in this overlay session
    if (found && !this._hasLoggedNativeMarker && !this._nativeMarkerPreviouslyFound) {
      this.log('Native marker detected');
      this._hasLoggedNativeMarker = true;
    }
    // Track if native marker was ever found
    if (found) {
      this._nativeMarkerPreviouslyFound = true;
    }
    return found;
  }

  /**
   * Filters POIs to exclude those with native markers
   * @param {Array} pois - Array of POI objects
   * @returns {Array} Filtered POIs
   */
  _filterNativePois(pois) {
    console.log("Filtering native POIs");
    return pois.filter(poi => !this._hasNativeMarker(poi));
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
