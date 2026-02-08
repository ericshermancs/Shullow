/**
 * POI Bridge: Map Utilities Module
 * Provides shared utilities for map rendering across different platforms.
 */

/**
 * MapUtils - Static utility methods for map operations
 */
class MapUtils {
  /**
   * Generates a fallback SVG marker icon
   * @param {string} color - Primary fill color (default: #ff0000)
   * @param {string} secondaryColor - Stroke color (default: #ffffff)
   * @param {number} size - Size in pixels (default: 32)
   * @returns {string} Data URI for the SVG
   */
  static generateFallbackSVG(color = '#ff0000', secondaryColor = '#ffffff', size = 32) {
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="${secondaryColor}" stroke-width="1"/>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  /**
   * Creates marker element styles as a CSS string
   * @param {Object} options - Style options
   * @param {string} options.backgroundImage - URL or data URI for the marker image
   * @param {number} options.size - Size in pixels (default: 32)
   * @param {number} options.zIndex - z-index value (default: 102)
   * @returns {string} CSS style string
   */
  static getMarkerStyles(options = {}) {
    const { backgroundImage, size = 32, zIndex = 102 } = options;
    return `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      background-image: url('${backgroundImage}');
      background-size: contain;
      background-repeat: no-repeat;
      pointer-events: auto;
      cursor: pointer;
      z-index: ${zIndex};
      will-change: transform;
      top: 0;
      left: 0;
      filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
    `.trim().replace(/\s+/g, ' ');
  }

  /**
   * Extracts domain from a URL
   * @param {string} url - The URL to extract domain from
   * @returns {string} The domain (e.g., 'zillow.com')
   */
  static getDomain(url) {
    try {
      const parsed = new URL(url);
      // Remove 'www.' prefix if present
      return parsed.hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  /**
   * Generates a unique ID for a POI
   * @param {Object} poi - POI object
   * @returns {string} Unique identifier
   */
  static getPoiId(poi) {
    return poi.id || poi.name || `${poi.latitude}_${poi.longitude}`;
  }
}

/**
 * MarkerPool - Recycles DOM elements to reduce GC pressure
 */
class MarkerPool {
  constructor() {
    this.pool = [];
    this.maxPoolSize = 100; // Limit pool size to prevent memory bloat
  }

  /**
   * Acquires an element from the pool or creates a new one
   * @param {Function} createFn - Factory function to create new element if pool is empty
   * @returns {HTMLElement} DOM element
   */
  acquire(createFn) {
    if (this.pool.length > 0) {
      return this.pool.pop();
    }
    return createFn ? createFn() : document.createElement('div');
  }

  /**
   * Releases an element back to the pool for reuse
   * @param {HTMLElement} element - Element to return to pool
   */
  release(element) {
    if (!element) return;
    
    // Detach from DOM if attached
    if (element.parentNode) {
      element.remove();
    }
    
    // Only pool if under max size
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(element);
    }
  }

  /**
   * Clears all elements from the pool
   */
  clear() {
    this.pool = [];
  }

  /**
   * Gets the current pool size
   * @returns {number} Number of elements in pool
   */
  get size() {
    return this.pool.length;
  }
}

/**
 * MapTypeDetector - Identifies map library type from instance
 */
class MapTypeDetector {
  /**
   * Checks if the map instance is a Google Maps instance
   * @param {Object} map - Map instance to check
   * @returns {boolean} True if Google Maps
   */
  static isGoogleMap(map) {
    if (!map) return false;
    return (
      map.overlayMapTypes !== undefined ||
      typeof map.getDiv === 'function' ||
      (typeof map.setCenter === 'function' && typeof map.fitBounds === 'function' && !map.addSource)
    );
  }

  /**
   * Checks if the map instance is a Mapbox GL JS instance
   * @param {Object} map - Map instance to check
   * @returns {boolean} True if Mapbox GL JS
   */
  static isMapbox(map) {
    if (!map) return false;
    return (
      map.addSource !== undefined &&
      map.addLayer !== undefined &&
      typeof map.on === 'function'
    );
  }

  /**
   * Checks if the map instance is a Leaflet instance
   * @param {Object} map - Map instance to check
   * @returns {boolean} True if Leaflet
   */
  static isLeaflet(map) {
    if (!map) return false;
    return (
      map._leaflet_id !== undefined ||
      (typeof map.addLayer === 'function' && typeof map.removeLayer === 'function' && !map.addSource)
    );
  }

  /**
   * Detects and returns the map type as a string
   * @param {Object} map - Map instance to check
   * @returns {string} 'google' | 'mapbox' | 'leaflet' | 'unknown'
   */
  static detect(map) {
    if (this.isGoogleMap(map)) return 'google';
    if (this.isMapbox(map)) return 'mapbox';
    if (this.isLeaflet(map)) return 'leaflet';
    return 'unknown';
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MapUtils, MarkerPool, MapTypeDetector };
}
if (typeof window !== 'undefined') {
  window.MapUtils = MapUtils;
  window.MarkerPool = MarkerPool;
  window.MapTypeDetector = MapTypeDetector;
}
