/**
 * OverlayRegistry.js - Registry for map instances and their site configurations
 * 
 * CRITICAL: This registry implements Phase 6.5 - Multi-Map Isolation
 * 
 * Problem Being Solved:
 * When loading sites like realtor.com, scripts would read DOM elements and see
 * domains from iframes/ads (not realtor.com), which would overwrite the global
 * domain variable, causing the incorrect configuration to be used.
 * 
 * Solution:
 * - Each map instance gets a unique ID at discovery time
 * - Domain detection happens at discovery time for THAT specific map
 * - The site config is locked to that map and cannot be changed
 * - Network requests cannot change the site config assignment
 * - Each map maintains its own isolated configuration
 */

/**
 * MapEntry - Represents a registered map instance
 */
class MapEntry {
  /**
   * @param {string} id - Unique map identifier
   * @param {Object} mapInstance - The map instance
   * @param {string} domain - Domain detected at discovery time
   * @param {Object} siteConfig - The site configuration object
   */
  constructor(id, mapInstance, domain, siteConfig) {
    this.id = id;
    this.mapInstance = mapInstance;
    this.domain = domain;
    this.siteConfig = siteConfig;
    this.createdAt = Date.now();
    this.lastUpdate = Date.now();
    this.bounds = null;
    this.isActive = true;
    
    // Lock the domain - it cannot be changed after creation
    Object.defineProperty(this, 'domain', {
      value: domain,
      writable: false,
      configurable: false
    });
  }

  /**
   * Updates the last activity timestamp
   */
  touch() {
    this.lastUpdate = Date.now();
  }

  /**
   * Deactivates this entry
   */
  deactivate() {
    this.isActive = false;
  }
}

/**
 * OverlayRegistry - Singleton registry for map-siteConfig associations
 * 
 * Key guarantees:
 * 1. Domain is detected once at registration time
 * 2. Domain cannot be changed after registration
 * 3. Each map has exactly one site configuration
 * 4. Network activity cannot affect domain/config assignments
 */
class OverlayRegistry {
  constructor() {
    /**
     * Map from map ID to MapEntry
     * @type {Map<string, MapEntry>}
     */
    this.entries = new Map();
    
    /**
     * WeakMap from map instance to map ID (for reverse lookup)
     * @type {WeakMap<Object, string>}
     */
    this.instanceToId = new WeakMap();
    
    /**
     * Counter for generating unique IDs
     */
    this.idCounter = 0;
    
    /**
     * Debug mode
     */
    this.debug = false;
  }

  /**
   * Sets the overlay factory
   * @param {OverlayFactory} factory - The factory instance
   */
  /**
   * @deprecated No longer needed - using siteConfig directly
   */
  setFactory(factory) {
    // No-op for backwards compatibility
  }

  /**
   * Enable/disable debug logging
   * @param {boolean} enabled - Debug flag
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * Log helper
   * @param {...any} args - Arguments to log
   */
  log(...args) {
    if (this.debug) {
      console.log('[OverlayRegistry]', ...args);
    }
  }

  /**
   * Generates a unique map ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `map_${++this.idCounter}_${Date.now()}`;
  }

  /**
   * Extracts the domain from a map instance's container context
   * This is called ONCE at registration time and cannot be changed.
   * 
   * @param {Object} mapInstance - The map instance
   * @param {HTMLElement} [container] - Optional container element
   * @returns {string} The detected domain (empty string if unknown)
   * @private
   */
  _extractDomainFromMap(mapInstance, container = null) {
    let domain = '';
    
    // Priority 1: Explicit container
    if (container && container.ownerDocument) {
      try {
        const doc = container.ownerDocument;
        // Only trust if same-origin
        if (doc.location) {
          domain = doc.location.hostname;
        }
      } catch (e) {
        // Cross-origin, ignore
      }
    }
    
    // Priority 2: Map's getDiv (Google Maps)
    if (!domain && mapInstance && typeof mapInstance.getDiv === 'function') {
      try {
        const div = mapInstance.getDiv();
        if (div && div.ownerDocument && div.ownerDocument.location) {
          domain = div.ownerDocument.location.hostname;
        }
      } catch (e) {}
    }
    
    // Priority 3: Map's _container (Mapbox)
    if (!domain && mapInstance && mapInstance._container) {
      try {
        const c = mapInstance._container;
        if (c.ownerDocument && c.ownerDocument.location) {
          domain = c.ownerDocument.location.hostname;
        }
      } catch (e) {}
    }
    
    // Priority 4: Map's container property (generic)
    if (!domain && mapInstance && mapInstance.container) {
      try {
        const c = mapInstance.container;
        const el = (typeof c === 'string') ? document.getElementById(c) : c;
        if (el && el.ownerDocument && el.ownerDocument.location) {
          domain = el.ownerDocument.location.hostname;
        }
      } catch (e) {}
    }
    
    // Priority 5: Top-level window (ONLY if in main frame)
    if (!domain) {
      try {
        if (window === window.top) {
          domain = window.location.hostname;
        }
      } catch (e) {
        // Cross-origin iframe
      }
    }
    
    this.log(`Extracted domain for map: ${domain || '(unknown)'}`);
    return domain || '';
  }

