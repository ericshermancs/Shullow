/**
 * ZillowOverlay - Site-specific overlay for Zillow.com
 * 
 * Zillow uses Mapbox GL JS for their maps.
 * Rendering is handled entirely by bridge/modules/renderer.js (poi-native-marker).
 * This class provides domain detection for the OverlayRegistry.
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
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ZillowOverlay;
}
if (typeof window !== 'undefined') {
  window.ZillowOverlay = ZillowOverlay;
}
