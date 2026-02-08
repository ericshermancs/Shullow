/**
 * siteConfig.js - Centralized site-specific configuration
 * 
 * Simplified replacement for the overlay class hierarchy.
 * Contains all site-specific settings including:
 * - Domain detection selectors
 * - Map type identification
 * - Style overrides (z-index, etc.)
 * - Special behaviors/features per site
 */

// Default styles applied to all sites unless overridden
const DEFAULT_STYLES = {
  markerZIndex: 5000,
  markerHoverZIndex: 1000000,
  containerZIndex: null,
  markerOpacity: 1.0,
  markerSize: 32
};

const SITE_CONFIG = {
  'zillow.com': {
    displayName: 'Zillow',
    mapType: 'mapbox',
    
    // Container detection - ordered by priority
    selectors: [
      '.mapboxgl-map',
      '#search-page-map',
      '[data-testid="map"]',
      '.map-container',
      '#map'
    ],
    
    // Style overrides (merged with DEFAULT_STYLES, null removes a key)
    styles: {
      // Inherits all defaults
    },
    
    // Special features
    features: {
      reduxStore: false,
      shadowDOM: false,
      boundsTracking: true
    }
  },
  
  'redfin.com': {
    displayName: 'Redfin',
    mapType: 'google',
    
    selectors: [
      '.gm-style',
      '[data-rf-test-id="map"]',
      '#map-container',
      '.MapContainer',
      '.HomeViews'
    ],
    
    styles: {
      // Could override here, e.g.: markerZIndex: 10000
      // Or remove: containerZIndex: null
      markerZIndex: 10

    },
    
    features: {
      reduxStore: true, // Redfin-specific: subscribe to Redux for bounds
      shadowDOM: false,
      boundsTracking: true
    }
  },
  
  'realtor.com': {
    displayName: 'Realtor',
    mapType: 'auto', // Can be either Google or Mapbox
    
    selectors: [
      '.mapboxgl-map',
      '.gm-style',
      'gmp-map',
      '#map-container',
      '[data-testid="map"]',
      '.map-container',
      '#mapboxgl-map'
    ],
    
    styles: {
      // Inherits defaults
    },
    
    features: {
      reduxStore: false,
      shadowDOM: true, // Realtor uses Shadow DOM
      boundsTracking: true
    }
  },
  
  'homes.com': {
    displayName: 'Homes.com',
    mapType: 'google',
    
    selectors: [
      '.gm-style',
      '#map',
      '.map-container',
      '[data-testid="map"]'
    ],
    
    styles: {
      // Inherits defaults
    },
    
    features: {
      reduxStore: false,
      shadowDOM: false,
      boundsTracking: true
    }
  },
  
  'onekeymls.com': {
    displayName: 'OneKey MLS',
    mapType: 'mapbox',
    
    selectors: [
      '.mapboxgl-map',
      '#map',
      '.map-container'
    ],
    
    styles: {
      // Inherits defaults
    },
    
    features: {
      reduxStore: false,
      shadowDOM: false,
      boundsTracking: true
    }
  },
  
  // Default fallback for unknown sites
  'default': {
    displayName: 'Generic',
    mapType: 'auto',
    
    selectors: [
      '.mapboxgl-map',
      '.gm-style',
      'gmp-map',
      '#map',
      '[role="application"]',
      '.map-container'
    ],
    
    styles: {
      // Uses DEFAULT_STYLES as-is
    },
    
    features: {
      reduxStore: false,
      shadowDOM: false,
      boundsTracking: true
    }
  }
};

// Domain aliases
const DOMAIN_ALIASES = {
  'www.zillow.com': 'zillow.com',
  'www.redfin.com': 'redfin.com',
  'www.homes.com': 'homes.com',
  'www.onekeymls.com': 'onekeymls.com',
  'www.realtor.com': 'realtor.com'
};

/**
 * SiteConfigManager - Utility for working with site configurations
 */
class SiteConfigManager {
  constructor() {
    this.config = SITE_CONFIG;
    this.aliases = DOMAIN_ALIASES;
    this.defaultStyles = DEFAULT_STYLES;
    this.debug = false;
    
    console.log('[SiteConfig] Initialized with', Object.keys(this.config).length, 'site configs');
  }
  
