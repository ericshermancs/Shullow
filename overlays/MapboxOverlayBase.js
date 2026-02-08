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
    this._nativeMarkersInjected = false; // Flag to track native marker injection
    this._nativeMarkerObserver = null;
    this._nativeMarkerPollInterval = null; // Periodic check for native markers

    this.log(`[${this.constructor.name}] instance created. Debug:`, debug);

    // --- Automatic native marker detection and overlay clearing ---
    this._startNativeMarkerObserver();
    this._startNativeMarkerPolling();
  }

  /**
   * Sets up a MutationObserver to watch for native marker insertion and auto-clear overlays
   * Subclasses should override _getNativeMarkerSelector() to provide site-specific selectors
   */
  _startNativeMarkerObserver() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this._nativeMarkerObserver) return;
    const callback = (mutationsList) => {
      if (this._nativeMarkersInjected) return;
      
      // Use subclass-specific selector for native markers
      const selector = this._getNativeMarkerSelector();
      if (selector && document.querySelector(selector)) {
        this._nativeMarkersInjected = true;
        this.log('Native marker detected by MutationObserver, clearing overlay markers');
        this.clear();
      }
    };
    this._nativeMarkerObserver = new MutationObserver(callback);
    this._nativeMarkerObserver.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * Stops the periodic native marker polling
   * @private
   */
  _stopNativeMarkerPolling() {
    if (this._nativeMarkerPollInterval) {
      clearInterval(this._nativeMarkerPollInterval);
      this._nativeMarkerPollInterval = null;
    }
  }

  /**
   * Starts periodic polling to check if native markers have appeared
   * Subclasses should override _getNativeMarkerSelector() to provide site-specific selectors
   * @private
   */
  _startNativeMarkerPolling() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this._nativeMarkerPollInterval) return;
    
    this.log('Starting native marker polling (250ms)...');
    
    // Keep track of detected markers count to avoid redundant clears
    let lastDetectedCount = 0;
    
    this._nativeMarkerPollInterval = setInterval(() => {
      try {
        // If already using native markers, stop polling
        if (this._nativeMarkersInjected) {
          this._stopNativeMarkerPolling();
          return;
        }
        
        // Use subclass-specific selector for native markers
        const selector = this._getNativeMarkerSelector();
        if (!selector) {
          return;
        }
        
        const nativeMarkers = document.querySelectorAll(selector);
        const count = nativeMarkers.length;
        
        // React if native markers appeared (count changed from 0 to >0)
        if (count > 0 && lastDetectedCount === 0) {
          this._nativeMarkersInjected = true;
          this.log(`Native markers detected by polling (${count} found), immediately clearing overlay`);
          this.clear();
          this._stopNativeMarkerPolling();
        }
        lastDetectedCount = count;
      } catch (e) {
        this.log('Error during native marker polling:', e);
      }
    }, 250); // Poll every 250ms for faster detection
  }

  /**
   * Gets the CSS selector for native markers on this site
   * Override in subclass to provide site-specific selectors (e.g., site's own pins)
   * Base class returns the extension's native marker class for automatic switching
   * @returns {string|null} CSS selector or null if no native markers expected
   * @protected
   */
  _getNativeMarkerSelector() {
    // Base class returns null - we ARE the native rendering system.
    // Subclasses override to detect the SITE's own markers to avoid doubling up.
    return null;
  }

  /**
   * Disconnects the MutationObserver (call on cleanup)
   */
  _stopNativeMarkerObserver() {
    if (this._nativeMarkerObserver) {
      this._nativeMarkerObserver.disconnect();
      this._nativeMarkerObserver = null;
    }
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
    this.log(`renderMarkers called: ${pois?.length || 0} POIs, mapInstance=${!!mapInstance}, activeMarkers=${this.activeMarkers.size}, _nativeMarkersInjected=${this._nativeMarkersInjected}`);
    // CRITICAL: Check native marker flag FIRST before any other logic
    // This prevents re-rendering after native markers are detected
    if (this._nativeMarkersInjected) {
      this.log('Native markers injected (flag set), skipping overlay render');
      return;
    }
    
    // Actively check for site native markers BEFORE rendering
    // This ensures we detect them even if polling hasn't run yet
    if (pois && pois.length > 0) {
      const selector = this._getNativeMarkerSelector();
      if (selector) {
        const nativeMarkers = document.querySelectorAll(selector);
        if (nativeMarkers.length > 0) {
          this._nativeMarkersInjected = true;
          this.log('Site native markers detected at render time, clearing overlay');
          this.clear();
          return;
        }
      }
    }

    const filteredPois = this._filterNativePois(pois);
    this.log(`After filtering: ${filteredPois.length} of ${pois.length} POIs remain`);

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

      // Update existing marker's color if it changed
      if (this.activeMarkers.has(id)) {
        const marker = this.activeMarkers.get(id);
        const el = marker.getElement ? marker.getElement() : null;
        if (el) {
          const color = poi.color || '#ff0000';
          const secondaryColor = poi.secondaryColor || '#ffffff';
          const logo = poi.logoData;
          const fallbackSvg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);
          el.style.backgroundImage = `url('${logo || fallbackSvg}')`;
          console.log(`[MAPBOX] Updated marker color: id=${id.substr(-8)}, color=${color}`);
        }
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
    el.className = 'poi-overlay-marker-mapbox';

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
    this._stopNativeMarkerObserver();
    this._stopNativeMarkerPolling();
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
    return pois.filter(poi => !this._hasNativeMarker(poi));
  }

  // _hasNativeMarker uses the base class implementation from MapOverlayBase
  // which delegates to _hasSiteNativeMarker() and _hasExtensionMarker().
}

// Export for different module systems
if (typeof window !== 'undefined') {
  window.MapboxOverlayBase = MapboxOverlayBase;
}
