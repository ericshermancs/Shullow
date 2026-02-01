/**
 * ZillowOverlay - Site-specific overlay for Zillow.com
 * 
 * Zillow uses Mapbox GL JS for their maps.
 * This overlay extends MapboxOverlayBase with Zillow-specific
 * detection and z-index handling.
 */

/**
 * ZillowOverlay - Mapbox-based overlay for Zillow.com
 * 
 * Features:
 * - Detects Zillow's Mapbox map container
 * - Applies proper z-index for marker visibility
 * - Handles Zillow's specific DOM structure
 */
class ZillowOverlay extends MapboxOverlayBase {
  constructor(debug = false) {
    super(debug);
    this.siteId = 'zillow';
  }

  /**
   * @override
   * Detects the Zillow map container
   * @returns {HTMLElement|null} The map container element
   */
  detect() {
    // Zillow's map containers
    const selectors = [
      '.mapboxgl-map',
      '#search-page-map',
      '[data-testid="map"]',
      '.map-container',
      '#map'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        this.log('Detected Zillow map container:', selector);
        this.container = el;
        return el;
      }
    }

    return null;
  }

  /**
   * @override
   * Gets the z-index for markers (higher for Zillow to ensure visibility)
   * @returns {number} The z-index value
   */
  getMarkerZIndex() {
    return 10;
  }

  /**
   * @override
   * Creates a marker element with Zillow-specific styling
   * @param {Object} poi - POI object
   * @returns {HTMLElement} The marker element
   */
  createMarkerElement(poi) {
    const el = super.createMarkerElement(poi);
    
    // Zillow-specific: ensure markers are above Zillow's UI
    el.style.zIndex = '10';
    
    return el;
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZillowOverlay;
} else if (typeof window !== 'undefined') {
  window.ZillowOverlay = ZillowOverlay;
}