  setDebug(enabled) {
    this.debug = enabled;
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[SiteConfig]', ...args);
    }
  }
  
  /**
   * Merges site-specific styles with defaults
   * - Starts with DEFAULT_STYLES
   * - Applies site-specific overrides
   * - Removes keys where site value is null
   */
  _mergeStyles(siteStyles) {
    const merged = { ...this.defaultStyles };
    
    if (!siteStyles) return merged;
    
    for (const [key, value] of Object.entries(siteStyles)) {
      if (value === null) {
        // null means remove this style key
        delete merged[key];
      } else {
        // Override or add new key
        merged[key] = value;
      }
    }
    
    return merged;
  }
  
  /**
   * Normalizes a domain (removes www, applies aliases)
   */
  normalizeDomain(domain) {
    if (!domain) return 'default';
    
    let normalized = domain.toLowerCase().trim();
    
    // Apply alias
    if (this.aliases[normalized]) {
      normalized = this.aliases[normalized];
    }
    
    // Remove www. prefix if not aliased
    if (normalized.startsWith('www.')) {
      normalized = normalized.substring(4);
    }
    
    return normalized;
  }
  
  /**
   * Gets configuration for a domain with merged styles
   */
  getConfig(domain) {
    const normalized = this.normalizeDomain(domain);
    
    this.log(`Getting config for domain: ${domain} (normalized: ${normalized})`);
    
    let siteConfig = null;
    
    // Try exact match
    if (this.config[normalized]) {
      siteConfig = this.config[normalized];
      this.log(`Exact match for ${normalized}`);
    } else {
      // Try partial match (e.g., "zillow.com" matches "www.zillow.com")
      for (const [key, value] of Object.entries(this.config)) {
        if (key !== 'default' && (normalized.includes(key) || key.includes(normalized))) {
          this.log(`Partial match: ${normalized} -> ${key}`);
          siteConfig = value;
          break;
        }
      }
    }
    
    // Fallback to default
    if (!siteConfig) {
      this.log(`No match for ${normalized}, using default`);
      siteConfig = this.config.default;
    }
    
    // Return config with merged styles
    const result = {
      ...siteConfig,
      domain: normalized,
      styles: this._mergeStyles(siteConfig.styles)
    };
    
    this.log(`Config result for ${domain}:`, result);
    
    return result;
  }
  
  /**
   * Detects a map container for the given domain
   */
  detectContainer(domain) {
    const config = this.getConfig(domain);
    
    // If site uses Shadow DOM, search within it
    if (config.features.shadowDOM) {
      return this._detectInShadowDOM(config.selectors);
    }
    
    // Standard DOM search
    for (const selector of config.selectors) {
      try {
        const el = document.querySelector(selector);
        if (el) {
          this.log(`Detected container for ${domain}: ${selector}`);
          return el;
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    
    return null;
  }
  
  /**
   * Searches for elements within Shadow DOM
   */
  _detectInShadowDOM(selectors, root = document.body, found = null) {
    if (!root) return found;
    
    try {
      // Try each selector on current level
      if (!found) {
        for (const selector of selectors) {
          const elements = root.querySelectorAll(selector);
          if (elements.length > 0) {
            found = elements[0];
            break;
          }
        }
      }
      
      // Recurse into shadow roots
      if (!found) {
        const all = root.querySelectorAll('*');
        for (const el of all) {
          if (el.shadowRoot) {
            // Skip common UI elements
            if (el.tagName.includes('ICON') || el.tagName.includes('BUTTON')) {
              continue;
            }
            found = this._detectInShadowDOM(selectors, el.shadowRoot, found);
            if (found) break;
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    return found;
  }
  
  /**
   * Applies site-specific styles to markers
   */
  applyMarkerStyles(element, domain, isHover = false) {
    const config = this.getConfig(domain);
    const zIndex = isHover 
      ? config.styles.markerHoverZIndex 
      : config.styles.markerZIndex;
    
    if (zIndex !== null) {
      element.style.zIndex = zIndex.toString();
    }
  }
  
  /**
   * Gets all configured sites
   */
  getAllSites() {
    return Object.keys(this.config).filter(k => k !== 'default');
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_STYLES, SITE_CONFIG, DOMAIN_ALIASES, SiteConfigManager };
} else if (typeof window !== 'undefined') {
  window.DEFAULT_STYLES = DEFAULT_STYLES;
  window.SITE_CONFIG = SITE_CONFIG;
  window.DOMAIN_ALIASES = DOMAIN_ALIASES;
  window.SiteConfigManager = SiteConfigManager;
  window.siteConfig = new SiteConfigManager();
}