  /**
   * Registers a map instance with the registry
   * Domain detection happens HERE and is locked.
   * 
   * @param {Object} mapInstance - The map instance
   * @param {HTMLElement} [container] - Optional container element
   * @returns {MapEntry} The registry entry
   */
  register(mapInstance, container = null) {
    // Log registration attempt
    console.log('[OverlayRegistry] register() called for mapInstance:', mapInstance, 'container:', container);

    // Check if already registered
    if (this.instanceToId.has(mapInstance)) {
      const existingId = this.instanceToId.get(mapInstance);
      const entry = this.entries.get(existingId);
      if (entry) {
        entry.touch();
        this.log(`Map already registered: ${existingId}`);
        return entry;
      }
    }

    // Generate unique ID
    const id = this.generateId();

    // Extract domain AT THIS MOMENT - this is locked and cannot change
    const domain = this._extractDomainFromMap(mapInstance, container);
    console.log('[OverlayRegistry] Extracted domain:', domain);

    // Get site configuration from siteConfig
    let siteConfig = null;
    if (window.siteConfig && typeof window.siteConfig.getConfig === 'function') {
      siteConfig = window.siteConfig.getConfig(domain);
      console.log('[OverlayRegistry] Loaded siteConfig for domain:', domain, siteConfig);
    } else {
      console.warn('[OverlayRegistry] window.siteConfig not available, using fallback');
      siteConfig = {
        displayName: domain || 'Unknown',
        mapType: 'auto',
        selectors: [],
        styles: {},
        features: {}
      };
    }

    // Create entry
    const entry = new MapEntry(id, mapInstance, domain, siteConfig);
    console.log('[OverlayRegistry] MapEntry created:', entry);

    // Store in registries
    this.entries.set(id, entry);
    this.instanceToId.set(mapInstance, id);

    // Tag the map instance with its ID
    if (mapInstance) {
      try {
        mapInstance._poiRegistryId = id;
      } catch (e) {}
    }

    this.log(`Registered map: ${id} for domain: ${domain}`);
    
    return entry;
  }

  /**
   * Gets a map entry by map instance
   * @param {Object} mapInstance - The map instance
   * @returns {MapEntry|null} The entry or null
   */
  getByInstance(mapInstance) {
    const id = this.instanceToId.get(mapInstance);
    return id ? this.entries.get(id) : null;
  }

  /**
   * Gets a map entry by ID
   * @param {string} id - The map ID
   * @returns {MapEntry|null} The entry or null
   */
  getById(id) {
    return this.entries.get(id) || null;
  }

  /**
   * Gets the overlay for a map instance
   * @param {Object} mapInstance - The map instance
   * @returns {MapOverlayBase|null} The overlay or null
   */
  getOverlay(mapInstance) {
    const entry = this.getByInstance(mapInstance);
    return entry ? entry.overlay : null;
  }

  /**
   * Gets all active entries
   * @returns {MapEntry[]} Array of active entries
   */
  getActiveEntries() {
    return Array.from(this.entries.values()).filter(e => e.isActive);
  }

  /**
   * Gets all entries for a specific domain
   * @param {string} domain - The domain to filter by
   * @returns {MapEntry[]} Array of entries
   */
  getByDomain(domain) {
    const normalized = domain.toLowerCase().replace(/^www\./, '');
    return Array.from(this.entries.values()).filter(e => {
      const entryDomain = e.domain.toLowerCase().replace(/^www\./, '');
      return entryDomain === normalized || entryDomain.endsWith(`.${normalized}`);
    });
  }

