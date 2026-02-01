/**
 * OneKeyOverlay - Site-specific overlay for OneKeyMLS.com
 * 
 * OneKey MLS uses Mapbox GL JS for their maps.
 * This overlay extends MapboxOverlayBase with OneKey-specific
 * z-index handling to ensure markers stack below property popups.
 */

/**
 * OneKeyOverlay - Mapbox-based overlay for OneKeyMLS.com
 * 
 * Features:
 * - Detects OneKey's Mapbox map container
 * - Applies z-index to stack markers below property popups
 * - Handles OneKey's popup parent for correct stacking context
 */
class OneKeyOverlay extends MapboxOverlayBase {
  constructor(debug = false) {
    super(debug);
    this.siteId = 'onekey';
  }

  /**
   * @override
   * Detects the OneKey map container
   * @returns {HTMLElement|null} The map container element
   */
  detect() {
    const selectors = [
      '.mapboxgl-map',
      '#map',
      '.map-container',
      '[class*="MapContainer"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        this.log('Detected OneKey map container:', selector);
        this.container = el;
        
        // Also find popup parent for stacking context
        this._findPopupParent();
        
        return el;
      }
    }

    return null;
  }

  /**
   * Finds the popup parent element for stacking context
   * @private
   */
  _findPopupParent() {
    // OneKey often has popups in a specific container
    const popupParent = document.querySelector('.mapboxgl-popup-content, [class*="PropertyCard"], [class*="popup"]');
    if (popupParent) {
      this.log('Found popup parent for stacking context');
    }
  }

  /**
   * @override
   * Gets the z-index for markers (10 to stack below popups)
   * @returns {number} The z-index value
   */
  getMarkerZIndex() {
    return 10;
  }

  /**
   * @override
   * Creates a marker element with OneKey-specific styling
   * @param {Object} poi - POI object
   * @returns {HTMLElement} The marker element
   */
  createMarkerElement(poi) {
    const el = super.createMarkerElement(poi);
    
    // OneKey-specific: explicit inline styles for stacking
    el.style.position = 'relative';
    el.style.zIndex = '10';
    
    return el;
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OneKeyOverlay;
} else if (typeof window !== 'undefined') {
  window.OneKeyOverlay = OneKeyOverlay;
}
