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
    try {
      super(debug);
      console.log('[GenericMapOverlay] Constructor called');
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
      
      // Native marker detection infrastructure
      this._nativeMarkersInjected = false;
      this._nativeMarkerObserver = null;
      this._nativeMarkerPollInterval = null;
      
      // Heuristic detection for non-enumerated sites
      this._siteNativeMarkerPatterns = [];
      this._detectedSiteMarkerCount = 0;
      this._markerDetectionAttempts = 0;
      
      // IMMEDIATE CHECK: Do site native markers already exist?
      // This handles cases where the site renders markers before our overlay loads
      console.log('[GenericMapOverlay] Running immediate native marker check...');
      this._checkForExistingNativeMarkers();
      
      // Start native marker detection
      console.log('[GenericMapOverlay] Starting observer...');
      this._startNativeMarkerObserver();
      console.log('[GenericMapOverlay] Starting polling...');
      this._startNativeMarkerPolling();
      console.log('[GenericMapOverlay] Starting heuristic learning...');
      this._startHeuristicMarkerLearning();
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
   * Immediately check if site native markers already exist
   * This prevents the overlay from rendering if native markers are present
   * @private
   */
  _checkForExistingNativeMarkers() {
    try {
      // Common patterns for site native markers (not extension-injected)
      const commonPatterns = [
        // Google Maps web components
        'gmp-advanced-marker',
        '[class*="advanced-marker"]',
        '[data-marker-id]',
        
        // Mapbox markers
        '.mapboxgl-popup',
        '[class*="mapbox"][class*="marker"]',
        
        // Generic marker patterns
        '[aria-label*="marker"]',
        '[class*="marker"][class*="pin"]',
        '[class*="map-marker"]',
      ];

      for (const selector of commonPatterns) {
        try {
          const markers = this._querySelectorAllMaybeShadow(selector);
          if (markers.length > 0) {
            console.log(`[GenericMapOverlay] Found ${markers.length} existing native markers using selector: ${selector}`);
            this.log(`Found ${markers.length} existing native markers (${selector}), skipping overlay`);
            this._nativeMarkersInjected = true;
            return; // Don't render overlay, native markers already here
          }
        } catch (e) {
          // Invalid selector, continue
        }
      }
      
      console.log('[GenericMapOverlay] No existing native markers found');
    } catch (err) {
      console.error('[GenericMapOverlay] Error in immediate native marker check:', err);
    }
  }

  /**
   * Analyzes the page to learn site-specific marker patterns
   * This helps detect native markers on non-enumerated sites
   * @private
   */
  _startHeuristicMarkerLearning() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      console.log('[GenericMapOverlay] Cannot start heuristic learning: window or document undefined');
      return;
    }
    
    console.log('[GenericMapOverlay] Heuristic learning scheduled for 2s from now');
    
    // Run analysis after a brief delay to let page stabilize
    setTimeout(() => {
      try {
        console.log('[GenericMapOverlay] Running heuristic marker analysis now');
        this._analyzePageForMarkerPatterns();
      } catch (e) {
        console.error('[GenericMapOverlay] Error in heuristic marker learning:', e);
        this.log('Error in heuristic marker learning:', e);
      }
    }, 2000);
  }

  /**
   * Analyzes the page for common marker patterns
   * Tests various selectors and learns which ones find markers
   * @private
   */
  _analyzePageForMarkerPatterns() {
    const commonPatterns = [
      // Mapbox patterns
      { selector: '.mapboxgl-popup', name: 'mapbox-popup', type: 'mapbox' },
      { selector: '[class*="mapbox"][class*="marker"]', name: 'mapbox-marker-class', type: 'mapbox' },
      
      // Google Maps patterns
      { selector: '[aria-label*="marker"]', name: 'google-aria-marker', type: 'google' },
      { selector: '[data-marker-id]', name: 'data-marker-id', type: 'any' },
      { selector: '[data-place-id]', name: 'data-place-id', type: 'any' },
      
      // Leaflet
      { selector: '.leaflet-marker-icon', name: 'leaflet-marker', type: 'leaflet' },
      
      // Generic patterns (use with caution - low confidence)
      { selector: '[class*="pin"][class*="marker"]', name: 'pin-marker-combo', type: 'any' },
      { selector: '[aria-label*="location"]', name: 'aria-location', type: 'any' },
      
      // Custom marker patterns (high variance per site)
      { selector: '[class*="marker"]', name: 'any-marker-class', type: 'any' },
      { selector: '[class*="pin"]', name: 'any-pin-class', type: 'any' },
      { selector: '[class*="home"]', name: 'any-home-class', type: 'any' },
      { selector: '[role="button"][aria-label]', name: 'aria-button-label', type: 'any' }
    ];

    const foundPatterns = [];
    
    for (const pattern of commonPatterns) {
      try {
        const elements = this._querySelectorAllMaybeShadow(pattern.selector);
        if (elements.length > 0) {
          foundPatterns.push({
            selector: pattern.selector,
            name: pattern.name,
            type: pattern.type,
            count: elements.length
          });
          console.log(`[GenericMapOverlay] Found ${elements.length} elements matching "${pattern.name}" (${pattern.selector})`);
          this.log(`Found ${elements.length} elements matching "${pattern.name}" (${pattern.selector})`);
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    // Store patterns for later polling
    if (foundPatterns.length > 0) {
      this._siteNativeMarkerPatterns = foundPatterns;
      console.log(`[GenericMapOverlay] Learned site marker patterns: ${foundPatterns.length} patterns`);
      this.log('Learned site marker patterns:', foundPatterns.length, 'patterns');
    }
  }

  /**
   * Gets the CSS selector for native markers
   * @returns {string} CSS selector for extension-injected native markers
   * @protected
   */
  _getNativeMarkerSelector() {
    return '.poi-native-marker, .poi-native-marker-mapbox, .poi-native-marker-generic';
  }

  /**
   * Determines whether a selector is likely to appear in Shadow DOM
   * @param {string} selector
   * @returns {boolean}
   * @private
   */
  _shouldSearchShadow(selector) {
    return selector.includes('gmp-') || selector.includes('advanced-marker');
  }

  /**
   * Finds elements matching a selector within Shadow DOM trees
   * @param {Document|ShadowRoot} root
   * @param {string} selector
   * @param {Array<HTMLElement>} found
   * @returns {Array<HTMLElement>}
   * @private
   */
  _findAllInShadow(root, selector, found = []) {
    if (!root || typeof root.querySelectorAll !== 'function') return found;

    try {
      found.push(...root.querySelectorAll(selector));
    } catch (e) {
      return found;
    }

    const all = root.querySelectorAll('*');
    for (const el of all) {
      if (el.shadowRoot) {
        this._findAllInShadow(el.shadowRoot, selector, found);
      }
    }

    return found;
  }

  /**
   * Query selector that optionally searches Shadow DOM when needed
   * @param {string} selector
   * @returns {Array<HTMLElement>}
   * @private
   */
  _querySelectorAllMaybeShadow(selector) {
    if (typeof document === 'undefined') return [];
    let direct = [];
    try {
      direct = Array.from(document.querySelectorAll(selector));
    } catch (e) {
      return [];
    }

    if (direct.length > 0 || !this._shouldSearchShadow(selector)) return direct;

    return this._findAllInShadow(document, selector);
  }

  /**
   * Sets up a MutationObserver to watch for native marker insertion
   * @private
   */
  _startNativeMarkerObserver() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      console.log('[GenericMapOverlay] Cannot start observer: window or document undefined');
      return;
    }
    if (this._nativeMarkerObserver) {
      console.log('[GenericMapOverlay] Observer already running');
      return;
    }
    
    console.log('[GenericMapOverlay] Setting up MutationObserver');
    
    const callback = (mutationsList) => {
      if (this._nativeMarkersInjected) return;
      
      const selector = this._getNativeMarkerSelector();
      if (selector && document.querySelector(selector)) {
        this._nativeMarkersInjected = true;
        console.log('[GenericMapOverlay] Native marker detected by MutationObserver');
        this.log('Native marker detected by MutationObserver, clearing overlay markers');
        this.clear();
      }
    };
    
    this._nativeMarkerObserver = new MutationObserver(callback);
    this._nativeMarkerObserver.observe(document.body, { childList: true, subtree: true });
    console.log('[GenericMapOverlay] MutationObserver set up successfully');
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
    
    console.log('[GenericMapOverlay] Starting native marker polling (500ms)...');
    this.log('Starting native marker polling (500ms)...');
    let lastDetectedCount = 0;
    let lastSiteMarkerCount = 0;
    let pollCycle = 0;
    
    this._nativeMarkerPollInterval = setInterval(() => {
      try {
        pollCycle++;
        if (this._nativeMarkersInjected) {
          this._stopNativeMarkerPolling();
          return;
        }
        
        // Check for extension-injected markers
        const selector = this._getNativeMarkerSelector();
        if (selector) {
          const nativeMarkers = document.querySelectorAll(selector);
          const count = nativeMarkers.length;
          
          if (count > 0 && lastDetectedCount === 0) {
            this._nativeMarkersInjected = true;
            console.log(`[GenericMapOverlay] Extension native markers detected by polling (${count} found)`);
            this.log(`Extension native markers detected by polling (${count} found), immediately clearing overlay`);
            this.clear();
            this._stopNativeMarkerPolling();
            return;
          }
          lastDetectedCount = count;
        }
        
        // Every 3 cycles (600ms), re-learn patterns to detect new markers
        // This helps catch markers that appear after initial page load
        if (pollCycle % 3 === 0) {
          console.log(`[GenericMapOverlay] Re-learning patterns (cycle ${pollCycle})`);
          this._analyzePageForMarkerPatterns();
        }
        
        // Check for site native markers using HARD-CODED common patterns
        // (not just learned patterns - catch apartments.com's gmp-advanced-marker immediately)
        const commonNativeMarkerPatterns = [
          'gmp-advanced-marker',           // Google Maps web component
          '[class*="advanced-marker"]',    // Google Maps CSS variant
          '.mapboxgl-popup',               // Mapbox popup
          '[data-marker-id]',              // Generic marker pattern
          '[class*="map-marker"]',         // Generic marker class
        ];
        
        let totalSiteMarkers = 0;
        for (const selector of commonNativeMarkerPatterns) {
          try {
            const found = this._querySelectorAllMaybeShadow(selector);
            totalSiteMarkers += found.length;
          } catch (e) {
            // Invalid selector
          }
        }
        
        // If hard-coded patterns found markers
        if (totalSiteMarkers > 0 && lastSiteMarkerCount === 0) {
          this._nativeMarkersInjected = true;
          console.log(`[GenericMapOverlay] Site native markers detected via polling (${totalSiteMarkers} found using common patterns)`);
          this.log(`Site native markers detected via polling (${totalSiteMarkers} found using common patterns), switching to native mode`);
          if (typeof window !== 'undefined' && window.poiState) {
            window.poiState.nativeMode = true;
          }
          this.clear();
          this._stopNativeMarkerPolling();
          return;
        }
        lastSiteMarkerCount = totalSiteMarkers;
        
        // Also check for site native markers using learned patterns (for site-specific detection)
        if (this._siteNativeMarkerPatterns.length > 0) {
          let learnedPatternMarkers = 0;
          for (const pattern of this._siteNativeMarkerPatterns) {
            try {
              const found = this._querySelectorAllMaybeShadow(pattern.selector);
              learnedPatternMarkers += found.length;
            } catch (e) {
              // Invalid selector
            }
          }
          
          // If learned patterns found markers (and common patterns didn't)
          if (learnedPatternMarkers > 0 && totalSiteMarkers === 0) {
            this._nativeMarkersInjected = true;
            console.log(`[GenericMapOverlay] Site native markers detected via learned patterns (${learnedPatternMarkers} found using ${this._siteNativeMarkerPatterns.length} learned patterns)`);
            this.log(`Site native markers detected via learned patterns (${learnedPatternMarkers} found), switching to native mode`);
            if (typeof window !== 'undefined' && window.poiState) {
              window.poiState.nativeMode = true;
            }
            this.clear();
            this._stopNativeMarkerPolling();
            return;
          }
        } else if (pollCycle % 6 === 0) {
          console.log(`[GenericMapOverlay] Polling cycle ${pollCycle}: No patterns learned yet or no markers found`);
        }
      } catch (e) {
        console.error('[GenericMapOverlay] Error during native marker polling:', e);
        this.log('Error during native marker polling:', e);
      }
    }, 500); // Poll every 500ms (less frequent, reduces CPU usage)
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
    console.log('[GenericMapOverlay] renderMarkers() called with', pois?.length || 0, 'POIs');
    
    // CRITICAL: Check native marker flag FIRST before any other logic
    if (this._nativeMarkersInjected) {
      console.log('[GenericMapOverlay] Native markers already injected, skipping render');
      this.log('Native markers already injected (flag set), skipping overlay render');
      return;
    }
    
    // ALSO check for site's native markers (e.g., gmp-advanced-marker on apartments.com)
    const commonNativeSelectors = [
      'gmp-advanced-marker',
      '[class*="advanced-marker"]',
      '.mapboxgl-popup',
      '[data-marker-id]',
      '[class*="map-marker"]'
    ];
    
    for (const selector of commonNativeSelectors) {
      try {
        const siteNativeMarkers = this._querySelectorAllMaybeShadow(selector);
        if (siteNativeMarkers.length > 0) {
          this._nativeMarkersInjected = true;
          console.log(`[GenericMapOverlay] Site native markers detected (${selector}), skipping render`);
          this.log(`Site native markers detected (${selector}), skipping overlay render`);
          this.clear();
          return;
        }
      } catch (e) {
        // Invalid selector, continue
      }
    }
    
    // Check for extension-injected markers
    const selector = this._getNativeMarkerSelector();
    if (selector) {
      const nativeMarkers = document.querySelectorAll(selector);
      if (nativeMarkers.length > 0) {
        this._nativeMarkersInjected = true;
        console.log('[GenericMapOverlay] Extension native markers detected at render time, clearing overlay');
        this.log('Extension native markers detected at render time, clearing overlay');
        this.clear();
        return;
      }
    }

    // Check if native mode is active via global state
    if (typeof window !== 'undefined' && window.poiState && window.poiState.nativeMode) {
      console.log('[GenericMapOverlay] Native mode active, clearing overlay markers');
      this.log('Native mode active, clearing overlay markers');
      this.clear();
      return;
    }

    console.log('[GenericMapOverlay] Proceeding with overlay render');
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
    this._stopNativeMarkerPolling();
    this._stopNativeMarkerObserver();
    this.clear();
    this.markerPool.clear();
    this.detectedMapType = null;
    this._siteNativeMarkerPatterns = [];
    super.cleanup();
  }

  /**
   * @override
   * Detects if site has native markers using learned patterns
   * @param {Object} poi - POI object
   * @returns {boolean} True if site native marker exists
   * @protected
   */
  _hasSiteNativeMarker(poi) {
    // If we've learned marker patterns, check them
    if (this._siteNativeMarkerPatterns.length > 0) {
      for (const pattern of this._siteNativeMarkerPatterns) {
        try {
          const markers = document.querySelectorAll(pattern.selector);
          if (markers.length > 0) {
            // Log once per detection to avoid spam
            if (!this._hasLoggedSiteMarker) {
              this.log(`Site native markers detected using learned pattern: ${pattern.name}`);
              this._hasLoggedSiteMarker = true;
            }
            return true;
          }
        } catch (e) {
          // Invalid selector
        }
      }
    }
    return false;
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenericMapOverlay;
} else if (typeof window !== 'undefined') {
  window.GenericMapOverlay = GenericMapOverlay;
}
