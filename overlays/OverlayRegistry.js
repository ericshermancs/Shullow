/**
 * OverlayRegistry.js - Registry for map instances and their associated overlays
 * 
 * CRITICAL: This registry implements Phase 6.5 - Multi-Map Isolation
 * 
 * Problem Being Solved:
 * When loading sites like realtor.com, scripts would read DOM elements and see
 * domains from iframes/ads (not realtor.com), which would overwrite the global
 * domain variable, causing the incorrect overlay class to be instantiated.
 * 
 * Solution:
 * - Each map instance gets a unique ID at discovery time
 * - Domain detection happens at discovery time for THAT specific map
 * - The overlay assignment is locked to that map and cannot be changed
 * - Network requests cannot change the overlay assignment
 * - Each map maintains its own isolated overlay instance
 */

/**
 * MapEntry - Represents a registered map instance
 */
class MapEntry {
  /**
   * @param {string} id - Unique map identifier
   * @param {Object} mapInstance - The map instance
   * @param {string} domain - Domain detected at discovery time
   * @param {MapOverlayBase} overlay - The overlay instance
   */
  constructor(id, mapInstance, domain, overlay) {
    this.id = id;
    this.mapInstance = mapInstance;
    this.domain = domain;
    this.overlay = overlay;
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
    if (this.overlay && typeof this.overlay.cleanup === 'function') {
      this.overlay.cleanup();
    }
  }
}

