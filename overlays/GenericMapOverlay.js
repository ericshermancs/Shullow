/**
 * GenericMapOverlay - Fallback overlay for unknown sites
 * 
 * This overlay handles both Google Maps and Mapbox instances,
 * detecting the map type and delegating rendering appropriately.
 * Uses all 8 fallback strategies from the original discovery module.
 */

/**
 * GenericMapOverlay - Universal fallback overlay
 * 
 * Features:
 * - Detects both Google Maps and Mapbox instances
 * - Uses 8 fallback detection strategies
 * - Delegates rendering to appropriate base class methods
 */
class GenericMapOverlay extends MapOverlayBase {
  constructor(debug = false) {
    super(debug);
    this.siteId = 'generic';
    this.detectedMapType = null; // 'google' or 'mapbox'

    // For Google Maps rendering
    this.markerPool = new MarkerPool();
    this.activeElements = new Map();
    this.batchOverlay = null;

    // For Mapbox rendering
    this.activeMarkers = new Map();

    // Suppress repeated logs
    this._hasLoggedGoogleMarkers = false;
    this._hasLoggedMapboxMarkers = false;
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
   * Renders markers for generic overlays
   * @param {Array} pois - Array of POI objects
   * @param {Object} mapInstance - The map instance
   */
  renderMarkers(pois, mapInstance) {
    const filteredPois = this._filterNativePois(pois);
    if (!mapInstance) {
      this.log('No map instance provided');
      return;
    }

    // Determine map type if not already known
    if (!this.detectedMapType) {
      if (MapTypeDetector.isGoogleMap(mapInstance)) {
        this.detectedMapType = 'google';
      } else if (MapTypeDetector.isMapbox(mapInstance)) {
        this.detectedMapType = 'mapbox';
      } else {
        this.log('Unknown map type, cannot render');
        return;
      }
    }

    if (this.detectedMapType === 'google') {
      this._renderGoogleMarkers(filteredPois, mapInstance);
    } else if (this.detectedMapType === 'mapbox') {
      this._renderMapboxMarkers(filteredPois, mapInstance);
    }
  }

  /**
   * Renders markers on Google Maps
   * @param {Array} pois - Array of POI objects
   * @param {Object} mapInstance - Google Maps instance
   * @private
   */
  _renderGoogleMarkers(pois, mapInstance) {
    if (!window.google || !window.google.maps || !window.google.maps.OverlayView) {
      if (!this._hasLoggedGoogleMarkers) {
        this.log('Google Maps API not available');
        this._hasLoggedGoogleMarkers = true;
      }
      return;
    }

    // Reuse GoogleMapsOverlayBase rendering logic
    // Create batch overlay if it doesn't exist
    if (!mapInstance._poiBatchLayer && window.PoiBatchOverlay) {
      mapInstance._poiBatchLayer = new window.PoiBatchOverlay(mapInstance);
      mapInstance._poiBatchLayer.setMap(mapInstance);
    }

    if (mapInstance._poiBatchLayer) {
      mapInstance._poiBatchLayer.updatePois(pois);
      if (pois.length > 0) {
        if (!this._hasLoggedGoogleMarkers) {
          this.log(`Rendered ${pois.length} Google markers`);
          this._hasLoggedGoogleMarkers = true;
        }
      } else {
        this._hasLoggedGoogleMarkers = false;
      }
    }
  }

  /**
   * Renders markers on Mapbox
   * @param {Array} pois - Array of POI objects
   * @param {Object} mapInstance - Mapbox instance
   * @private
   */
  _renderMapboxMarkers(pois, mapInstance) {
    if (!window.mapboxgl || !window.mapboxgl.Marker) {
      if (!this._hasLoggedMapboxMarkers) {
        this.log('Mapbox GL JS not available');
        this._hasLoggedMapboxMarkers = true;
      }
      return;
    }

    // Generate unique ID for this map
    if (!mapInstance._poiUid) {
      mapInstance._poiUid = Math.random().toString(36).substr(2, 9);
    }

    const usedIds = new Set();

    pois.forEach(poi => {
      const id = `${mapInstance._poiUid}-${MapUtils.getPoiId(poi)}`;
      usedIds.add(id);

      if (this.activeMarkers.has(id)) return;

      const el = this.createMarker(poi, mapInstance);
      const marker = new window.mapboxgl.Marker({ element: el })
        .setLngLat([parseFloat(poi.longitude), parseFloat(poi.latitude)])
        .addTo(mapInstance);

      this.activeMarkers.set(id, marker);
    });

    // Cleanup old markers
    this.activeMarkers.forEach((marker, id) => {
      if (id.startsWith(mapInstance._poiUid) && !usedIds.has(id)) {
        marker.remove();
        this.activeMarkers.delete(id);
      }
    });

    if (pois.length > 0) {
      if (!this._hasLoggedMapboxMarkers) {
        this.log(`Rendered ${pois.length} Mapbox markers`);
        this._hasLoggedMapboxMarkers = true;
      }
    } else {
      this._hasLoggedMapboxMarkers = false;
    }
  }

  /**
   * @override
   * Creates a marker element
   * @param {Object} poi - POI object
   * @param {Object} map - Map instance
   * @returns {HTMLElement} The marker element
   */
  createMarker(poi, map) {
    const el = document.createElement('div');
    el.className = 'poi-native-marker-generic';

    const color = poi.color || '#ff0000';
    const secondaryColor = poi.secondaryColor || '#ffffff';
    const logo = poi.logoData;
    const fallbackSvg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);

    el.style.cssText = `
      width: 32px;
      height: 32px;
      cursor: pointer;
      position: relative;
      z-index: 10;
      background-image: url('${logo || fallbackSvg}');
      background-size: contain;
      background-repeat: no-repeat;
      filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
    `;

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
      el.style.zIndex = '10';
      window.postMessage({
        type: 'POI_MARKER_LEAVE',
        id: poi.id
      }, '*');
    };

    return el;
  }

  /**
   * @override
   * Clears all markers
   */
  clear() {
    // Clear Mapbox markers
    this.activeMarkers.forEach((marker, id) => {
      marker.remove();
    });
    this.activeMarkers.clear();

    // Clear Google markers (via pool)
    this.activeElements.forEach((el, id) => {
      this.markerPool.release(el);
    });
    this.activeElements.clear();

    super.clear();
  }

  /**
   * @override
   * Cleanup resources
   */
  cleanup() {
    this.clear();
    this.markerPool.clear();
    this.detectedMapType = null;
    super.cleanup();
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenericMapOverlay;
} else if (typeof window !== 'undefined') {
  window.GenericMapOverlay = GenericMapOverlay;
}
