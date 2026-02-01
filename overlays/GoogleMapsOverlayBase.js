/**
 * GoogleMapsOverlayBase - Base class for Google Maps overlays
 * 
 * Extends MapOverlayBase with Google Maps-specific rendering using
 * a batched OverlayView for optimal performance.
 */

// Ensure MapOverlayBase is available
if (typeof MapOverlayBase === 'undefined' && typeof window !== 'undefined') {
  // Will be loaded via script tag order in manifest
}

/**
 * GoogleMapsOverlayBase - Google Maps specific overlay implementation
 * 
 * Features:
 * - Uses single OverlayView for all markers (batched rendering)
 * - Marker element pooling for performance
 * - Viewport culling (only renders visible markers)
 * - Event delegation for click/hover
 */
class GoogleMapsOverlayBase extends MapOverlayBase {
  /**
   * Creates a new GoogleMapsOverlayBase instance
   * @param {boolean} debug - Enable debug logging
   */
  constructor(debug = false) {
    super(debug);
    this.markerPool = new MarkerPool();
    this.batchOverlay = null;
    this.activeElements = new Map(); // POI ID -> Element
    this._nativeMarkersInjected = false; // Flag to track native marker injection

    this.log(`[${this.constructor.name}] instance created. Debug:`, debug);

    // --- Automatic native marker detection and overlay clearing ---
    this._nativeMarkerObserver = null;
    this._startNativeMarkerObserver();
  }

