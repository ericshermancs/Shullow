/**
 * POI Bridge: Portal Module
 * Handles cross-world communication and attribute mirroring.
 * 
 * Converted to OOP class extending ManagerBase for singleton pattern
 * and initialization lifecycle management.
 */

/**
 * PortalManager - Cross-world communication manager
 * 
 * Features:
 * - Bounds update with priority system
 * - DOM attribute mirroring for isolated world access
 * - postMessage for content script communication
 */
class PortalManager extends ManagerBase {
  constructor() {
    super();
    this.lastBounds = null;
    this.lastUpdateTime = 0;
    this.lastPriority = 0;
    this.messageHandlers = new Map();
    
    // Priority levels for different data sources
    this.PRIORITIES = {
      'instance-event': 100,      // Highest: Direct user interaction
      'redfin-redux-sub': 90,     // High: Real-time subscription
      'redfin-api': 85,           // High: API response is very fresh
      'instance-capture': 80,     // Medium: Extracted from active map instance
      'redfin-redux': 50,         // Low: Polled state (might be slightly stale)
      'redfin-global': 40,        // Lower: Polled global variable (often stale)
      'network-url': 20,          // Lowest: One-off network sniff
      'network-body': 20
    };
  }

  /**
   * @override
   * Called during initialization
   */
  async onInitialize() {
    this.setupMessageListeners();
    this.log('PortalManager initialized');
  }

  /**
   * @override
   * Cleanup resources
   */
  cleanup() {
    this.messageHandlers.clear();
    this.initialized = false;
    this.log('PortalManager cleaned up');
  }

  /**
   * Sets up message listeners
   * @private
   */
  setupMessageListeners() {
    // Can be extended by subclasses or at runtime
  }

  /**
   * Registers a message handler
   * @param {string} type - Message type
   * @param {Function} handler - Handler function
   */
  registerHandler(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Extracts bounds from a map instance
   * @param {Object} map - Map instance
   * @returns {Object|null} Bounds object
   */
  extractBounds(map) {
    try {
      const b = map.getBounds();
      if (!b) return null;
      
      // Google Maps format
      if (b.getNorthEast) {
        return {
          north: b.getNorthEast().lat(),
          south: b.getSouthWest().lat(),
          east: b.getNorthEast().lng(),
          west: b.getSouthWest().lng()
        };
      }
      
      // Mapbox format
      if (b.getNorth) {
        return {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest()
        };
      }
    } catch(e) {}
    return null;
  }

  /**
   * Filters POIs by priority within given bounds
   * @param {Array} pois - Array of POIs
   * @param {Object} bounds - Bounds to filter by
   * @returns {Array} Filtered POIs
   */
  filterByPriority(pois, bounds) {
    if (!bounds || !pois) return pois;
    
    return pois.filter(poi => {
      const lat = parseFloat(poi.latitude);
      const lng = parseFloat(poi.longitude);
      return (
        lat >= bounds.south &&
        lat <= bounds.north &&
        lng >= bounds.west &&
        lng <= bounds.east
      );
    });
  }

  /**
   * Sends a message to the content script
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  notifyContentScript(type, data) {
    window.postMessage({ type, ...data }, '*');
  }

  /**
   * Updates bounds with priority checking
   * @param {Object} bounds - Bounds object
   * @param {string} method - Source method name
   */
  update(bounds, method) {
    if (!bounds || typeof bounds.north !== 'number' || isNaN(bounds.north)) return;
    
    // Priority Check
    const priority = this.PRIORITIES[method] || 30;
    const now = Date.now();
    
    // STRICTER LOCK: If we have locked onto a high-quality source (>= 80),
    // ignore any low-quality polling (< 80) PERMANENTLY unless the high-quality source goes silent for > 5 seconds.
    if (this.lastPriority >= 80 && priority < 80) {
       if (now - this.lastUpdateTime < 5000) return;
       // Reset lock if silence for 5s
       this.lastPriority = 0; 
    }

    // Always allow high-priority updates (e.g. from user interaction or API)
    // Only filter low-priority polling if a high-priority event happened very recently
    if (priority <= 50 && this.lastPriority > 50 && (now - this.lastUpdateTime < 500)) {
       return;
    }

    // Round for stability and JSON comparison
    const rounded = {
      north: parseFloat(bounds.north.toFixed(6)),
      south: parseFloat(bounds.south.toFixed(6)),
      east: parseFloat(bounds.east.toFixed(6)),
      west: parseFloat(bounds.west.toFixed(6))
    };

    const json = JSON.stringify(rounded);
    
    // Update state even if bounds are same, to refresh priority timestamp if it's high priority
    if (priority >= this.lastPriority) {
        this.lastPriority = priority;
        this.lastUpdateTime = now;
    }

    if (json === this.lastBounds) return;
    this.lastBounds = json;

    const timestamp = now.toString();

    // Mirror to DOM for Isolated World access
    document.documentElement.setAttribute('data-poi-bounds', json);
    document.documentElement.setAttribute('data-poi-map-type', method);
    document.documentElement.setAttribute('data-poi-timestamp', timestamp);
    
    const payload = { 
      type: 'POI_BOUNDS_UPDATE', 
      bounds: rounded, 
      method: method, 
      url: window.location.href, 
      isIframe: window.self !== window.top,
      timestamp: timestamp
    };
    
    window.postMessage(payload, '*');
    if (window.self !== window.top) window.parent.postMessage(payload, '*');
  }
}

// Create singleton instance and expose on window for backwards compatibility
const portalManager = new PortalManager();
window.poiPortal = portalManager;

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PortalManager;
}
