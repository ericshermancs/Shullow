/**
 * MapDetector: Global Edition v12.4
 * - Shadow DOM support for engine discovery
 * - Site-specific optimizations for Zillow/Redfin/Homes.com
 * - Staleness check for coordinate data
 */
const MapDetector = {
  containerStrategies: [
    function detectHomesCom() {
      // Homes.com specialized: prioritize the actual map viewport
      const gm = document.querySelector('.gm-style') || document.querySelector('.mapboxgl-canvas');
      if (gm && gm.offsetHeight > 200) return gm;

      const mapEl = document.querySelector('.map-container, .map-content, #map-container');
      if (mapEl && mapEl.offsetHeight > 200) return mapEl;

      const gmp = document.querySelector('gmp-map');
      if (gmp) return gmp;

      return null;
    },
    function detectZillowMap() {
      if (window.location.hostname.includes('zillow.com')) {
        const gm = document.querySelector('.gm-style');
        if (gm && gm.offsetHeight > 200) return gm;
      }
      return null;
    },
    function detectByGMStyle() {
      function findInShadow(root, selector) {
        if (!root) return null;
        let el = root.querySelector(selector);
        if (el && el.offsetHeight > 10) return { el, root };
        const all = Array.from(root.querySelectorAll('*'));
        for (const s of all) if (s.shadowRoot) {
          const found = findInShadow(s.shadowRoot, selector);
          if (found) return found;
        }
        return null;
      }

      const result = findInShadow(document, '.gm-style');
      if (result) {
        const { el, root } = result;

        // If it's in a Shadow Root, the host is often the <gmp-map> or similar
        if (root !== document) {
          const host = root.host;
          // For Homes.com / Realtor, ensure the host isn't bloated
          if (host.offsetWidth > 0 && host.offsetWidth < window.innerWidth * 0.9) return host;
          // If host is too big, maybe it's the whole page, use the .gm-style itself or a closer parent
        }

        let curr = el;
        // Homes.com / Generic specialized walk: look for a container that is likely JUST the map
        while (curr && curr !== document.body) {
          // Priority classes/ids that usually denote the map-only viewport
          if (curr.id === 'map' ||
            curr.classList.contains('map-container') ||
            curr.classList.contains('map-view') ||
            curr.getAttribute('data-testid')?.includes('map-viewport')) {
            return curr;
          }
          // If we hit something that looks like a sidebar or list, we've gone too far
          if (curr.classList.contains('list-container') || curr.id?.includes('sidebar')) break;

          // Stop at the first parent that has significant size but isn't the whole window
          if (curr.offsetHeight > 200 && curr.offsetWidth > 200 && curr.offsetWidth < window.innerWidth * 0.95) {
            // If the parent is much wider than the child, it might be the row containing map + sidebar
            const parent = curr.parentElement;
            if (parent && parent.offsetWidth > curr.offsetWidth + 100) return curr;
          }
          curr = curr.parentElement;
        }
        return el;
      }
      return null;
    },
    function detectByMapbox() {
      const mb = document.querySelector('.mapboxgl-canvas') || document.querySelector('.maplibregl-canvas');
      if (mb && mb.offsetHeight > 10) return mb.parentElement;
      return null;
    },
    function detectByFuzzySelector() {
      const elements = Array.from(document.querySelectorAll('[id*="map" i], [class*="map" i], [data-testid*="map" i]'));
      return elements.filter(el => el !== document.body && el.offsetHeight > 200 && el.offsetWidth > 200)
        .sort((a, b) => (a.offsetWidth * a.offsetHeight) - (b.offsetWidth * b.offsetHeight))[0] || null;
    },
    function detectIframeFallback() {
      const patterns = [/maps\.google/, /mapbox/, /bing\.com\/maps/];
      const iframes = Array.from(document.querySelectorAll('iframe'));
      return iframes.find(f => f.offsetHeight > 200 && patterns.some(p => p.test(f.src))) || null;
    }
  ],

  boundsStrategies: [
    function extractFromBridge() {
      const b = document.documentElement.getAttribute('data-poi-bounds');
      const t = document.documentElement.getAttribute('data-poi-timestamp');

      if (t && (Date.now() - parseInt(t) > 5000)) return null;
      if (b) { try { return JSON.parse(b); } catch (e) { } }
      return null;
    }
  ],

  detectContainer() {
    for (const strategy of this.containerStrategies) {
      try {
        const result = strategy();
        if (result) return result;
      } catch (e) { }
    }
    return null;
  },

  extractBounds(container) {
    for (const strategy of this.boundsStrategies) {
      try {
        const result = strategy(container);
        if (result) return result;
      } catch (e) { }
    }
    return null;
  }
};
