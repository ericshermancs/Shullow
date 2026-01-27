/**
 * POI Bridge: Portal Module
 * Handles cross-world communication and attribute mirroring.
 */
window.poiPortal = {
  lastBounds: null,
  lastUpdateTime: 0,
  lastPriority: 0,

  PRIORITIES: {
    'instance-event': 100,      // Highest: Direct user interaction
    'redfin-redux-sub': 90,     // High: Real-time subscription
    'redfin-api': 85,           // High: API response is very fresh
    'instance-capture': 80,     // Medium: Extracted from active map instance
    'redfin-redux': 50,         // Low: Polled state (might be slightly stale)
    'redfin-global': 40,        // Lower: Polled global variable (often stale)
    'network-url': 20,          // Lowest: One-off network sniff
    'network-body': 20
  },

  update(bounds, method) {
    if (!bounds || typeof bounds.north !== 'number' || isNaN(bounds.north)) return;
    
    // Priority Check
    const priority = this.PRIORITIES[method] || 30;
    const now = Date.now();
    
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
    // ... rest of function

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
};