  /**
   * Unregisters a map instance
   * @param {Object} mapInstance - The map instance
   * @returns {boolean} True if successfully unregistered
   */
  unregister(mapInstance) {
    const id = this.instanceToId.get(mapInstance);
    if (!id) return false;
    
    const entry = this.entries.get(id);
    if (entry) {
      entry.deactivate();
      this.entries.delete(id);
    }
    
    this.instanceToId.delete(mapInstance);
    this.log(`Unregistered map: ${id}`);
    return true;
  }

  /**
   * Updates bounds for a map entry
   * NOTE: This does NOT change the domain or overlay!
   * 
   * @param {Object} mapInstance - The map instance
   * @param {Object} bounds - The bounds object
   */
  updateBounds(mapInstance, bounds) {
    const entry = this.getByInstance(mapInstance);
    if (entry) {
      entry.bounds = bounds;
      entry.touch();
      // Do NOT change entry.domain or entry.overlay - they are locked
    }
  }

  /**
   * Cleans up stale entries (maps that have been removed)
   * @param {number} [maxAge=300000] - Maximum age in milliseconds (default 5 minutes)
   */
  cleanup(maxAge = 300000) {
    const now = Date.now();
    const toRemove = [];
    
    this.entries.forEach((entry, id) => {
      // Check if map instance is still valid
      let isValid = false;
      try {
        const map = entry.mapInstance;
        if (map) {
          // Google Maps
          if (typeof map.getDiv === 'function') {
            const div = map.getDiv();
            isValid = div && document.contains(div);
          }
          // Mapbox
          else if (map._container) {
            isValid = document.contains(map._container);
          }
          // Generic
          else if (map.container) {
            const c = typeof map.container === 'string' 
              ? document.getElementById(map.container) 
              : map.container;
            isValid = c && document.contains(c);
          }
        }
      } catch (e) {}
      
      // Remove if invalid or too old
      if (!isValid || (now - entry.lastUpdate > maxAge)) {
        toRemove.push(id);
      }
    });
    
    for (const id of toRemove) {
      const entry = this.entries.get(id);
      if (entry) {
        entry.deactivate();
        this.entries.delete(id);
        // Note: Can't remove from WeakMap, but that's fine - it'll be garbage collected
      }
      this.log(`Cleaned up stale entry: ${id}`);
    }
  }

  /**
   * Gets registry statistics
   * @returns {Object} Stats object
   */
  getStats() {
    const entries = Array.from(this.entries.values());
    return {
      total: entries.length,
      active: entries.filter(e => e.isActive).length,
      domains: [...new Set(entries.map(e => e.domain))],
      oldestEntry: entries.length > 0 
        ? Math.min(...entries.map(e => e.createdAt))
        : null
    };
  }

  /**
   * Clears all entries
   */
  clear() {
    this.entries.forEach(entry => entry.deactivate());
    this.entries.clear();
    // WeakMap entries will be garbage collected
    this.idCounter = 0;
    this.log('Registry cleared');
  }

  /**
   * Get debug info about all registered overlays
   * Useful for debugging map detection issues
   */
  getDebugInfo() {
    const info = [];
    this.entries.forEach((entry, id) => {
      info.push({
        id: entry.id,
        domain: entry.domain,
        overlayClass: entry.overlay ? entry.overlay.constructor.name : 'none',
        overlayId: entry.overlay ? entry.overlay.siteId : 'none',
        isActive: entry.isActive,
        createdAt: new Date(entry.createdAt).toISOString(),
        lastUpdate: new Date(entry.lastUpdate).toISOString()
      });
    });
    return info;
  }

  /**
   * Log all overlays info to console
   */
  logDebugInfo() {
    const info = this.getDebugInfo();
    console.log('[OverlayRegistry] Current overlays:', info);
    return info;
  }
}

// Singleton instance
const overlayRegistry = new OverlayRegistry();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OverlayRegistry, MapEntry, overlayRegistry };
}
// Always attach to window if available (for debugging)
if (typeof window !== 'undefined') {
  window.OverlayRegistry = OverlayRegistry;
  window.MapEntry = MapEntry;
  window.overlayRegistry = overlayRegistry;
  if (window.overlayRegistry) {
    console.log('[OverlayRegistry] overlayRegistry attached to window:', window.overlayRegistry);
  }
}
