/**
 * overlayFactory.js - Factory for creating site-specific overlay instances
 * 
 * This factory uses the overlay configuration to determine which overlay class
 * to instantiate for a given domain. It supports domain detection at map
 * discovery time (not globally) to prevent interference from ads/iframes.
 */

/**
 * OverlayFactory - Creates appropriate overlay instances for each site
 */
class OverlayFactory {
  constructor() {
    /**
     * Registry of overlay classes
     * Maps class names to constructors
     */
    this.overlayClasses = {};
    
    /**
     * Site configuration (loaded from overlayConfig.json or inline)
     */
    this.config = null;
    
    /**
     * Debug mode
     */
    this.debug = false;
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
      console.log('[OverlayFactory]', ...args);
    }
  }

  /**
   * Loads the overlay configuration
   * In a browser extension context, this may be embedded or fetched
   * @param {Object} [configOverride] - Optional config to use instead of fetching
   */
  loadConfig(configOverride = null) {
    if (configOverride) {
      this.config = configOverride;
      return;
    }

    // Default inline config (mirrors overlayConfig.json)
    this.config = {
      sites: {
        'zillow.com': { overlay: 'ZillowOverlay', mapType: 'mapbox', priority: 100 },
        'redfin.com': { overlay: 'RedfinOverlay', mapType: 'google', priority: 100 },
        'homes.com': { overlay: 'HomesComOverlay', mapType: 'google', priority: 100 },
        'onekeymls.com': { overlay: 'OneKeyOverlay', mapType: 'mapbox', priority: 100 },
        'realtor.com': { overlay: 'RealtorOverlay', mapType: 'auto', priority: 100 }
      },
      defaults: { overlay: 'GenericMapOverlay', mapType: 'auto', priority: 1 },
      domainAliases: {
        'www.zillow.com': 'zillow.com',
        'www.redfin.com': 'redfin.com',
        'www.homes.com': 'homes.com',
        'www.onekeymls.com': 'onekeymls.com',
        'www.realtor.com': 'realtor.com'
      }
    };
  }

  /**
   * Registers an overlay class with the factory
   * @param {string} name - Class name (e.g., 'ZillowOverlay')
   * @param {Function} overlayClass - The overlay class constructor
   */
  registerOverlay(name, overlayClass) {
    this.overlayClasses[name] = overlayClass;
    this.log(`Registered overlay: ${name}`);
  }

  /**
   * Registers all known overlay classes from the window object
   * Call this after all overlay scripts have loaded
   */
  registerFromWindow() {
    const overlayNames = [
      'ZillowOverlay',
      'RedfinOverlay',
      'HomesComOverlay',
      'OneKeyOverlay',
      'RealtorOverlay',
      'GenericMapOverlay',
      'MapOverlayBase',
      'GoogleMapsOverlayBase',
      'MapboxOverlayBase'
    ];

    for (const name of overlayNames) {
      if (typeof window[name] === 'function') {
        this.registerOverlay(name, window[name]);
      }
    }
  }

  /**
   * Normalizes a domain name (removes www, handles aliases)
   * @param {string} domain - The domain to normalize
   * @returns {string} Normalized domain
   */
  normalizeDomain(domain) {
    if (!domain) return '';
    
    // Lowercase
    domain = domain.toLowerCase();
    
    // Check aliases
    if (this.config && this.config.domainAliases && this.config.domainAliases[domain]) {
      return this.config.domainAliases[domain];
    }
    
    // Remove www prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    return domain;
  }

  /**
   * Gets the site configuration for a domain
   * @param {string} domain - The domain to look up
   * @returns {Object} Site config or defaults
   */
  getSiteConfig(domain) {
    if (!this.config) {
      this.loadConfig();
    }

    const normalized = this.normalizeDomain(domain);
    
    // Direct match
    if (this.config.sites[normalized]) {
      return this.config.sites[normalized];
    }
    
    // Partial match (e.g., 'zillow.com' matches 'maps.zillow.com')
    for (const siteDomain of Object.keys(this.config.sites)) {
      if (normalized.endsWith(siteDomain) || normalized.includes(siteDomain)) {
        return this.config.sites[siteDomain];
      }
    }
    
    // Return defaults
    return this.config.defaults;
  }

  /**
   * Creates an overlay instance for the given domain
   * @param {string} domain - The domain to create an overlay for
   * @returns {MapOverlayBase|null} The overlay instance, or null if unavailable
   */
  createOverlay(domain) {
    const siteConfig = this.getSiteConfig(domain);
    const overlayName = siteConfig.overlay;
    
    console.log(`Creating overlay for ${domain}: ${overlayName}`);
    
    const OverlayClass = this.overlayClasses[overlayName];
    if (!OverlayClass) {
      this.log(`Overlay class not found: ${overlayName}, falling back to GenericMapOverlay`);
      
      const FallbackClass = this.overlayClasses['GenericMapOverlay'];
      if (FallbackClass) {
        return new FallbackClass(this.debug);
      }
      
      return null;
    }
    
    return new OverlayClass(this.debug);
  }

  /**
   * Creates an overlay for a specific map instance, determining domain
   * from the map's container element context.
   * 
   * This is the key method for Phase 6.5 - it determines the domain
   * at discovery time based on the map's location in the DOM, not
   * from global state that could be polluted by iframes/ads.
   * 
   * @param {Object} mapInstance - The map instance
   * @param {HTMLElement} [container] - Optional container element
   * @returns {MapOverlayBase|null} The overlay instance
   */
  createOverlayForMap(mapInstance, container = null) {
    // Get domain from the map's document context
    let domain = null;
    
    // Method 1: From container's ownerDocument
    if (container && container.ownerDocument) {
      try {
        domain = container.ownerDocument.location?.hostname;
      } catch (e) {}
    }
    
    // Method 2: From map's container (if it has one)
    if (!domain && mapInstance) {
      try {
        // Google Maps
        if (typeof mapInstance.getDiv === 'function') {
          const div = mapInstance.getDiv();
          domain = div?.ownerDocument?.location?.hostname;
        }
        // Mapbox
        else if (mapInstance._container) {
          domain = mapInstance._container.ownerDocument?.location?.hostname;
        }
        // Generic container reference
        else if (mapInstance.container) {
          const c = mapInstance.container;
          const el = (typeof c === 'string') ? document.getElementById(c) : c;
          domain = el?.ownerDocument?.location?.hostname;
        }
      } catch (e) {
        this.log('Failed to extract domain from map:', e);
      }
    }
    
    // Method 3: Fallback to current window (main page only)
    if (!domain) {
      try {
        // Only use window.location if we're in the top frame
        if (window === window.top) {
          domain = window.location.hostname;
        }
      } catch (e) {
        // Cross-origin iframe, ignore
      }
    }
    
    if (!domain) {
      this.log('Could not determine domain for map, using generic overlay');
      domain = '';
    }
    
    return this.createOverlay(domain);
  }

  /**
   * Gets all registered overlay class names
   * @returns {string[]} Array of overlay class names
   */
  getRegisteredOverlays() {
    return Object.keys(this.overlayClasses);
  }

  /**
   * Gets all configured site domains
   * @returns {string[]} Array of domain names
   */
  getConfiguredSites() {
    if (!this.config) {
      this.loadConfig();
    }
    return Object.keys(this.config.sites);
  }
}

// Singleton instance
const overlayFactory = new OverlayFactory();

// Auto-initialize config
overlayFactory.loadConfig();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OverlayFactory, overlayFactory };
} else if (typeof window !== 'undefined') {
  window.OverlayFactory = OverlayFactory;
  window.overlayFactory = overlayFactory;
}
