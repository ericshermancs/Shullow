/**
 * MapboxOverlayBase - Base class for Mapbox GL JS overlays
 * 
 * Extends MapOverlayBase with Mapbox-specific rendering using
 * native Mapbox markers with custom HTML elements.
 */

// Ensure MapOverlayBase is available
if (typeof MapOverlayBase === 'undefined' && typeof window !== 'undefined') {
  // Will be loaded via script tag order in manifest
}

/**
 * MapboxOverlayBase - Mapbox GL JS specific overlay implementation
 * 
 * Features:
 * - Uses native Mapbox markers with custom elements
 * - Automatic marker lifecycle management
 * - Click/hover event handling
 * - Inline z-index styles for proper stacking
 */
class MapboxOverlayBase extends MapOverlayBase {
  /**
   * Creates a new MapboxOverlayBase instance
   * @param {boolean} debug - Enable debug logging
   */
  constructor(debug = false) {
    super(debug);
    this.activeMarkers = new Map(); // POI ID -> Mapbox Marker instance
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
   * Gets the z-index for markers (can be overridden by subclasses)
   * @returns {number} The z-index value
   */
  getMarkerZIndex() {
    return 10;
  }

  /**
   * @override
   * Renders markers for Mapbox overlays
   * @param {Array} pois - Array of POI objects
   * @param {Object} mapInstance - The map instance
   */
  renderMarkers(pois, mapInstance) {
    const filteredPois = this._filterNativePois(pois);

    if (!mapInstance) {
      this.log('No map instance provided');
      return;
    }

    if (!window.mapboxgl || !window.mapboxgl.Marker) {
      this.log('Mapbox GL JS not available');
      return;
    }

    // Generate unique ID for this map if not exists
    if (!mapInstance._poiUid) {
      mapInstance._poiUid = Math.random().toString(36).substr(2, 9);
    }

    const usedIds = new Set();

    filteredPois.forEach(poi => {
      const id = `${mapInstance._poiUid}-${MapUtils.getPoiId(poi)}`;
      usedIds.add(id);

      // Skip if marker already exists
      if (this.activeMarkers.has(id)) {
        return;
      }

      // Create marker element and Mapbox marker
      const marker = this.createMarker(poi, mapInstance);
      
      // Store reference
      this.activeMarkers.set(id, marker);
      this.markers.set(id, marker);
    });

    // Cleanup markers no longer in POI list
    this.activeMarkers.forEach((marker, id) => {
      if (id.startsWith(mapInstance._poiUid) && !usedIds.has(id)) {
        this.removeMarker(marker);
        this.activeMarkers.delete(id);
        this.markers.delete(id);
      }
    });

    this.log(`Rendered ${filteredPois.length} markers, active: ${this.activeMarkers.size}`);
  }

  /**
   * @override
   * Creates a single Mapbox marker for a POI
   * @param {Object} poi - POI object
   * @param {Object} map - Mapbox GL JS instance
   * @returns {Object} The Mapbox Marker instance
   */
  createMarker(poi, map) {
    const el = this.createMarkerElement(poi);
    
    // Create Mapbox marker with custom element
    const marker = new window.mapboxgl.Marker({ element: el })
      .setLngLat([parseFloat(poi.longitude), parseFloat(poi.latitude)])
      .addTo(map);

    return marker;
  }

  /**
   * Creates the DOM element for a marker
   * Can be overridden by subclasses for custom styling
   * @param {Object} poi - POI object
   * @returns {HTMLElement} The marker element
   */
  createMarkerElement(poi) {
    const el = document.createElement('div');
    el.className = 'poi-native-marker-mapbox';

    const color = poi.color || '#ff0000';
    const secondaryColor = poi.secondaryColor || '#ffffff';
    const logo = poi.logoData;
    const zIndex = this.getMarkerZIndex();

    // Fallback SVG if no logo
    const fallbackSvg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);

    el.style.cssText = `
      width: 32px;
      height: 32px;
      cursor: pointer;
      position: relative;
      z-index: ${zIndex};
      background-image: url('${logo || fallbackSvg}');
      background-size: contain;
      background-repeat: no-repeat;
      filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
    `;

    // Store POI data on element
    el.setAttribute('data-id', MapUtils.getPoiId(poi));
    el.setAttribute('data-lat', poi.latitude);
    el.setAttribute('data-lng', poi.longitude);

    // Click handler
    el.onclick = (e) => {
      e.stopPropagation();
      window.postMessage({
        type: 'POI_MARKER_CLICK',
        id: poi.id,
        lat: poi.latitude,
        lng: poi.longitude
      }, '*');
    };

    // Hover handlers
    el.onmouseenter = () => {
      el.style.zIndex = '1000000';
      window.postMessage({
        type: 'POI_MARKER_HOVER',
        id: poi.id,
        lat: poi.latitude,
        lng: poi.longitude
      }, '*');
    };

    el.onmouseleave = () => {
      el.style.zIndex = String(zIndex);
      window.postMessage({
        type: 'POI_MARKER_LEAVE',
        id: poi.id
      }, '*');
    };

    return el;
  }

  /**
   * @override
   * Removes a Mapbox marker
   * @param {Object} marker - The Mapbox Marker instance
   */
  removeMarker(marker) {
    if (marker && typeof marker.remove === 'function') {
      marker.remove();
    }
  }

  /**
   * @override
   * Clears all markers
   */
  clear() {
    this.activeMarkers.forEach((marker, id) => {
      this.removeMarker(marker);
    });
    this.activeMarkers.clear();
    super.clear();
  }

  /**
   * @override
   * Cleanup resources
   */
  cleanup() {
    this.clear();
    super.cleanup();
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
   * Filters out POIs with native markers
   * @param {Array} pois - Array of POI objects
   * @returns {Array} Filtered POI objects
   */
  _filterNativePois(pois) {
    return pois.filter(poi => !this.hasNativeMarker(poi));
  }

  /**
   * Checks if a POI has a native marker
   * @param {Object} poi - POI object
   * @returns {boolean} True if the POI has a native marker
   */
  hasNativeMarker(poi) {
    return this.activeMarkers.has(`${this._mapInstance._poiUid}-${MapUtils.getPoiId(poi)}`);
  }
}

// Export for different module systems
if (typeof window !== 'undefined') {
  window.MapboxOverlayBase = MapboxOverlayBase;
}
