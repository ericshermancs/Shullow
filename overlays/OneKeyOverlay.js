/**
 * OneKeyOverlay - Site-specific overlay for OneKeyMLS.com
 * 
 * OneKey MLS uses Mapbox GL JS for their maps.
 * Rendering is handled entirely by bridge/modules/renderer.js (poi-native-marker-mapbox).
 * This class provides domain detection for the OverlayRegistry.
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
        return el;
      }
    }

    return null;
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OneKeyOverlay;
}
if (typeof window !== 'undefined') {
  window.OneKeyOverlay = OneKeyOverlay;
}