/**
 * OverlayRegistry - Singleton registry for map-overlay associations
 * 
 * Key guarantees:
 * 1. Domain is detected once at registration time
 * 2. Domain cannot be changed after registration
 * 3. Each map has exactly one overlay
 * 4. Network activity cannot affect domain/overlay assignments
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
     * Reference to the overlay factory
     */
    this.factory = null;
    
    /**
     * Debug mode
     */
    this.debug = false;
  }

  /**
   * Sets the overlay factory
   * @param {OverlayFactory} factory - The factory instance
   */
  setFactory(factory) {
    this.factory = factory;
  }

  /**
   * Enable/disable debug logging
   * @param {boolean} enabled - Debug flag
   */
  setDebug(enabled) {
    this.debug = enabled;
    if (this.factory) {
      this.factory.setDebug(enabled);
    }
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

    // Create overlay using factory or fallback
    let overlay = null;
    let overlayClassName = 'unknown';
    if (this.factory) {
      overlay = this.factory.createOverlay(domain);
      if (overlay) overlayClassName = overlay.constructor.name;
      console.log('[OverlayRegistry] Created overlay via this.factory:', overlayClassName, 'for domain:', domain);
    } else if (typeof window.overlayFactory !== 'undefined' && window.overlayFactory) {
      overlay = window.overlayFactory.createOverlay(domain);
      if (overlay) overlayClassName = overlay.constructor.name;
      console.log('[OverlayRegistry] Created overlay via window.overlayFactory:', overlayClassName, 'for domain:', domain);
      // Fallback if overlay is still null
      if (!overlay && typeof window.GenericMapOverlay !== 'undefined') {
        overlay = new window.GenericMapOverlay();
        overlayClassName = 'GenericMapOverlay (fallback)';
        console.warn('[OverlayRegistry] Fallback: Created GenericMapOverlay for domain:', domain);
      }
    } else if (typeof window.GenericMapOverlay !== 'undefined') {
      overlay = new window.GenericMapOverlay();
      overlayClassName = 'GenericMapOverlay (fallback)';
      console.warn('[OverlayRegistry] Fallback: Created GenericMapOverlay for domain:', domain);
    } else {
      console.warn('[OverlayRegistry] No overlay factory or GenericMapOverlay found for domain:', domain);
    }

    // Create entry
    const entry = new MapEntry(id, mapInstance, domain, overlay);
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
    
    // PHASE 6.6: PROACTIVE NATIVE MARKER DETECTION
    // After creating overlay, immediately check if site has already rendered native markers
    // This prevents race conditions where markers appear before overlay is fully initialized
    if (overlay && typeof overlay._getNativeMarkerSelector === 'function') {
      this._performNativeMarkerCheck(overlay, domain);
    }
    
    return entry;
  }

  /**
   * Performs proactive native marker detection for a newly registered map
   * This catches sites that have already rendered markers before the overlay initializes
   * 
   * @param {MapOverlayBase} overlay - The overlay instance
   * @param {string} domain - The domain (for logging)
   * @private
   */
  _performNativeMarkerCheck(overlay, domain) {
    try {
      // Schedule check after brief delay to let page stabilize
      setTimeout(() => {
        try {
          // First check for extension-injected markers
          const selector = overlay._getNativeMarkerSelector?.();
          if (selector) {
            const nativeMarkers = document.querySelectorAll(selector);
            if (nativeMarkers.length > 0) {
              console.log(`[OverlayRegistry] PRE-RENDER CHECK: Found ${nativeMarkers.length} extension native markers for ${domain}`);
              
              // Set the flag indicating native markers are present
              if (overlay) {
                overlay._nativeMarkersInjected = true;
                console.log(`[OverlayRegistry] PRE-RENDER CHECK: Set _nativeMarkersInjected = true for ${domain}`);
              }
              
              // Also set global native mode flag
              if (typeof window !== 'undefined' && window.poiState) {
                window.poiState.nativeMode = true;
                console.log(`[OverlayRegistry] PRE-RENDER CHECK: Set window.poiState.nativeMode = true for ${domain}`);
              }
              
              // Signal to content script
              window.postMessage({ type: 'POI_NATIVE_ACTIVE' }, '*');
              return; // Exit early if extension markers found
            }
          }
          
          // ALSO check for site's own native markers (e.g., gmp-advanced-marker on apartments.com)
          const siteNativeSelectors = [
            'gmp-advanced-marker',
            '[class*="advanced-marker"]',
            '.mapboxgl-popup',
            '[data-marker-id]',
            '[class*="map-marker"]'
          ];
          
          for (const sel of siteNativeSelectors) {
            try {
              const siteMarkers = document.querySelectorAll(sel);
              if (siteMarkers.length > 0) {
                console.log(`[OverlayRegistry] PRE-RENDER CHECK: Found ${siteMarkers.length} site native markers (${sel}) for ${domain}`);
                
                // Set the flag indicating native markers are present
                if (overlay) {
                  overlay._nativeMarkersInjected = true;
                  console.log(`[OverlayRegistry] PRE-RENDER CHECK: Set _nativeMarkersInjected = true for ${domain} (site markers)`);
                }
                
                // Also set global native mode flag
                if (typeof window !== 'undefined' && window.poiState) {
                  window.poiState.nativeMode = true;
                  console.log(`[OverlayRegistry] PRE-RENDER CHECK: Set window.poiState.nativeMode = true for ${domain} (site markers)`);
                }
                
                // Signal to content script
                window.postMessage({ type: 'POI_NATIVE_ACTIVE' }, '*');
                return; // Exit after first match
              }
            } catch (e) {
              // Invalid selector, continue
            }
          }
          
          this.log(`PRE-RENDER CHECK: No native markers found yet for ${domain}`);
        } catch (e) {
          this.log(`Error in pre-render native marker check for ${domain}:`, e);
        }
      }, 500); // Wait 500ms for page to stabilize
    } catch (e) {
      this.log(`Error scheduling native marker check for ${domain}:`, e);
    }
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
        nativeMarkersInjected: entry.overlay ? entry.overlay._nativeMarkersInjected : 'N/A',
        isActive: entry.isActive,
        createdAt: new Date(entry.createdAt).toISOString(),
        lastUpdate: new Date(entry.lastUpdate).toISOString(),
        poiCount: entry.overlay ? (entry.overlay.pois ? entry.overlay.pois.length : 0) : 0
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