  /**
   * Sets up a MutationObserver to watch for native marker insertion and auto-clear overlays
   */
  _startNativeMarkerObserver() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this._nativeMarkerObserver) return;
    const callback = (mutationsList) => {
      this.log('MutationObserver callback fired', mutationsList);
      if (this._nativeMarkersInjected) return;
      // Look for any element with class 'poi-native-marker' (not overlay markers)
      if (document.querySelector('.poi-native-marker')) {
        this._nativeMarkersInjected = true;
        this.log('Native marker detected by MutationObserver, clearing overlay markers');
        this.clear();
      }
    };
    this._nativeMarkerObserver = new MutationObserver(callback);
    this._nativeMarkerObserver.observe(document.body, { childList: true, subtree: true });
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
   * Checks if the given map instance is a Google Maps instance
   * @param {Object} mapInstance - The map instance to check
   * @returns {boolean} True if Google Maps
   */
  isCompatibleMap(mapInstance) {
    return MapTypeDetector.isGoogleMap(mapInstance);
  }

  /**
   * Creates the PoiBatchOverlay class (Google Maps OverlayView)
   * This is created dynamically because it depends on google.maps being loaded
   * @returns {Function} The PoiBatchOverlay class
   * @private
   */
  _createBatchOverlayClass() {
    if (window.PoiBatchOverlay) {
      return window.PoiBatchOverlay;
    }

    if (!window.google || !window.google.maps || !window.google.maps.OverlayView) {
      this.log('Google Maps API not available');
      return null;
    }

    const self = this;

    class PoiBatchOverlay extends window.google.maps.OverlayView {
      constructor(mapInstance) {
        super();
        this.mapInstance = mapInstance;
        this.container = document.createElement('div');
        this.container.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
        this.pois = [];
        this.hasPendingDraw = false;

        // Event Delegation - Click
        this.container.addEventListener('click', (e) => {
          const target = e.target.closest('.poi-native-marker');
          if (target) {
            e.stopPropagation();
            const id = target.getAttribute('data-id');
            const lat = parseFloat(target.getAttribute('data-lat'));
            const lng = parseFloat(target.getAttribute('data-lng'));
            window.postMessage({ type: 'POI_MARKER_CLICK', id, lat, lng }, '*');
          }
        }, true);

        // Event Delegation - Mouse Enter
        this.container.addEventListener('mouseenter', (e) => {
          const target = e.target.closest('.poi-native-marker');
          if (target) {
            target.style.zIndex = '1000000';
            const id = target.getAttribute('data-id');
            const lat = parseFloat(target.getAttribute('data-lat'));
            const lng = parseFloat(target.getAttribute('data-lng'));
            window.postMessage({ type: 'POI_MARKER_HOVER', id, lat, lng }, '*');
          }
        }, true);

        // Event Delegation - Mouse Leave
        this.container.addEventListener('mouseleave', (e) => {
          const target = e.target.closest('.poi-native-marker');
          if (target) {
            target.style.zIndex = '102';
            const id = target.getAttribute('data-id');
            window.postMessage({ type: 'POI_MARKER_LEAVE', id }, '*');
          }
        }, true);
      }

      updatePois(newPois) {
        this.pois = newPois;
        if (newPois && newPois.length > 0) {
          // Set flag to indicate native markers are injected
          self._nativeMarkersInjected = true;
        }
        if (this.getProjection()) this.draw();
      }

      onAdd() {
        this.getPanes().floatPane.appendChild(this.container);
      }

      onRemove() {
        if (this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
      }

      draw() {
        if (this.hasPendingDraw) return;
        this.hasPendingDraw = true;

        requestAnimationFrame(() => {
          this.hasPendingDraw = false;
          this._drawBatch();
        });
      }

      _drawBatch() {
        const projection = this.getProjection();
        if (!projection) return;

        const bounds = this.mapInstance.getBounds();
        if (!bounds) return;

        const visibleIds = new Set();
        const fragment = document.createDocumentFragment();

        this.pois.forEach(poi => {
          const lat = parseFloat(poi.latitude);
          const lng = parseFloat(poi.longitude);
          const latLng = new window.google.maps.LatLng(lat, lng);

          // Bounds Check - skip markers outside viewport
          if (!bounds.contains(latLng)) return;

          const id = MapUtils.getPoiId(poi);
          visibleIds.add(id);

          const pos = projection.fromLatLngToDivPixel(latLng);

          let el = self.activeElements.get(id);

          if (!el) {
            // Get from pool or create new
            el = self.markerPool.acquire(() => {
              const div = document.createElement('div');
              div.className = 'poi-native-marker';
              div.style.cssText = `
                position: absolute; width: 32px; height: 32px;
                background-size: contain; background-repeat: no-repeat;
                pointer-events: auto; cursor: pointer; z-index: 102;
                will-change: transform; top: 0; left: 0;
                filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
              `;
              return div;
            });

            // Update visual content
            const color = poi.color || '#ff0000';
            const secondaryColor = poi.secondaryColor || '#ffffff';
            const svg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);
            el.style.backgroundImage = `url('${poi.logoData || svg}')`;

            // Store data attributes for delegation
            el.setAttribute('data-id', id);
            el.setAttribute('data-lat', lat);
            el.setAttribute('data-lng', lng);

            self.activeElements.set(id, el);
            fragment.appendChild(el);
          }

          // Update position using transform (faster than top/left)
          el.style.transform = `translate(-50%, -100%) translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
        });

        // Append new elements
        if (fragment.childElementCount > 0) {
          this.container.appendChild(fragment);
        }

        // Cleanup hidden elements (return to pool)
        self.activeElements.forEach((el, id) => {
          if (!visibleIds.has(id)) {
            self.markerPool.release(el);
            self.activeElements.delete(id);
          }
        });
      }
    }

    window.PoiBatchOverlay = PoiBatchOverlay;
    return PoiBatchOverlay;
  }

  /**
   * @override
   * Renders markers for Google Maps overlays
   * @param {Array} pois - Array of POI objects
   * @param {Object} mapInstance - The map instance
   */
  renderMarkers(pois, mapInstance) {
    // If native markers have been injected, proactively clear overlays
    if (this._nativeMarkersInjected) {
      this.log('Native markers injected, clearing overlay markers');
      this.clear(); // Remove overlay markers immediately
      return;
    }
    const filteredPois = this._filterNativePois(pois);
    if (!mapInstance) {
      this.log('No map instance provided');
      return;
    }

    // Ensure OverlayView class is created
    const PoiBatchOverlay = this._createBatchOverlayClass();
    if (!PoiBatchOverlay) {
      this.log('Could not create PoiBatchOverlay class');
      return;
    }

    // Create or get the batch layer for this map
    if (!mapInstance._poiBatchLayer) {
      mapInstance._poiBatchLayer = new PoiBatchOverlay(mapInstance);
      mapInstance._poiBatchLayer.setMap(mapInstance);
      this.batchOverlay = mapInstance._poiBatchLayer;
    }

    // Update POI data
    mapInstance._poiBatchLayer.updatePois(filteredPois);
    this.log(`Rendered ${filteredPois.length} markers`);
  }

  /**
   * @override
   * Creates a single marker element (used for individual marker creation)
   * @param {Object} poi - POI object
   * @param {Object} map - Google Maps instance
   * @returns {HTMLElement} The marker element
   */
  createMarker(poi, map) {
    const el = document.createElement('div');
    el.className = 'poi-native-marker';
    
    const color = poi.color || '#ff0000';
    const secondaryColor = poi.secondaryColor || '#ffffff';
    const svg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);
    
    el.style.cssText = `
      position: absolute; width: 32px; height: 32px;
      background-image: url('${poi.logoData || svg}');
      background-size: contain; background-repeat: no-repeat;
      pointer-events: auto; cursor: pointer; z-index: 102;
      filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
    `;
    
    el.setAttribute('data-id', MapUtils.getPoiId(poi));
    el.setAttribute('data-lat', poi.latitude);
    el.setAttribute('data-lng', poi.longitude);

    return el;
  }

  /**
   * @override
   * Clears all markers
   */
  clear() {
    // Return all active elements to pool
    this.activeElements.forEach((el, id) => {
      this.markerPool.release(el);
    });
    this.activeElements.clear();

    // Clear batch overlay if exists
    if (this.batchOverlay) {
      this.batchOverlay.updatePois([]);
    }

    super.clear();
  }

  /**
   * @override
   * Cleanup resources
   */
  cleanup() {
    this.clear();
    this.markerPool.clear();
    
    if (this.batchOverlay) {
      this.batchOverlay.setMap(null);
      this.batchOverlay = null;
    }

    this._stopNativeMarkerObserver();

    super.cleanup();
  }
}

// Export for different module systems
if (typeof window !== 'undefined') {
  window.GoogleMapsOverlayBase = GoogleMapsOverlayBase;
}
