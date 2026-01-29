/**
 * POI Bridge: Sniffer Module
 * Monitors network traffic for coordinate data using non-destructive interception.
 */
(function() {
  if (window.poiSniff) return;

  window.poiSniff = {
    init() {
      if (this._initialized) return;
      this._initialized = true;

      const self = this;

      // --- 1. Fetch Proxy (Context-Safe) ---
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        try {
          const input = args[0];
          const init = args[1];
          
          let url = '';
          if (typeof input === 'string') url = input;
          else if (input instanceof URL) url = input.toString();
          else if (input && typeof input === 'object') url = input.url;

          if (url) {
            const body = (typeof init?.body === 'string') ? init.body : null;
            self.process(url, body);
          }
        } catch (e) {}
        
        return originalFetch(...args);
      };

      // --- 2. XHR Proxy (Non-destructive) ---
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        this._poiUrl = url;
        return originalOpen.apply(this, arguments);
      };

      const originalSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function(body) {
        try {
          if (this._poiUrl) self.process(this._poiUrl, body);
        } catch (e) {}
        return originalSend.apply(this, arguments);
      };

      // --- 3. History API Proxy (Redfin URL updates) ---
      const wrapHistory = (type) => {
         const orig = history[type];
         return function() {
            const rv = orig.apply(this, arguments);
            const e = new Event(type);
            e.arguments = arguments;
            window.dispatchEvent(e);
            return rv;
         };
      };
      history.pushState = wrapHistory('pushState');
      history.replaceState = wrapHistory('replaceState');

      window.addEventListener('pushState', () => self.process(window.location.href));
      window.addEventListener('replaceState', () => self.process(window.location.href));
      window.addEventListener('popstate', () => self.process(window.location.href));

      console.log('POI Bridge: Sniffer initialized');
    },

    process(url, body) {
      if (!url) return;
      try {
        const s = url.toString();
        
        // A. URL Query Sniffing
        // Redfin Specific (URL often contains map location if updated)
        // e.g. /city/30749/NY/New-York/filter/viewport=...
        const p = [
          /bounds=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/,
          /sw=([\d.-]+),([\d.-]+)&ne=([\d.-]+),([\d.-]+)/,
          /viewport=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/,
          /bbox=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/,
          /points=([\d.-]+),([\d.-]+),([\d.-]+),([\d.-]+)/
        ];
        
        for (const pattern of p) {
          const m = s.match(pattern);
          if (m) {
            const v = m.slice(1, 5).map(parseFloat);
            const b = this.normalizeBounds(v);
            if (b) {
              window.poiPortal.update(b, 'network-url');
              return;
            }
          }
        }

        // B. Body/JSON Sniffing
        if (body && typeof body === 'string') {
          // SAFETY: Limit parsing to reasonable size to prevent main thread blocking
          if (body.length > 500000) return; // Skip bodies > 500KB
          
          try {
            const data = JSON.parse(body);
            
            // Redfin API Specific
            if (s.includes('/api/gis')) {
               const b = this.findRedfinBounds(data);
               if (b) {
                  window.poiPortal.update(b, 'redfin-api');
                  return;
               }
            }

            const found = this.findBounds(data);
            if (found) window.poiPortal.update(found, 'network-body');
          } catch (e) {}
        }
      } catch (e) {}
    },

    findRedfinBounds(data) {
       // Look for Redfin specific response structure
       // e.g. payload.sections[0].rows...
       // Sometimes "bound" is not explicit, but we can infer from homes if needed (not preferred)
       try {
          // If response has explicit viewport/bounds
          if (data?.payload?.viewport) return data.payload.viewport;
          if (data?.payload?.bounds) return data.payload.bounds;
       } catch(e) {}
       return null; 
    },

    normalizeBounds(v) {
      const lats = v.filter(x => Math.abs(x) < 90);
      const lngs = v.filter(x => Math.abs(x) > 60 && Math.abs(x) < 180);
      
      if (lats.length >= 2 && lngs.length >= 2) {
        return {
          north: Math.max(...lats),
          south: Math.min(...lats),
          east: Math.max(...lngs),
          west: Math.min(...lngs)
        };
      }
      return null;
    },

    findBounds(obj, depth = 0) {
      if (!obj || depth > 12 || typeof obj !== 'object') return null;
      
      try {
        // Specialized: Homes.com / Realtor
        let inner = obj.scms ? JSON.parse(obj.scms) : obj;
        if (inner.mapCriteria?.boundingBox) {
          const b = inner.mapCriteria.boundingBox;
          return { north: b.tl.lt, south: b.br.lt, west: b.tl.ln, east: b.br.ln };
        }
        
        if (obj.viewport && typeof obj.viewport.north === 'number') return obj.viewport;

        // Generic patterns
        if (typeof obj.north === 'number' && typeof obj.south === 'number' && obj.north !== obj.south) return obj;
        if (obj.ne && obj.sw && typeof obj.ne.lat === 'number') return { north: obj.ne.lat, south: obj.sw.lat, east: obj.ne.lng, west: obj.sw.lng };
        
        for (const k in obj) {
          if (obj[k] && typeof obj[k] === 'object') {
            const r = this.findBounds(obj[k], depth + 1);
            if (r) return r;
          }
        }
      } catch (e) {}
      return null;
    }
  };
})();
