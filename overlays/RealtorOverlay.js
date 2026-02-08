/**
 * RealtorOverlay - Site-specific overlay for Realtor.com
 * 
 * Realtor.com uses a mix of map technologies depending on the page.
 * This overlay extends MapOverlayBase and handles both Google Maps
 * and Mapbox instances, with Realtor-specific detection.
 */

/**
 * RealtorOverlay - Multi-map overlay for Realtor.com
 * 
 * Features:
 * - Detects both Google Maps and Mapbox on Realtor.com
 * - Web Component / Shadow DOM support
 * - Handles Realtor's specific DOM structure
 */
class RealtorOverlay extends MapOverlayBase {
  constructor(debug = false) {
    super(debug);
    this.siteId = 'realtor';
    this.detectedMapType = null; // 'google' or 'mapbox'
    
    // For Mapbox rendering
    this.activeMarkers = new Map();
    
    // For Google rendering
    this.markerPool = new MarkerPool();
    this.activeElements = new Map();
    
    // Native marker detection infrastructure
    this._nativeMarkersInjected = false;
    this._nativeMarkerObserver = null;
    this._nativeMarkerPollInterval = null;
    
    // Start native marker detection
    this._startNativeMarkerObserver();
    this._startNativeMarkerPolling();
  }

  /**
   * Gets the CSS selector for native markers
   * @returns {string} CSS selector for extension-injected native markers
   * @protected
   */
  _getNativeMarkerSelector() {
    // Only detect site-specific markers, not extension markers
    return null;
  }

  /**
   * Sets up a MutationObserver to watch for native marker insertion
   * @private
   */
  _startNativeMarkerObserver() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this._nativeMarkerObserver) return;
    
    const callback = (mutationsList) => {
      if (this._nativeMarkersInjected) return;
      
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
   * Stops the MutationObserver
   * @private
   */
  _stopNativeMarkerObserver() {
    if (this._nativeMarkerObserver) {
      this._nativeMarkerObserver.disconnect();
      this._nativeMarkerObserver = null;
    }
  }

  /**
   * Starts periodic polling to check if native markers have appeared
   * @private
   */
  _startNativeMarkerPolling() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this._nativeMarkerPollInterval) return;
    
    this.log('Starting native marker polling (250ms)...');
    let lastDetectedCount = 0;
    
    this._nativeMarkerPollInterval = setInterval(() => {
      try {
        if (this._nativeMarkersInjected) {
          this._stopNativeMarkerPolling();
          return;
        }
        
        const selector = this._getNativeMarkerSelector();
        if (!selector) return;
        
        const nativeMarkers = document.querySelectorAll(selector);
        const count = nativeMarkers.length;
        
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
    }, 250);
  }

  /**
   * Stops the periodic polling
   * @private
   */
  _stopNativeMarkerPolling() {
    if (this._nativeMarkerPollInterval) {
      clearInterval(this._nativeMarkerPollInterval);
      this._nativeMarkerPollInterval = null;
    }
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

  // _hasNativeMarker uses the base class implementation from MapOverlayBase

  /**
   * @override
   * Renders markers, delegating to the appropriate renderer
   * @param {Array} pois - Array of POI objects
   * @param {Object} mapInstance - The map instance
   */
  renderMarkers(pois, mapInstance) {
    // CRITICAL: Check native marker flag FIRST before any other logic
    if (this._nativeMarkersInjected) {
      this.log('Native markers injected (flag set), skipping overlay render');
      return;
    }
    
    // Actively check for native markers BEFORE rendering
    if (pois && pois.length > 0) {
      const selector = this._getNativeMarkerSelector();
      if (selector) {
        const nativeMarkers = document.querySelectorAll(selector);
        if (nativeMarkers.length > 0) {
          this._nativeMarkersInjected = true;
          this.log('Native markers detected at render time, clearing overlay');
          this.clear();
          return;
        }
      }
    }

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

    // Filter out POIs that already have a native marker
    const filteredPois = this._filterNativePois(pois);

    if (this.detectedMapType === 'google') {
      this._renderGoogleMarkers(filteredPois, mapInstance);
    } else if (this.detectedMapType === 'mapbox') {
      this._renderMapboxMarkers(filteredPois, mapInstance);
    }
  }

  /**
   * Renders markers on Google Maps
   * @private
   */
  _renderGoogleMarkers(pois, mapInstance) {
    if (!window.google || !window.google.maps) {
      this.log('Google Maps API not available');
      return;
    }

    // Reuse batch overlay if available
    if (!mapInstance._poiBatchLayer && window.PoiBatchOverlay) {
      mapInstance._poiBatchLayer = new window.PoiBatchOverlay(mapInstance);
      mapInstance._poiBatchLayer.setMap(mapInstance);
    }

    if (mapInstance._poiBatchLayer) {
      mapInstance._poiBatchLayer.updatePois(pois);
      this.log(`Rendered ${pois.length} Google markers`);
    }
  }

  /**
   * Renders markers on Mapbox
   * @private
   */
  _renderMapboxMarkers(pois, mapInstance) {
    if (!window.mapboxgl || !window.mapboxgl.Marker) {
      this.log('Mapbox GL JS not available');
      return;
    }

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

    this.log(`Rendered ${pois.length} Mapbox markers`);
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
    el.className = 'poi-overlay-marker-realtor';

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
    this.activeMarkers.forEach((marker) => {
      marker.remove();
    });
    this.activeMarkers.clear();
    
    this.activeElements.forEach((el) => {
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
    this._stopNativeMarkerPolling();
    this._stopNativeMarkerObserver();
    this.clear();
    this.markerPool.clear();
    this.detectedMapType = null;
    super.cleanup();
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RealtorOverlay;
} else if (typeof window !== 'undefined') {
  window.RealtorOverlay = RealtorOverlay;
}
