var window = (() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // bridge/modules/mapUtilities.js
  var require_mapUtilities = __commonJS({
    "bridge/modules/mapUtilities.js"(exports, module) {
      var MapUtils2 = class {
        /**
         * Generates a fallback SVG marker icon
         * @param {string} color - Primary fill color (default: #ff0000)
         * @param {string} secondaryColor - Stroke color (default: #ffffff)
         * @param {number} size - Size in pixels (default: 32)
         * @returns {string} Data URI for the SVG
         */
        static generateFallbackSVG(color = "#ff0000", secondaryColor = "#ffffff", size = 32) {
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
    `.trim().replace(/\s+/g, " ");
        }
        /**
         * Extracts domain from a URL
         * @param {string} url - The URL to extract domain from
         * @returns {string} The domain (e.g., 'zillow.com')
         */
        static getDomain(url) {
          try {
            const parsed = new URL(url);
            return parsed.hostname.replace(/^www\./, "");
          } catch (e) {
            return "";
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
      };
      var MarkerPool2 = class {
        constructor() {
          this.pool = [];
          this.maxPoolSize = 100;
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
          return createFn ? createFn() : document.createElement("div");
        }
        /**
         * Releases an element back to the pool for reuse
         * @param {HTMLElement} element - Element to return to pool
         */
        release(element) {
          if (!element)
            return;
          if (element.parentNode) {
            element.remove();
          }
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
      };
      var MapTypeDetector2 = class {
        /**
         * Checks if the map instance is a Google Maps instance
         * @param {Object} map - Map instance to check
         * @returns {boolean} True if Google Maps
         */
        static isGoogleMap(map) {
          if (!map)
            return false;
          return map.overlayMapTypes !== void 0 || typeof map.getDiv === "function" || typeof map.setCenter === "function" && typeof map.fitBounds === "function" && !map.addSource;
        }
        /**
         * Checks if the map instance is a Mapbox GL JS instance
         * @param {Object} map - Map instance to check
         * @returns {boolean} True if Mapbox GL JS
         */
        static isMapbox(map) {
          if (!map)
            return false;
          return map.addSource !== void 0 && map.addLayer !== void 0 && typeof map.on === "function";
        }
        /**
         * Checks if the map instance is a Leaflet instance
         * @param {Object} map - Map instance to check
         * @returns {boolean} True if Leaflet
         */
        static isLeaflet(map) {
          if (!map)
            return false;
          return map._leaflet_id !== void 0 || typeof map.addLayer === "function" && typeof map.removeLayer === "function" && !map.addSource;
        }
        /**
         * Detects and returns the map type as a string
         * @param {Object} map - Map instance to check
         * @returns {string} 'google' | 'mapbox' | 'leaflet' | 'unknown'
         */
        static detect(map) {
          if (this.isGoogleMap(map))
            return "google";
          if (this.isMapbox(map))
            return "mapbox";
          if (this.isLeaflet(map))
            return "leaflet";
          return "unknown";
        }
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = { MapUtils: MapUtils2, MarkerPool: MarkerPool2, MapTypeDetector: MapTypeDetector2 };
      } else if (typeof window !== "undefined") {
        window.MapUtils = MapUtils2;
        window.MarkerPool = MarkerPool2;
        window.MapTypeDetector = MapTypeDetector2;
      }
    }
  });

  // bridge/modules/hijack.js
  var require_hijack = __commonJS({
    "bridge/modules/hijack.js"(exports, module) {
      var MapHijackManager = class extends ManagerBase {
        constructor() {
          super();
          this.activeMaps = /* @__PURE__ */ new Set();
          this.originalConstructors = {};
        }
        /**
         * @override
         * Called during initialization
         */
        async onInitialize() {
          this.interceptConstructors();
          this.log("MapHijackManager initialized");
        }
        /**
         * @override
         * Cleanup and restore original constructors
         */
        cleanup() {
          this.activeMaps.clear();
          this.initialized = false;
          this.log("MapHijackManager cleaned up");
        }
        /**
         * Attaches event listeners to a captured map instance
         * @param {Object} instance - The map instance
         */
        attachListeners(instance) {
          if (!instance || instance._poiListener)
            return;
          console.log("[POI TITAN] Attaching listeners to captured instance");
          let target = instance;
          if (!target.addListener && !target.on) {
            if (target.map && (target.map.addListener || target.map.on))
              target = target.map;
            else if (target.getMap && typeof target.getMap === "function") {
              const m = target.getMap();
              if (m && (m.addListener || m.on))
                target = m;
            }
          }
          try {
            if (target.on) {
              const update = () => {
                if (typeof target.getBounds === "function") {
                  const b = target.getBounds();
                  if (b) {
                    window.poiPortal.update({
                      north: b.getNorth(),
                      south: b.getSouth(),
                      east: b.getEast(),
                      west: b.getWest()
                    }, "instance-event");
                  }
                }
              };
              const safeUpdate = () => {
                try {
                  update();
                } catch (e) {
                }
              };
              target.on("moveend", safeUpdate);
              target.on("zoomend", safeUpdate);
              instance._poiListener = true;
            } else if (target.addListener) {
              const update = () => {
                if (typeof target.getBounds === "function") {
                  const b = target.getBounds();
                  if (b && b.getNorthEast && b.getSouthWest) {
                    window.poiPortal.update({
                      north: b.getNorthEast().lat(),
                      south: b.getSouthWest().lat(),
                      east: b.getNorthEast().lng(),
                      west: b.getSouthWest().lng()
                    }, "instance-event");
                  }
                }
              };
              target.addListener("idle", update);
              instance._poiListener = true;
            }
          } catch (e) {
            console.error("[POI TITAN] Failed to attach listeners", e);
          }
        }
        /**
         * Gets all active map instances as an array
         * @returns {Array} Array of active map instances
         */
        getActiveMaps() {
          return Array.from(this.activeMaps);
        }
        /**
         * Intercepts map constructors (main initialization logic)
         * Previously the apply() method
         */
        interceptConstructors() {
          const self = this;
          if (window.google?.maps?.Map) {
            this.hijackGoogle(window.google.maps);
          } else {
            if (!window._poiTrappedGoogle) {
              let _google = window.google;
              Object.defineProperty(window, "google", {
                get() {
                  return _google;
                },
                set(val) {
                  _google = val;
                  if (val?.maps) {
                    if (val.maps.Map) {
                      self.hijackGoogle(val.maps);
                    }
                    try {
                      const mapsProxy = new Proxy(val.maps, {
                        set(target, prop, value) {
                          if (prop === "Map") {
                            let HijackedMap3 = function(...args) {
                              if (!new.target)
                                return new HijackedMap3(...args);
                              const instance = new Original(...args);
                              self.activeMaps.add(instance);
                              self.attachListeners(instance);
                              return instance;
                            };
                            var HijackedMap2 = HijackedMap3;
                            const Original = value;
                            HijackedMap3.prototype = Original.prototype;
                            HijackedMap3._isHijacked = true;
                            Object.assign(HijackedMap3, Original);
                            target[prop] = HijackedMap3;
                            return true;
                          }
                          target[prop] = value;
                          return true;
                        }
                      });
                      _google.maps = mapsProxy;
                    } catch (e) {
                    }
                  }
                },
                configurable: true
              });
              window._poiTrappedGoogle = true;
            }
          }
          try {
            if (window.mapboxgl?.Map && !window.mapboxgl.Map._isHijacked) {
              let HijackedMap2 = function(...args) {
                const instance = new Original(...args);
                self.activeMaps.add(instance);
                self.attachListeners(instance);
                return instance;
              };
              var HijackedMap = HijackedMap2;
              const Original = window.mapboxgl.Map;
              HijackedMap2.prototype = Original.prototype;
              HijackedMap2._isHijacked = true;
              Object.assign(HijackedMap2, Original);
              window.mapboxgl.Map = HijackedMap2;
            }
          } catch (e) {
          }
        }
        /**
         * Hijacks Google Maps constructor and prototype methods
         * @param {Object} mapsObj - The google.maps object
         */
        hijackGoogle(mapsObj) {
          const self = this;
          try {
            if (mapsObj.Map && !mapsObj.Map._isHijacked) {
              let HijackedMap2 = function(...args) {
                if (!new.target)
                  return new HijackedMap2(...args);
                const instance = new Original(...args);
                self.activeMaps.add(instance);
                self.attachListeners(instance);
                return instance;
              };
              var HijackedMap = HijackedMap2;
              const Original = mapsObj.Map;
              HijackedMap2.prototype = Original.prototype;
              HijackedMap2._isHijacked = true;
              Object.assign(HijackedMap2, Original);
              mapsObj.Map = HijackedMap2;
            }
            if (mapsObj.Map && mapsObj.Map.prototype) {
              const proto = mapsObj.Map.prototype;
              const methods = ["setCenter", "setZoom", "setOptions", "fitBounds", "panTo", "panBy", "set"];
              methods.forEach((method) => {
                if (proto[method] && !proto[method]._isHijacked) {
                  const origMethod = proto[method];
                  proto[method] = function(...args) {
                    if (this && typeof this.getDiv === "function" && typeof this.getBounds === "function") {
                      if (window.poiHijack && window.poiHijack.activeMaps && !window.poiHijack.activeMaps.has(this)) {
                        console.log("[POI TITAN] Backdoor capture via", method);
                        window.poiHijack.activeMaps.add(this);
                        window.poiHijack.attachListeners(this);
                      }
                    }
                    return origMethod.apply(this, args);
                  };
                  proto[method]._isHijacked = true;
                }
              });
            }
          } catch (e) {
          }
        }
        /**
         * Public method to trigger constructor interception
         * (maintains backwards compatibility with existing code)
         */
        apply() {
          this.interceptConstructors();
        }
      };
      var hijackManager = new MapHijackManager();
      window.poiHijack = hijackManager;
      if (typeof module !== "undefined" && module.exports) {
        module.exports = MapHijackManager;
      }
    }
  });

  // bridge/modules/discovery.js
  var require_discovery = __commonJS({
    "bridge/modules/discovery.js"(exports, module) {
      var MapDiscoveryManager = class extends ManagerBase {
        constructor() {
          super();
          this.observers = [];
          this.scanInterval = null;
          this._idleCounter = 0;
        }
        /**
         * Registers a discovered map with the OverlayRegistry
         * Domain detection happens HERE at discovery time.
         * @param {Object} map - The map instance
         * @param {HTMLElement} [container] - The container element
         * @private
         */
        _registerMap(map, container = null) {
          if (!map)
            return;
          window.poiHijack.activeMaps.add(map);
          window.poiHijack.attachListeners(map);
          if (window.overlayRegistry) {
            const entry = window.overlayRegistry.register(map, container);
            if (entry && entry.overlay) {
              this.log(`Registered map ${entry.id} with overlay for domain: ${entry.domain}`);
            }
          }
        }
        /**
         * @override
         * Called during initialization
         */
        async onInitialize() {
          this.log("MapDiscoveryManager initialized");
        }
        /**
         * @override
         * Cleanup observers and intervals
         */
        cleanup() {
          this.stopScanning();
          this.observers.forEach((obs) => obs.disconnect());
          this.observers = [];
          this.initialized = false;
          this.log("MapDiscoveryManager cleaned up");
        }
        /**
         * Starts continuous scanning for maps
         */
        startScanning() {
          if (this.scanInterval)
            return;
          this.scanInterval = setInterval(() => this.run(), 1e3);
          this.log("Started scanning");
        }
        /**
         * Stops continuous scanning
         */
        stopScanning() {
          if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
            this.log("Stopped scanning");
          }
        }
        /**
         * Finds all elements matching selector within Shadow DOM
         * @param {Node} root - Root node to search from
         * @param {string} selector - CSS selector
         * @param {Array} found - Accumulator array
         * @returns {Array} Found elements
         */
        findAllInShadow(root, selector, found = []) {
          if (!root)
            return found;
          try {
            const elements = root.querySelectorAll(selector);
            elements.forEach((el) => found.push(el));
            const all = root.querySelectorAll("*");
            for (const s of all) {
              if (s.shadowRoot) {
                if (s.tagName.includes("ICON") || s.tagName.includes("BUTTON"))
                  continue;
                this.findAllInShadow(s.shadowRoot, selector, found);
              }
            }
          } catch (e) {
          }
          return found;
        }
        /**
         * Main discovery run - finds and registers maps
         */
        run() {
          if (window.poiHijack.activeMaps.size > 0) {
            this._idleCounter = (this._idleCounter || 0) + 1;
            if (this._idleCounter % 10 !== 0)
              return;
          }
          this._discoverMapboxGlobal();
          this._discoverWebComponents();
          this._discoverDOMAndFiber();
        }
        /**
         * Discover maps via Mapbox global registry
         * @private
         */
        _discoverMapboxGlobal() {
          try {
            if (window.mapboxgl?.getInstances) {
              const instances = window.mapboxgl.getInstances();
              instances?.forEach((map) => {
                if (map && typeof map.getBounds === "function") {
                  const container = map._container || null;
                  this._registerMap(map, container);
                }
              });
            }
          } catch (e) {
          }
        }
        /**
         * Discover maps via Web Components (Shadow DOM)
         * @private
         */
        _discoverWebComponents() {
          try {
            this.findAllInShadow(document, "gmp-map, gmp-advanced-marker").forEach((el) => {
              const map = el.map || el.innerMap || el.getMap?.();
              if (map && typeof map.getBounds === "function") {
                this._registerMap(map, el);
              }
            });
          } catch (e) {
          }
        }
        /**
         * Discover maps via DOM selectors and React Fiber
         * @private
         */
        _discoverDOMAndFiber() {
          const selectors = [
            ".gm-style",
            ".mapboxgl-map",
            ".leaflet-container",
            "canvas",
            "#map-container",
            ".map-container",
            '[data-rf-test-id="map"]',
            'div[class*="Map"]',
            'div[class*="map"]'
          ];
          const mapProps = ["map", "mapInstance", "innerMap", "__google_map__", "mapObject", "viewer"];
          selectors.forEach((sel) => {
            this.findAllInShadow(document, sel).forEach((el) => {
              let curr = el;
              for (let i = 0; i < 5 && curr; i++) {
                for (const p of mapProps) {
                  try {
                    if (curr[p] && typeof curr[p].getBounds === "function") {
                      this._registerMap(curr[p], el);
                    }
                  } catch (e) {
                  }
                }
                const fiberKey = Object.keys(curr).find((k) => k.startsWith("__reactFiber"));
                if (fiberKey) {
                  let fiber = curr[fiberKey];
                  while (fiber) {
                    if (fiber.memoizedProps) {
                      for (const p of mapProps) {
                        try {
                          const val = fiber.memoizedProps[p];
                          if (val && (typeof val.getBounds === "function" || typeof val.setCenter === "function")) {
                            this.log("Discovery found map via Fiber prop:", p);
                            this._registerMap(val, el);
                          }
                        } catch (e) {
                        }
                      }
                    }
                    fiber = fiber.return;
                  }
                }
                curr = curr.parentElement || (curr.parentNode instanceof ShadowRoot ? curr.parentNode.host : null);
              }
            });
          });
        }
        /**
         * Discovers maps and returns them (for use by overlays)
         * @returns {Array} Array of discovered map instances
         */
        discoverMaps() {
          this.run();
          return Array.from(window.poiHijack.activeMaps);
        }
      };
      var discoveryManager = new MapDiscoveryManager();
      window.poiDiscovery = discoveryManager;
      if (typeof module !== "undefined" && module.exports) {
        module.exports = MapDiscoveryManager;
      }
    }
  });

  // bridge/modules/portal.js
  var require_portal = __commonJS({
    "bridge/modules/portal.js"(exports, module) {
      var PortalManager = class extends ManagerBase {
        constructor() {
          super();
          this.lastBounds = null;
          this.lastUpdateTime = 0;
          this.lastPriority = 0;
          this.messageHandlers = /* @__PURE__ */ new Map();
          this.PRIORITIES = {
            "instance-event": 100,
            // Highest: Direct user interaction
            "redfin-redux-sub": 90,
            // High: Real-time subscription
            "redfin-api": 85,
            // High: API response is very fresh
            "instance-capture": 80,
            // Medium: Extracted from active map instance
            "redfin-redux": 50,
            // Low: Polled state (might be slightly stale)
            "redfin-global": 40,
            // Lower: Polled global variable (often stale)
            "network-url": 20,
            // Lowest: One-off network sniff
            "network-body": 20
          };
        }
        /**
         * @override
         * Called during initialization
         */
        async onInitialize() {
          this.setupMessageListeners();
          this.log("PortalManager initialized");
        }
        /**
         * @override
         * Cleanup resources
         */
        cleanup() {
          this.messageHandlers.clear();
          this.initialized = false;
          this.log("PortalManager cleaned up");
        }
        /**
         * Sets up message listeners
         * @private
         */
        setupMessageListeners() {
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
            if (!b)
              return null;
            if (b.getNorthEast) {
              return {
                north: b.getNorthEast().lat(),
                south: b.getSouthWest().lat(),
                east: b.getNorthEast().lng(),
                west: b.getSouthWest().lng()
              };
            }
            if (b.getNorth) {
              return {
                north: b.getNorth(),
                south: b.getSouth(),
                east: b.getEast(),
                west: b.getWest()
              };
            }
          } catch (e) {
          }
          return null;
        }
        /**
         * Filters POIs by priority within given bounds
         * @param {Array} pois - Array of POIs
         * @param {Object} bounds - Bounds to filter by
         * @returns {Array} Filtered POIs
         */
        filterByPriority(pois, bounds) {
          if (!bounds || !pois)
            return pois;
          return pois.filter((poi) => {
            const lat = parseFloat(poi.latitude);
            const lng = parseFloat(poi.longitude);
            return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
          });
        }
        /**
         * Sends a message to the content script
         * @param {string} type - Message type
         * @param {Object} data - Message data
         */
        notifyContentScript(type, data) {
          window.postMessage({ type, ...data }, "*");
        }
        /**
         * Updates bounds with priority checking
         * @param {Object} bounds - Bounds object
         * @param {string} method - Source method name
         */
        update(bounds, method) {
          if (!bounds || typeof bounds.north !== "number" || isNaN(bounds.north))
            return;
          const priority = this.PRIORITIES[method] || 30;
          const now = Date.now();
          if (this.lastPriority >= 80 && priority < 80) {
            if (now - this.lastUpdateTime < 5e3)
              return;
            this.lastPriority = 0;
          }
          if (priority <= 50 && this.lastPriority > 50 && now - this.lastUpdateTime < 500) {
            return;
          }
          const rounded = {
            north: parseFloat(bounds.north.toFixed(6)),
            south: parseFloat(bounds.south.toFixed(6)),
            east: parseFloat(bounds.east.toFixed(6)),
            west: parseFloat(bounds.west.toFixed(6))
          };
          const json = JSON.stringify(rounded);
          if (priority >= this.lastPriority) {
            this.lastPriority = priority;
            this.lastUpdateTime = now;
          }
          if (json === this.lastBounds)
            return;
          this.lastBounds = json;
          const timestamp = now.toString();
          document.documentElement.setAttribute("data-poi-bounds", json);
          document.documentElement.setAttribute("data-poi-map-type", method);
          document.documentElement.setAttribute("data-poi-timestamp", timestamp);
          const payload = {
            type: "POI_BOUNDS_UPDATE",
            bounds: rounded,
            method,
            url: window.location.href,
            isIframe: window.self !== window.top,
            timestamp
          };
          window.postMessage(payload, "*");
          if (window.self !== window.top)
            window.parent.postMessage(payload, "*");
        }
      };
      var portalManager = new PortalManager();
      window.poiPortal = portalManager;
      if (typeof module !== "undefined" && module.exports) {
        module.exports = PortalManager;
      }
    }
  });

  // overlays/ZillowOverlay.js
  var require_ZillowOverlay = __commonJS({
    "overlays/ZillowOverlay.js"(exports, module) {
      var ZillowOverlay = class extends MapboxOverlayBase {
        constructor(debug = false) {
          super(debug);
          this.siteId = "zillow";
        }
        /**
         * @override
         * Detects the Zillow map container
         * @returns {HTMLElement|null} The map container element
         */
        detect() {
          const selectors = [
            ".mapboxgl-map",
            "#search-page-map",
            '[data-testid="map"]',
            ".map-container",
            "#map"
          ];
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
              this.log("Detected Zillow map container:", selector);
              this.container = el;
              return el;
            }
          }
          return null;
        }
        /**
         * @override
         * Gets the z-index for markers (higher for Zillow to ensure visibility)
         * @returns {number} The z-index value
         */
        getMarkerZIndex() {
          return 10;
        }
        /**
         * @override
         * Creates a marker element with Zillow-specific styling
         * @param {Object} poi - POI object
         * @returns {HTMLElement} The marker element
         */
        createMarkerElement(poi) {
          const el = super.createMarkerElement(poi);
          el.style.zIndex = "10";
          return el;
        }
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = ZillowOverlay;
      } else if (typeof window !== "undefined") {
        window.ZillowOverlay = ZillowOverlay;
      }
    }
  });

  // overlays/RedfinOverlay.js
  var require_RedfinOverlay = __commonJS({
    "overlays/RedfinOverlay.js"(exports, module) {
      var RedfinOverlay = class extends GoogleMapsOverlayBase {
        constructor(debug = false) {
          super(debug);
          this.siteId = "redfin";
          this.reduxStore = null;
          this.reduxUnsubscribe = null;
          this._storeSubscribed = false;
        }
        /**
         * @override
         * Gets the CSS selector for Redfin native markers
         * @returns {string} CSS selector for Redfin pushpins
         * @protected
         */
        _getNativeMarkerSelector() {
          return '.Pushpin.homePushpin, [data-rf-test-id^="home-marker"]';
        }
        /**
         * @override
         * Checks if Redfin has already placed a native marker for this POI
         * @param {Object} poi - POI object
         * @returns {boolean} True if Redfin native marker exists
         */
        _hasSiteNativeMarker(poi) {
          if (typeof this._hasLoggedRedfinMarker === "undefined") {
            this._hasLoggedRedfinMarker = false;
          }
          const lat = String(poi.latitude).trim();
          const lng = String(poi.longitude).trim();
          let selector = `.Pushpin.homePushpin[data-latitude="${lat}"][data-longitude="${lng}"]`;
          let found = !!document.querySelector(selector);
          if (!found) {
            const pushpins = document.querySelectorAll(".Pushpin.homePushpin");
            for (const pin of pushpins) {
              const pinLat = pin.getAttribute("data-latitude");
              const pinLng = pin.getAttribute("data-longitude");
              if (pinLat && pinLng) {
                const latDiff = Math.abs(parseFloat(lat) - parseFloat(pinLat));
                const lngDiff = Math.abs(parseFloat(lng) - parseFloat(pinLng));
                if (latDiff < 1e-5 && lngDiff < 1e-5) {
                  found = true;
                  break;
                }
              }
            }
          }
          if (found && !this._hasLoggedRedfinMarker) {
            this.log("Redfin native marker detected");
            this._hasLoggedRedfinMarker = true;
          }
          return found;
        }
        /**
         * @override
         * Detects the Redfin map container
         * @returns {HTMLElement|null} The map container element
         */
        detect() {
          const selectors = [
            ".gm-style",
            '[data-rf-test-id="map"]',
            "#map-container",
            ".MapContainer",
            ".HomeViews"
          ];
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
              this.log("Detected Redfin map container:", selector);
              this.container = el;
              return el;
            }
          }
          return null;
        }
        /**
         * @override
         * Hijacks the map and sets up Redfin-specific subscriptions
         * @param {Object} mapInstance - The map instance
         * @returns {boolean} Success
         */
        hijack(mapInstance) {
          const result = super.hijack(mapInstance);
          if (result) {
            this.subscribeToStore();
          }
          return result;
        }
        /**
         * Subscribes to Redfin's Redux store for real-time bounds updates
         */
        subscribeToStore() {
          if (this._storeSubscribed)
            return;
          try {
            let store = window.App?.store || window.redfin?.context?.store;
            if (!store) {
              const root = document.getElementById("root") || document.querySelector("#content");
              if (root) {
                const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"));
                if (key && root[key]) {
                  let fiber = root[key];
                  while (fiber && !store) {
                    if (fiber.stateNode && fiber.stateNode.store)
                      store = fiber.stateNode.store;
                    else if (fiber.memoizedProps && fiber.memoizedProps.store)
                      store = fiber.memoizedProps.store;
                    fiber = fiber.child || fiber.return;
                  }
                }
              }
            }
            if (store) {
              this.reduxStore = store;
              const s = store.getState();
              if (s?.map?.viewport?.bounds) {
                window.poiPortal.update(s.map.viewport.bounds, "redfin-redux");
              }
              if (typeof store.subscribe === "function") {
                let lastBounds = store.getState()?.map?.viewport?.bounds;
                this.reduxUnsubscribe = store.subscribe(() => {
                  const ns = store.getState();
                  const newBounds = ns?.map?.viewport?.bounds;
                  if (newBounds && newBounds !== lastBounds) {
                    lastBounds = newBounds;
                    window.poiPortal.update(newBounds, "redfin-redux-sub");
                  }
                });
                this._storeSubscribed = true;
                this.log("Subscribed to Redux store");
              }
            }
          } catch (e) {
            this.log("Failed to subscribe to Redux store:", e);
          }
        }
        /**
         * Extracts bounds from global variables (RF_CONTEXT, __map_bounds__)
         * @returns {Object|null} Bounds object or null
         */
        extractGlobalBounds() {
          try {
            if (window.__map_bounds__ && window.poiPortal.lastPriority < 80) {
              const b = window.__map_bounds__;
              const keys = Object.keys(b).filter((k) => b[k] && typeof b[k].lo === "number" && typeof b[k].hi === "number");
              if (keys.length >= 2) {
                const b1 = b[keys[0]];
                const b2 = b[keys[1]];
                let latB, lngB;
                if (b1.lo < 0 || Math.abs(b1.lo) > Math.abs(b2.lo)) {
                  lngB = b1;
                  latB = b2;
                } else {
                  lngB = b2;
                  latB = b1;
                }
                return {
                  north: latB.hi,
                  south: latB.lo,
                  east: lngB.hi,
                  west: lngB.lo
                };
              }
            }
          } catch (e) {
            this.log("Failed to extract global bounds:", e);
          }
          return null;
        }
        /**
         * Parses Redfin API response for bounds data
         * @param {Object} data - Parsed JSON response
         * @returns {Object|null} Bounds object or null
         */
        parseNetworkBounds(data) {
          try {
            if (data?.payload?.viewport)
              return data.payload.viewport;
            if (data?.payload?.bounds)
              return data.payload.bounds;
          } catch (e) {
            this.log("Failed to parse network bounds:", e);
          }
          return null;
        }
        /**
         * Runs Redfin-specific discovery (global bounds extraction)
         * This should be called periodically to supplement Redux subscription
         */
        runDiscovery() {
          const bounds = this.extractGlobalBounds();
          if (bounds) {
            window.poiPortal.update(bounds, "redfin-global");
          }
        }
        /**
         * @override
         * Cleanup resources
         */
        cleanup() {
          if (this.reduxUnsubscribe) {
            try {
              this.reduxUnsubscribe();
            } catch (e) {
            }
            this.reduxUnsubscribe = null;
          }
          this.reduxStore = null;
          this._storeSubscribed = false;
          super.cleanup();
        }
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = RedfinOverlay;
      } else if (typeof window !== "undefined") {
        window.RedfinOverlay = RedfinOverlay;
      }
    }
  });

  // overlays/HomesComOverlay.js
  var require_HomesComOverlay = __commonJS({
    "overlays/HomesComOverlay.js"(exports, module) {
      var HomesComOverlay = class extends GoogleMapsOverlayBase {
        constructor(debug = false) {
          super(debug);
          this.siteId = "homes.com";
        }
        /**
         * @override
         * Gets the CSS selector for Homes.com/Apartments.com native markers
         * @returns {string} CSS selector for custom markers
         * @protected
         */
        _getNativeMarkerSelector() {
          return ".custom-marker.gmaps-adv-marker";
        }
        /**
         * @override
         * Checks if Homes.com has already placed a native marker for this POI
         * @param {Object} poi - POI object
         * @returns {boolean} True if Homes.com native marker exists
         */
        _hasSiteNativeMarker(poi) {
          if (typeof this._hasLoggedHomesMarker === "undefined") {
            this._hasLoggedHomesMarker = false;
          }
          const lat = String(poi.latitude).trim();
          const lng = String(poi.longitude).trim();
          const coord = `${lat},${lng}`;
          let selector = `.custom-marker.gmaps-adv-marker[data-cuscor="${coord}"]`;
          let found = !!document.querySelector(selector);
          if (!found) {
            const markers = document.querySelectorAll(".custom-marker.gmaps-adv-marker");
            for (const marker of markers) {
              const cuscor = marker.getAttribute("data-cuscor");
              if (cuscor) {
                const [markerLat, markerLng] = cuscor.split(",").map((s) => parseFloat(s.trim()));
                const latDiff = Math.abs(parseFloat(lat) - markerLat);
                const lngDiff = Math.abs(parseFloat(lng) - markerLng);
                if (latDiff < 1e-5 && lngDiff < 1e-5) {
                  found = true;
                  break;
                }
              }
            }
          }
          if (found && !this._hasLoggedHomesMarker) {
            this.log("Homes.com native marker detected");
            this._hasLoggedHomesMarker = true;
          }
          return found;
        }
        /**
         * Finds elements matching selector within Shadow DOM
         * @param {Node} root - Root node to search from
         * @param {string} selector - CSS selector
         * @param {Array} found - Accumulator array
         * @returns {Array} Found elements
         * @private
         */
        _findInShadow(root, selector, found = []) {
          if (!root)
            return found;
          try {
            const elements = root.querySelectorAll(selector);
            elements.forEach((el) => found.push(el));
            const all = root.querySelectorAll("*");
            for (const s of all) {
              if (s.shadowRoot) {
                if (s.tagName.includes("ICON") || s.tagName.includes("BUTTON"))
                  continue;
                this._findInShadow(s.shadowRoot, selector, found);
              }
            }
          } catch (e) {
          }
          return found;
        }
        /**
         * Checks if a native marker for this POI exists in the DOM
         * Uses base class implementation
         */
        _hasNativeMarker(poi) {
          return super._hasNativeMarker(poi);
        }
        /**
         * @override
         * Detects the Homes.com map container, including Shadow DOM
         * @returns {HTMLElement|null} The map container element
         */
        detect() {
          const selectors = [
            ".gm-style",
            "#map-container",
            ".map-container",
            "gmp-map"
          ];
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
              this.log("Detected Homes.com map container:", selector);
              this.container = el;
              return el;
            }
          }
          const shadowElements = this._findInShadow(document, "gmp-map, gmp-advanced-marker, .gm-style");
          if (shadowElements.length > 0) {
            const el = shadowElements[0];
            this.log("Detected Homes.com map in Shadow DOM");
            this.container = el;
            return el;
          }
          return null;
        }
        /**
         * @override
         * Hijacks the map, handling Web Component maps
         * @param {Object} mapInstance - The map instance
         * @returns {boolean} Success
         */
        hijack(mapInstance) {
          if (mapInstance && !mapInstance.getBounds && mapInstance.map) {
            mapInstance = mapInstance.map;
          }
          if (mapInstance && !mapInstance.getBounds && mapInstance.innerMap) {
            mapInstance = mapInstance.innerMap;
          }
          if (mapInstance && !mapInstance.getBounds && typeof mapInstance.getMap === "function") {
            mapInstance = mapInstance.getMap();
          }
          return super.hijack(mapInstance);
        }
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = HomesComOverlay;
      } else if (typeof window !== "undefined") {
        window.HomesComOverlay = HomesComOverlay;
      }
    }
  });

  // overlays/OneKeyOverlay.js
  var require_OneKeyOverlay = __commonJS({
    "overlays/OneKeyOverlay.js"(exports, module) {
      var OneKeyOverlay = class extends MapboxOverlayBase {
        constructor(debug = false) {
          super(debug);
          this.siteId = "onekey";
        }
        /**
         * @override
         * Detects the OneKey map container
         * @returns {HTMLElement|null} The map container element
         */
        detect() {
          const selectors = [
            ".mapboxgl-map",
            "#map",
            ".map-container",
            '[class*="MapContainer"]'
          ];
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
              this.log("Detected OneKey map container:", selector);
              this.container = el;
              this._findPopupParent();
              return el;
            }
          }
          return null;
        }
        /**
         * Finds the popup parent element for stacking context
         * @private
         */
        _findPopupParent() {
          const popupParent = document.querySelector('.mapboxgl-popup-content, [class*="PropertyCard"], [class*="popup"]');
          if (popupParent) {
            this.log("Found popup parent for stacking context");
          }
        }
        /**
         * @override
         * Gets the z-index for markers (10 to stack below popups)
         * @returns {number} The z-index value
         */
        getMarkerZIndex() {
          return 10;
        }
        /**
         * @override
         * Creates a marker element with OneKey-specific styling
         * @param {Object} poi - POI object
         * @returns {HTMLElement} The marker element
         */
        createMarkerElement(poi) {
          const el = super.createMarkerElement(poi);
          el.style.position = "relative";
          el.style.zIndex = "10";
          return el;
        }
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = OneKeyOverlay;
      } else if (typeof window !== "undefined") {
        window.OneKeyOverlay = OneKeyOverlay;
      }
    }
  });

  // overlays/RealtorOverlay.js
  var require_RealtorOverlay = __commonJS({
    "overlays/RealtorOverlay.js"(exports, module) {
      var RealtorOverlay = class extends MapOverlayBase {
        constructor(debug = false) {
          super(debug);
          this.siteId = "realtor";
          this.detectedMapType = null;
          this.activeMarkers = /* @__PURE__ */ new Map();
          this.markerPool = new MarkerPool();
          this.activeElements = /* @__PURE__ */ new Map();
          this._nativeMarkersInjected = false;
          this._nativeMarkerObserver = null;
          this._nativeMarkerPollInterval = null;
          this._startNativeMarkerObserver();
          this._startNativeMarkerPolling();
        }
        /**
         * Gets the CSS selector for native markers
         * @returns {string} CSS selector for extension-injected native markers
         * @protected
         */
        _getNativeMarkerSelector() {
          return ".poi-native-marker, .poi-native-marker-mapbox, .poi-native-marker-realtor";
        }
        /**
         * Sets up a MutationObserver to watch for native marker insertion
         * @private
         */
        _startNativeMarkerObserver() {
          if (typeof window === "undefined" || typeof document === "undefined")
            return;
          if (this._nativeMarkerObserver)
            return;
          const callback = (mutationsList) => {
            if (this._nativeMarkersInjected)
              return;
            const selector = this._getNativeMarkerSelector();
            if (selector && document.querySelector(selector)) {
              this._nativeMarkersInjected = true;
              this.log("Native marker detected by MutationObserver, clearing overlay markers");
              this.clear();
            }
          };
          this._nativeMarkerObserver = new MutationObserver(callback);
          this._nativeMarkerObserver.observe(document.body, { childList: true, subtree: true });
        }
        /**
         * Stops the MutationObserver
         * @private
         */
        _stopNativeMarkerObserver() {
          if (this._nativeMarkerObserver) {
            this._nativeMarkerObserver.disconnect();
            this._nativeMarkerObserver = null;
          }
        }
        /**
         * Starts periodic polling to check if native markers have appeared
         * @private
         */
        _startNativeMarkerPolling() {
          if (typeof window === "undefined" || typeof document === "undefined")
            return;
          if (this._nativeMarkerPollInterval)
            return;
          this.log("Starting native marker polling (250ms)...");
          let lastDetectedCount = 0;
          this._nativeMarkerPollInterval = setInterval(() => {
            try {
              if (this._nativeMarkersInjected) {
                this._stopNativeMarkerPolling();
                return;
              }
              const selector = this._getNativeMarkerSelector();
              if (!selector)
                return;
              const nativeMarkers = document.querySelectorAll(selector);
              const count = nativeMarkers.length;
              if (count > 0 && lastDetectedCount === 0) {
                this._nativeMarkersInjected = true;
                this.log(`Native markers detected by polling (${count} found), immediately clearing overlay`);
                this.clear();
                this._stopNativeMarkerPolling();
              }
              lastDetectedCount = count;
            } catch (e) {
              this.log("Error during native marker polling:", e);
            }
          }, 250);
        }
        /**
         * Stops the periodic polling
         * @private
         */
        _stopNativeMarkerPolling() {
          if (this._nativeMarkerPollInterval) {
            clearInterval(this._nativeMarkerPollInterval);
            this._nativeMarkerPollInterval = null;
          }
        }
        /**
         * Finds elements matching selector within Shadow DOM
         * @param {Node} root - Root node to search from
         * @param {string} selector - CSS selector
         * @param {Array} found - Accumulator array
         * @returns {Array} Found elements
         * @private
         */
        _findInShadow(root, selector, found = []) {
          if (!root)
            return found;
          try {
            const elements = root.querySelectorAll(selector);
            elements.forEach((el) => found.push(el));
            const all = root.querySelectorAll("*");
            for (const s of all) {
              if (s.shadowRoot) {
                if (s.tagName.includes("ICON") || s.tagName.includes("BUTTON"))
                  continue;
                this._findInShadow(s.shadowRoot, selector, found);
              }
            }
          } catch (e) {
          }
          return found;
        }
        /**
         * @override
         * Detects the Realtor.com map container
         * @returns {HTMLElement|null} The map container element
         */
        detect() {
          const selectors = [
            ".mapboxgl-map",
            ".gm-style",
            "gmp-map",
            "#map-container",
            '[data-testid="map"]',
            ".map-container",
            "#mapboxgl-map"
          ];
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
              this.log("Detected Realtor map container:", selector);
              this.container = el;
              if (selector.includes("mapbox")) {
                this.detectedMapType = "mapbox";
              } else if (selector.includes("gm-style") || selector.includes("gmp-")) {
                this.detectedMapType = "google";
              }
              return el;
            }
          }
          const shadowElements = this._findInShadow(document, "gmp-map, .gm-style, .mapboxgl-map");
          if (shadowElements.length > 0) {
            const el = shadowElements[0];
            this.log("Detected Realtor map in Shadow DOM");
            this.container = el;
            return el;
          }
          return null;
        }
        /**
         * @override
         * Checks if the given map instance is compatible
         * @param {Object} mapInstance - The map instance to check
         * @returns {boolean} True if compatible
         */
        isCompatibleMap(mapInstance) {
          if (MapTypeDetector.isGoogleMap(mapInstance)) {
            this.detectedMapType = "google";
            return true;
          }
          if (MapTypeDetector.isMapbox(mapInstance)) {
            this.detectedMapType = "mapbox";
            return true;
          }
          return false;
        }
        /**
         * Checks if a native marker for this POI exists in the DOM
         * Uses base class implementation which looks for any poi-native-marker class
         * @param {Object} poi - POI object
         * @returns {boolean} True if native marker exists
         */
        _hasNativeMarker(poi) {
          return super._hasNativeMarker(poi);
        }
        /**
         * @override
         * Renders markers, delegating to the appropriate renderer
         * @param {Array} pois - Array of POI objects
         * @param {Object} mapInstance - The map instance
         */
        renderMarkers(pois, mapInstance) {
          if (this._nativeMarkersInjected) {
            this.log("Native markers injected (flag set), skipping overlay render");
            return;
          }
          if (pois && pois.length > 0) {
            const selector = this._getNativeMarkerSelector();
            if (selector) {
              const nativeMarkers = document.querySelectorAll(selector);
              if (nativeMarkers.length > 0) {
                this._nativeMarkersInjected = true;
                this.log("Native markers detected at render time, clearing overlay");
                this.clear();
                return;
              }
            }
          }
          if (typeof window !== "undefined" && window.poiState && window.poiState.nativeMode) {
            this.log("Native mode active, clearing overlay markers");
            this.clear();
            return;
          }
          if (!mapInstance) {
            this.log("No map instance provided");
            return;
          }
          if (!this.detectedMapType) {
            if (MapTypeDetector.isGoogleMap(mapInstance)) {
              this.detectedMapType = "google";
            } else if (MapTypeDetector.isMapbox(mapInstance)) {
              this.detectedMapType = "mapbox";
            } else {
              this.log("Unknown map type, cannot render");
              return;
            }
          }
          const filteredPois = this._filterNativePois(pois);
          if (this.detectedMapType === "google") {
            this._renderGoogleMarkers(filteredPois, mapInstance);
          } else if (this.detectedMapType === "mapbox") {
            this._renderMapboxMarkers(filteredPois, mapInstance);
          }
        }
        /**
         * Renders markers on Google Maps
         * @private
         */
        _renderGoogleMarkers(pois, mapInstance) {
          if (!window.google || !window.google.maps) {
            this.log("Google Maps API not available");
            return;
          }
          if (!mapInstance._poiBatchLayer && window.PoiBatchOverlay) {
            mapInstance._poiBatchLayer = new window.PoiBatchOverlay(mapInstance);
            mapInstance._poiBatchLayer.setMap(mapInstance);
          }
          if (mapInstance._poiBatchLayer) {
            mapInstance._poiBatchLayer.updatePois(pois);
            this.log(`Rendered ${pois.length} Google markers`);
          }
        }
        /**
         * Renders markers on Mapbox
         * @private
         */
        _renderMapboxMarkers(pois, mapInstance) {
          if (!window.mapboxgl || !window.mapboxgl.Marker) {
            this.log("Mapbox GL JS not available");
            return;
          }
          if (!mapInstance._poiUid) {
            mapInstance._poiUid = Math.random().toString(36).substr(2, 9);
          }
          const usedIds = /* @__PURE__ */ new Set();
          pois.forEach((poi) => {
            const id = `${mapInstance._poiUid}-${MapUtils.getPoiId(poi)}`;
            usedIds.add(id);
            if (this.activeMarkers.has(id))
              return;
            const el = this.createMarker(poi, mapInstance);
            const marker = new window.mapboxgl.Marker({ element: el }).setLngLat([parseFloat(poi.longitude), parseFloat(poi.latitude)]).addTo(mapInstance);
            this.activeMarkers.set(id, marker);
          });
          this.activeMarkers.forEach((marker, id) => {
            if (id.startsWith(mapInstance._poiUid) && !usedIds.has(id)) {
              marker.remove();
              this.activeMarkers.delete(id);
            }
          });
          this.log(`Rendered ${pois.length} Mapbox markers`);
        }
        /**
         * @override
         * Creates a marker element
         * @param {Object} poi - POI object
         * @param {Object} map - Map instance
         * @returns {HTMLElement} The marker element
         */
        createMarker(poi, map) {
          const el = document.createElement("div");
          el.className = "poi-native-marker-realtor";
          const color = poi.color || "#ff0000";
          const secondaryColor = poi.secondaryColor || "#ffffff";
          const logo = poi.logoData;
          const fallbackSvg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);
          el.style.cssText = `
      width: 32px;
      height: 32px;
      cursor: pointer;
      position: relative;
      z-index: 10;
      background-image: url('${logo || fallbackSvg}');
      background-size: contain;
      background-repeat: no-repeat;
      filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
    `;
          el.setAttribute("data-id", MapUtils.getPoiId(poi));
          el.setAttribute("data-lat", poi.latitude);
          el.setAttribute("data-lng", poi.longitude);
          el.onclick = (e) => {
            e.stopPropagation();
            window.postMessage({
              type: "POI_MARKER_CLICK",
              id: poi.id,
              lat: poi.latitude,
              lng: poi.longitude
            }, "*");
          };
          el.onmouseenter = () => {
            el.style.zIndex = "1000000";
            window.postMessage({
              type: "POI_MARKER_HOVER",
              id: poi.id,
              lat: poi.latitude,
              lng: poi.longitude
            }, "*");
          };
          el.onmouseleave = () => {
            el.style.zIndex = "10";
            window.postMessage({
              type: "POI_MARKER_LEAVE",
              id: poi.id
            }, "*");
          };
          return el;
        }
        /**
         * @override
         * Clears all markers
         */
        clear() {
          this.activeMarkers.forEach((marker) => {
            marker.remove();
          });
          this.activeMarkers.clear();
          this.activeElements.forEach((el) => {
            this.markerPool.release(el);
          });
          this.activeElements.clear();
          super.clear();
        }
        /**
         * @override
         * Cleanup resources
         */
        cleanup() {
          this._stopNativeMarkerPolling();
          this._stopNativeMarkerObserver();
          this.clear();
          this.markerPool.clear();
          this.detectedMapType = null;
          super.cleanup();
        }
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = RealtorOverlay;
      } else if (typeof window !== "undefined") {
        window.RealtorOverlay = RealtorOverlay;
      }
    }
  });

  // overlays/GenericMapOverlay.js
  var require_GenericMapOverlay = __commonJS({
    "overlays/GenericMapOverlay.js"(exports, module) {
      var GenericMapOverlay = class extends MapOverlayBase {
        constructor(debug = false) {
          super(debug);
          this.siteId = "generic";
          this.detectedMapType = null;
          this.markerPool = new MarkerPool();
          this.activeElements = /* @__PURE__ */ new Map();
          this.batchOverlay = null;
          this.activeMarkers = /* @__PURE__ */ new Map();
          this._hasLoggedGoogleMarkers = false;
          this._hasLoggedMapboxMarkers = false;
          this._nativeMarkersInjected = false;
          this._nativeMarkerObserver = null;
          this._nativeMarkerPollInterval = null;
          this._startNativeMarkerObserver();
          this._startNativeMarkerPolling();
        }
        /**
         * Gets the CSS selector for native markers
         * @returns {string} CSS selector for extension-injected native markers
         * @protected
         */
        _getNativeMarkerSelector() {
          return ".poi-native-marker, .poi-native-marker-mapbox, .poi-native-marker-generic";
        }
        /**
         * Sets up a MutationObserver to watch for native marker insertion
         * @private
         */
        _startNativeMarkerObserver() {
          if (typeof window === "undefined" || typeof document === "undefined")
            return;
          if (this._nativeMarkerObserver)
            return;
          const callback = (mutationsList) => {
            if (this._nativeMarkersInjected)
              return;
            const selector = this._getNativeMarkerSelector();
            if (selector && document.querySelector(selector)) {
              this._nativeMarkersInjected = true;
              this.log("Native marker detected by MutationObserver, clearing overlay markers");
              this.clear();
            }
          };
          this._nativeMarkerObserver = new MutationObserver(callback);
          this._nativeMarkerObserver.observe(document.body, { childList: true, subtree: true });
        }
        /**
         * Stops the MutationObserver
         * @private
         */
        _stopNativeMarkerObserver() {
          if (this._nativeMarkerObserver) {
            this._nativeMarkerObserver.disconnect();
            this._nativeMarkerObserver = null;
          }
        }
        /**
         * Starts periodic polling to check if native markers have appeared
         * @private
         */
        _startNativeMarkerPolling() {
          if (typeof window === "undefined" || typeof document === "undefined")
            return;
          if (this._nativeMarkerPollInterval)
            return;
          this.log("Starting native marker polling (250ms)...");
          let lastDetectedCount = 0;
          this._nativeMarkerPollInterval = setInterval(() => {
            try {
              if (this._nativeMarkersInjected) {
                this._stopNativeMarkerPolling();
                return;
              }
              const selector = this._getNativeMarkerSelector();
              if (!selector)
                return;
              const nativeMarkers = document.querySelectorAll(selector);
              const count = nativeMarkers.length;
              if (count > 0 && lastDetectedCount === 0) {
                this._nativeMarkersInjected = true;
                this.log(`Native markers detected by polling (${count} found), immediately clearing overlay`);
                this.clear();
                this._stopNativeMarkerPolling();
              }
              lastDetectedCount = count;
            } catch (e) {
              this.log("Error during native marker polling:", e);
            }
          }, 250);
        }
        /**
         * Stops the periodic polling
         * @private
         */
        _stopNativeMarkerPolling() {
          if (this._nativeMarkerPollInterval) {
            clearInterval(this._nativeMarkerPollInterval);
            this._nativeMarkerPollInterval = null;
          }
        }
        /**
         * @override
         * Detects map container using multiple fallback strategies
         * @returns {HTMLElement|null} The map container element
         */
        detect() {
          const selectors = [
            ".gm-style",
            // Google Maps
            ".mapboxgl-map",
            // Mapbox GL JS
            ".leaflet-container",
            // Leaflet
            "canvas",
            // Canvas-based maps
            "#map-container",
            // Common ID
            ".map-container",
            // Common class
            '[data-rf-test-id="map"]',
            // Redfin specific
            'div[class*="Map"]',
            // Generic Map class
            'div[class*="map"]'
            // Generic map class (lowercase)
          ];
          for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
              this.log("Detected generic map container:", selector);
              this.container = el;
              return el;
            }
          }
          return null;
        }
        /**
         * @override
         * Checks if the given map instance is compatible (Google or Mapbox)
         * @param {Object} mapInstance - The map instance to check
         * @returns {boolean} True if compatible
         */
        isCompatibleMap(mapInstance) {
          if (MapTypeDetector.isGoogleMap(mapInstance)) {
            this.detectedMapType = "google";
            return true;
          }
          if (MapTypeDetector.isMapbox(mapInstance)) {
            this.detectedMapType = "mapbox";
            return true;
          }
          return false;
        }
        /**
         * @override
         * Renders markers for generic overlays
         * @param {Array} pois - Array of POI objects
         * @param {Object} mapInstance - The map instance
         */
        renderMarkers(pois, mapInstance) {
          if (this._nativeMarkersInjected) {
            this.log("Native markers injected (flag set), skipping overlay render");
            return;
          }
          if (pois && pois.length > 0) {
            const selector = this._getNativeMarkerSelector();
            if (selector) {
              const nativeMarkers = document.querySelectorAll(selector);
              if (nativeMarkers.length > 0) {
                this._nativeMarkersInjected = true;
                this.log("Native markers detected at render time, clearing overlay");
                this.clear();
                return;
              }
            }
          }
          if (typeof window !== "undefined" && window.poiState && window.poiState.nativeMode) {
            this.log("Native mode active, clearing overlay markers");
            this.clear();
            return;
          }
          const filteredPois = this._filterNativePois(pois);
          if (!mapInstance) {
            this.log("No map instance provided");
            return;
          }
          if (!this.detectedMapType) {
            if (MapTypeDetector.isGoogleMap(mapInstance)) {
              this.detectedMapType = "google";
            } else if (MapTypeDetector.isMapbox(mapInstance)) {
              this.detectedMapType = "mapbox";
            } else {
              this.log("Unknown map type, cannot render");
              return;
            }
          }
          if (this.detectedMapType === "google") {
            this._renderGoogleMarkers(filteredPois, mapInstance);
          } else if (this.detectedMapType === "mapbox") {
            this._renderMapboxMarkers(filteredPois, mapInstance);
          }
        }
        /**
         * Renders markers on Google Maps
         * @param {Array} pois - Array of POI objects
         * @param {Object} mapInstance - Google Maps instance
         * @private
         */
        _renderGoogleMarkers(pois, mapInstance) {
          if (!window.google || !window.google.maps || !window.google.maps.OverlayView) {
            if (!this._hasLoggedGoogleMarkers) {
              this.log("Google Maps API not available");
              this._hasLoggedGoogleMarkers = true;
            }
            return;
          }
          if (!mapInstance._poiBatchLayer && window.PoiBatchOverlay) {
            mapInstance._poiBatchLayer = new window.PoiBatchOverlay(mapInstance);
            mapInstance._poiBatchLayer.setMap(mapInstance);
          }
          if (mapInstance._poiBatchLayer) {
            mapInstance._poiBatchLayer.updatePois(pois);
            if (pois.length > 0) {
              if (!this._hasLoggedGoogleMarkers) {
                this.log(`Rendered ${pois.length} Google markers`);
                this._hasLoggedGoogleMarkers = true;
              }
            } else {
              this._hasLoggedGoogleMarkers = false;
            }
          }
        }
        /**
         * Renders markers on Mapbox
         * @param {Array} pois - Array of POI objects
         * @param {Object} mapInstance - Mapbox instance
         * @private
         */
        _renderMapboxMarkers(pois, mapInstance) {
          if (!window.mapboxgl || !window.mapboxgl.Marker) {
            if (!this._hasLoggedMapboxMarkers) {
              this.log("Mapbox GL JS not available");
              this._hasLoggedMapboxMarkers = true;
            }
            return;
          }
          if (!mapInstance._poiUid) {
            mapInstance._poiUid = Math.random().toString(36).substr(2, 9);
          }
          const usedIds = /* @__PURE__ */ new Set();
          pois.forEach((poi) => {
            const id = `${mapInstance._poiUid}-${MapUtils.getPoiId(poi)}`;
            usedIds.add(id);
            if (this.activeMarkers.has(id))
              return;
            const el = this.createMarker(poi, mapInstance);
            const marker = new window.mapboxgl.Marker({ element: el }).setLngLat([parseFloat(poi.longitude), parseFloat(poi.latitude)]).addTo(mapInstance);
            this.activeMarkers.set(id, marker);
          });
          this.activeMarkers.forEach((marker, id) => {
            if (id.startsWith(mapInstance._poiUid) && !usedIds.has(id)) {
              marker.remove();
              this.activeMarkers.delete(id);
            }
          });
          if (pois.length > 0) {
            if (!this._hasLoggedMapboxMarkers) {
              this.log(`Rendered ${pois.length} Mapbox markers`);
              this._hasLoggedMapboxMarkers = true;
            }
          } else {
            this._hasLoggedMapboxMarkers = false;
          }
        }
        /**
         * @override
         * Creates a marker element
         * @param {Object} poi - POI object
         * @param {Object} map - Map instance
         * @returns {HTMLElement} The marker element
         */
        createMarker(poi, map) {
          const el = document.createElement("div");
          el.className = "poi-native-marker-generic";
          const color = poi.color || "#ff0000";
          const secondaryColor = poi.secondaryColor || "#ffffff";
          const logo = poi.logoData;
          const fallbackSvg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);
          el.style.cssText = `
      width: 32px;
      height: 32px;
      cursor: pointer;
      position: relative;
      z-index: 10;
      background-image: url('${logo || fallbackSvg}');
      background-size: contain;
      background-repeat: no-repeat;
      filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
    `;
          el.setAttribute("data-id", MapUtils.getPoiId(poi));
          el.setAttribute("data-lat", poi.latitude);
          el.setAttribute("data-lng", poi.longitude);
          el.onclick = (e) => {
            e.stopPropagation();
            window.postMessage({
              type: "POI_MARKER_CLICK",
              id: poi.id,
              lat: poi.latitude,
              lng: poi.longitude
            }, "*");
          };
          el.onmouseenter = () => {
            el.style.zIndex = "1000000";
            window.postMessage({
              type: "POI_MARKER_HOVER",
              id: poi.id,
              lat: poi.latitude,
              lng: poi.longitude
            }, "*");
          };
          el.onmouseleave = () => {
            el.style.zIndex = "10";
            window.postMessage({
              type: "POI_MARKER_LEAVE",
              id: poi.id
            }, "*");
          };
          return el;
        }
        /**
         * @override
         * Clears all markers
         */
        clear() {
          this.activeMarkers.forEach((marker, id) => {
            marker.remove();
          });
          this.activeMarkers.clear();
          this.activeElements.forEach((el, id) => {
            this.markerPool.release(el);
          });
          this.activeElements.clear();
          super.clear();
        }
        /**
         * @override
         * Cleanup resources
         */
        cleanup() {
          this._stopNativeMarkerPolling();
          this._stopNativeMarkerObserver();
          this.clear();
          this.markerPool.clear();
          this.detectedMapType = null;
          super.cleanup();
        }
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = GenericMapOverlay;
      } else if (typeof window !== "undefined") {
        window.GenericMapOverlay = GenericMapOverlay;
      }
    }
  });

  // overlays/OverlayRegistry.js
  var require_OverlayRegistry = __commonJS({
    "overlays/OverlayRegistry.js"(exports, module) {
      var MapEntry = class {
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
          Object.defineProperty(this, "domain", {
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
          if (this.overlay && typeof this.overlay.cleanup === "function") {
            this.overlay.cleanup();
          }
        }
      };
      var OverlayRegistry = class {
        constructor() {
          this.entries = /* @__PURE__ */ new Map();
          this.instanceToId = /* @__PURE__ */ new WeakMap();
          this.idCounter = 0;
          this.factory = null;
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
            console.log("[OverlayRegistry]", ...args);
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
          let domain = "";
          if (container && container.ownerDocument) {
            try {
              const doc = container.ownerDocument;
              if (doc.location) {
                domain = doc.location.hostname;
              }
            } catch (e) {
            }
          }
          if (!domain && mapInstance && typeof mapInstance.getDiv === "function") {
            try {
              const div = mapInstance.getDiv();
              if (div && div.ownerDocument && div.ownerDocument.location) {
                domain = div.ownerDocument.location.hostname;
              }
            } catch (e) {
            }
          }
          if (!domain && mapInstance && mapInstance._container) {
            try {
              const c = mapInstance._container;
              if (c.ownerDocument && c.ownerDocument.location) {
                domain = c.ownerDocument.location.hostname;
              }
            } catch (e) {
            }
          }
          if (!domain && mapInstance && mapInstance.container) {
            try {
              const c = mapInstance.container;
              const el = typeof c === "string" ? document.getElementById(c) : c;
              if (el && el.ownerDocument && el.ownerDocument.location) {
                domain = el.ownerDocument.location.hostname;
              }
            } catch (e) {
            }
          }
          if (!domain) {
            try {
              if (window === window.top) {
                domain = window.location.hostname;
              }
            } catch (e) {
            }
          }
          this.log(`Extracted domain for map: ${domain || "(unknown)"}`);
          return domain || "";
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
          console.log("[OverlayRegistry] register() called for mapInstance:", mapInstance, "container:", container);
          if (this.instanceToId.has(mapInstance)) {
            const existingId = this.instanceToId.get(mapInstance);
            const entry2 = this.entries.get(existingId);
            if (entry2) {
              entry2.touch();
              this.log(`Map already registered: ${existingId}`);
              return entry2;
            }
          }
          const id = this.generateId();
          const domain = this._extractDomainFromMap(mapInstance, container);
          console.log("[OverlayRegistry] Extracted domain:", domain);
          let overlay = null;
          if (this.factory) {
            overlay = this.factory.createOverlay(domain);
            console.log("[OverlayRegistry] Created overlay via this.factory:", overlay, "for domain:", domain);
          } else if (typeof window.overlayFactory !== "undefined" && window.overlayFactory) {
            overlay = window.overlayFactory.createOverlay(domain);
            console.log("[OverlayRegistry] Created overlay via window.overlayFactory:", overlay, "for domain:", domain);
            if (!overlay && typeof window.GenericMapOverlay !== "undefined") {
              overlay = new window.GenericMapOverlay();
              console.warn("[OverlayRegistry] Fallback: Created GenericMapOverlay for domain:", domain);
            }
          } else if (typeof window.GenericMapOverlay !== "undefined") {
            overlay = new window.GenericMapOverlay();
            console.warn("[OverlayRegistry] Fallback: Created GenericMapOverlay for domain:", domain);
          } else {
            console.warn("[OverlayRegistry] No overlay factory or GenericMapOverlay found for domain:", domain);
          }
          const entry = new MapEntry(id, mapInstance, domain, overlay);
          console.log("[OverlayRegistry] MapEntry created:", entry);
          this.entries.set(id, entry);
          this.instanceToId.set(mapInstance, id);
          if (mapInstance) {
            try {
              mapInstance._poiRegistryId = id;
            } catch (e) {
            }
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
          return Array.from(this.entries.values()).filter((e) => e.isActive);
        }
        /**
         * Gets all entries for a specific domain
         * @param {string} domain - The domain to filter by
         * @returns {MapEntry[]} Array of entries
         */
        getByDomain(domain) {
          const normalized = domain.toLowerCase().replace(/^www\./, "");
          return Array.from(this.entries.values()).filter((e) => {
            const entryDomain = e.domain.toLowerCase().replace(/^www\./, "");
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
          if (!id)
            return false;
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
          }
        }
        /**
         * Cleans up stale entries (maps that have been removed)
         * @param {number} [maxAge=300000] - Maximum age in milliseconds (default 5 minutes)
         */
        cleanup(maxAge = 3e5) {
          const now = Date.now();
          const toRemove = [];
          this.entries.forEach((entry, id) => {
            let isValid = false;
            try {
              const map = entry.mapInstance;
              if (map) {
                if (typeof map.getDiv === "function") {
                  const div = map.getDiv();
                  isValid = div && document.contains(div);
                } else if (map._container) {
                  isValid = document.contains(map._container);
                } else if (map.container) {
                  const c = typeof map.container === "string" ? document.getElementById(map.container) : map.container;
                  isValid = c && document.contains(c);
                }
              }
            } catch (e) {
            }
            if (!isValid || now - entry.lastUpdate > maxAge) {
              toRemove.push(id);
            }
          });
          for (const id of toRemove) {
            const entry = this.entries.get(id);
            if (entry) {
              entry.deactivate();
              this.entries.delete(id);
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
            active: entries.filter((e) => e.isActive).length,
            domains: [...new Set(entries.map((e) => e.domain))],
            oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.createdAt)) : null
          };
        }
        /**
         * Clears all entries
         */
        clear() {
          this.entries.forEach((entry) => entry.deactivate());
          this.entries.clear();
          this.idCounter = 0;
          this.log("Registry cleared");
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
              overlayClass: entry.overlay ? entry.overlay.constructor.name : "none",
              overlayId: entry.overlay ? entry.overlay.siteId : "none",
              nativeMarkersInjected: entry.overlay ? entry.overlay._nativeMarkersInjected : "N/A",
              isActive: entry.isActive,
              createdAt: new Date(entry.createdAt).toISOString(),
              lastUpdate: new Date(entry.lastUpdate).toISOString(),
              poiCount: entry.overlay ? entry.overlay.pois ? entry.overlay.pois.length : 0 : 0
            });
          });
          return info;
        }
        /**
         * Log all overlays info to console
         */
        logDebugInfo() {
          const info = this.getDebugInfo();
          console.log("[OverlayRegistry] Current overlays:", info);
          return info;
        }
      };
      var overlayRegistry = new OverlayRegistry();
      if (typeof module !== "undefined" && module.exports) {
        module.exports = { OverlayRegistry, MapEntry, overlayRegistry };
      }
      if (typeof window !== "undefined") {
        window.OverlayRegistry = OverlayRegistry;
        window.MapEntry = MapEntry;
        window.overlayRegistry = overlayRegistry;
        if (window.overlayRegistry) {
          console.log("[OverlayRegistry] overlayRegistry attached to window:", window.overlayRegistry);
        }
      }
    }
  });

  // overlays/overlayFactory.js
  var require_overlayFactory = __commonJS({
    "overlays/overlayFactory.js"(exports, module) {
      var OverlayFactory = class {
        constructor() {
          this.overlayClasses = {};
          this.config = null;
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
            console.log("[OverlayFactory]", ...args);
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
          this.config = {
            sites: {
              "zillow.com": { overlay: "ZillowOverlay", mapType: "mapbox", priority: 100 },
              "redfin.com": { overlay: "RedfinOverlay", mapType: "google", priority: 100 },
              "homes.com": { overlay: "HomesComOverlay", mapType: "google", priority: 100 },
              "onekeymls.com": { overlay: "OneKeyOverlay", mapType: "mapbox", priority: 100 },
              "realtor.com": { overlay: "RealtorOverlay", mapType: "auto", priority: 100 }
            },
            defaults: { overlay: "GenericMapOverlay", mapType: "auto", priority: 1 },
            domainAliases: {
              "www.zillow.com": "zillow.com",
              "www.redfin.com": "redfin.com",
              "www.homes.com": "homes.com",
              "www.onekeymls.com": "onekeymls.com",
              "www.realtor.com": "realtor.com"
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
            "ZillowOverlay",
            "RedfinOverlay",
            "HomesComOverlay",
            "OneKeyOverlay",
            "RealtorOverlay",
            "GenericMapOverlay",
            "MapOverlayBase",
            "GoogleMapsOverlayBase",
            "MapboxOverlayBase"
          ];
          for (const name of overlayNames) {
            if (typeof window[name] === "function") {
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
          if (!domain)
            return "";
          domain = domain.toLowerCase();
          if (this.config && this.config.domainAliases && this.config.domainAliases[domain]) {
            return this.config.domainAliases[domain];
          }
          if (domain.startsWith("www.")) {
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
          if (this.config.sites[normalized]) {
            return this.config.sites[normalized];
          }
          for (const siteDomain of Object.keys(this.config.sites)) {
            if (normalized.endsWith(siteDomain) || normalized.includes(siteDomain)) {
              return this.config.sites[siteDomain];
            }
          }
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
            const FallbackClass = this.overlayClasses["GenericMapOverlay"];
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
          let domain = null;
          if (container && container.ownerDocument) {
            try {
              domain = container.ownerDocument.location?.hostname;
            } catch (e) {
            }
          }
          if (!domain && mapInstance) {
            try {
              if (typeof mapInstance.getDiv === "function") {
                const div = mapInstance.getDiv();
                domain = div?.ownerDocument?.location?.hostname;
              } else if (mapInstance._container) {
                domain = mapInstance._container.ownerDocument?.location?.hostname;
              } else if (mapInstance.container) {
                const c = mapInstance.container;
                const el = typeof c === "string" ? document.getElementById(c) : c;
                domain = el?.ownerDocument?.location?.hostname;
              }
            } catch (e) {
              this.log("Failed to extract domain from map:", e);
            }
          }
          if (!domain) {
            try {
              if (window === window.top) {
                domain = window.location.hostname;
              }
            } catch (e) {
            }
          }
          if (!domain) {
            this.log("Could not determine domain for map, using generic overlay");
            domain = "";
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
      };
      var overlayFactory = new OverlayFactory();
      overlayFactory.loadConfig();
      if (typeof module !== "undefined" && module.exports) {
        module.exports = { OverlayFactory, overlayFactory };
      } else if (typeof window !== "undefined") {
        window.OverlayFactory = OverlayFactory;
        window.overlayFactory = overlayFactory;
      }
    }
  });

  // bridge/main.js
  (function() {
    const PREFIX = " [POI TITAN] ";
    let attempts = 0;
    let registryInitialized = false;
    function extractBounds(map) {
      try {
        const b = map.getBounds();
        if (!b)
          return null;
        if (b.getNorthEast)
          return { north: b.getNorthEast().lat(), south: b.getSouthWest().lat(), east: b.getNorthEast().lng(), west: b.getSouthWest().lng() };
        if (b.getNorth)
          return { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
      } catch (e) {
      }
      return null;
    }
    function initializeRegistry() {
      if (registryInitialized)
        return;
      if (window.overlayRegistry && window.overlayFactory) {
        window.overlayRegistry.setFactory(window.overlayFactory);
        window.overlayFactory.registerFromWindow();
        registryInitialized = true;
        console.log(PREFIX + "OverlayRegistry initialized with factory");
      }
    }
    function loop() {
      if (!window.poiHijack || !window.poiDiscovery || !window.poiPortal) {
        if (attempts < 20) {
          attempts++;
          return;
        }
        console.warn(PREFIX + "Bridge modules missing after 20s. Manual check required.");
        return;
      }
      initializeRegistry();
      if (!window.poiBridgeReady) {
        window.poiBridgeReady = true;
        console.log(PREFIX + "POI Bridge v7.1 Active (Secure Mode - No Network Sniffing)");
        document.documentElement.setAttribute("data-poi-bridge-status", "ONLINE");
      }
      try {
        window.poiHijack.apply();
        window.poiDiscovery.run();
        for (const map of window.poiHijack.activeMaps) {
          const res = extractBounds(map);
          if (res && res.north) {
            window.poiPortal.update(res, "instance-capture");
            if (window.overlayRegistry) {
              window.overlayRegistry.updateBounds(map, res);
            }
            break;
          }
        }
        if (window.overlayRegistry) {
          const activeEntries = window.overlayRegistry.getActiveEntries();
          for (const entry of activeEntries) {
            if (entry.overlay) {
              const selector = entry.overlay._getNativeMarkerSelector?.();
              if (selector) {
                const nativeMarkers = document.querySelectorAll(selector);
                if (nativeMarkers.length > 0) {
                  if (!entry.overlay._nativeMarkersInjected) {
                    entry.overlay._nativeMarkersInjected = true;
                    console.log(PREFIX + `Native markers detected (pre-render check: ${nativeMarkers.length} found), clearing overlay`);
                    entry.overlay.clear();
                  }
                }
              }
            }
          }
        }
        if (window.overlayRegistry) {
          const activeEntries = window.overlayRegistry.getActiveEntries();
          for (const entry of activeEntries) {
            if (entry.overlay && window.poiRenderer?.lastPoiData?.length > 0) {
              entry.overlay.renderMarkers(window.poiRenderer.lastPoiData, entry.mapInstance);
            }
          }
        } else if (window.poiRenderer && window.poiRenderer.lastPoiData.length > 0) {
          window.poiRenderer.update(window.poiRenderer.lastPoiData);
        }
      } catch (e) {
        console.error(PREFIX + "Main loop failure:", e);
      }
    }
    setInterval(loop, 500);
    setInterval(() => {
      if (window.overlayRegistry) {
        window.overlayRegistry.cleanup();
      }
    }, 3e5);
    window.addEventListener("message", (event) => {
      if (event.data && event.data.type === "POI_DATA_UPDATE") {
        let nativeRenderSuccess = false;
        if (window.overlayRegistry) {
          const entries = window.overlayRegistry.getActiveEntries();
          for (const entry of entries) {
            if (entry.overlay && entry.mapInstance) {
              entry.overlay.renderMarkers(event.data.pois, entry.mapInstance);
              const hasActiveMarkers = entry.overlay.activeMarkers && entry.overlay.activeMarkers.size > 0 || entry.overlay.activeElements && entry.overlay.activeElements.size > 0;
              if (hasActiveMarkers) {
                nativeRenderSuccess = true;
              }
            }
          }
          if (nativeRenderSuccess) {
            window.postMessage({ type: "POI_NATIVE_ACTIVE" }, "*");
          }
        }
        if (window.poiRenderer) {
          window.poiRenderer.update(event.data.pois);
          if (window.poiHijack.activeMaps.size > 0) {
            window.postMessage({ type: "POI_NATIVE_ACTIVE" }, "*");
          }
        }
      }
    });
    if (window.poiHijack)
      window.poiHijack.apply();
    loop();
  })();

  // bridge/modules/ManagerBase.js
  var ManagerBase2 = class {
    /**
     * Creates a new ManagerBase instance (or returns existing singleton)
     */
    constructor() {
      if (this.constructor.instance) {
        return this.constructor.instance;
      }
      this.constructor.instance = this;
      this.initialized = false;
      this.initializing = false;
      this._debug = false;
    }
    /**
     * Enable or disable debug logging
     * @param {boolean} enabled - Enable debug mode
     */
    setDebug(enabled) {
      this._debug = enabled;
    }
    /**
     * Logs debug messages if debug mode is enabled
     * @param {...any} args - Arguments to log
     */
    log(...args) {
      if (this._debug) {
        console.log(`[${this.constructor.name}]`, ...args);
      }
    }
    /**
     * Logs warnings regardless of debug mode
     * @param {...any} args - Arguments to log
     */
    warn(...args) {
      console.warn(`[${this.constructor.name}]`, ...args);
    }
    /**
     * Logs errors regardless of debug mode
     * @param {...any} args - Arguments to log
     */
    error(...args) {
      console.error(`[${this.constructor.name}]`, ...args);
    }
    /**
     * Initializes the manager (idempotent - only runs once)
     * @returns {Promise<void>}
     */
    async initialize() {
      if (this.initialized) {
        this.log("Already initialized, skipping");
        return;
      }
      if (this.initializing) {
        this.log("Initialization in progress, waiting...");
        while (this.initializing) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return;
      }
      this.initializing = true;
      this.log("Initializing...");
      try {
        await this.onInitialize();
        this.initialized = true;
        this.log("Initialization complete");
      } catch (e) {
        this.error("Initialization failed:", e);
        throw e;
      } finally {
        this.initializing = false;
      }
    }
    /**
     * Called during initialization - must be implemented by subclasses
     * @abstract
     * @returns {Promise<void>}
     */
    async onInitialize() {
      throw new Error("Must implement onInitialize()");
    }
    /**
     * Cleans up resources and resets state
     * @abstract
     */
    cleanup() {
      throw new Error("Must implement cleanup()");
    }
    /**
     * Resets the singleton instance (useful for testing)
     */
    static reset() {
      if (this.instance) {
        try {
          this.instance.cleanup();
        } catch (e) {
          console.warn("Cleanup during reset failed:", e);
        }
        this.instance = null;
      }
    }
    /**
     * Gets the singleton instance
     * @returns {ManagerBase} The singleton instance
     */
    static getInstance() {
      if (!this.instance) {
        this.instance = new this();
      }
      return this.instance;
    }
  };
  if (typeof window !== "undefined") {
    window.ManagerBase = ManagerBase2;
  }

  // bridge/entry.js
  var import_mapUtilities = __toESM(require_mapUtilities());
  var import_hijack = __toESM(require_hijack());
  var import_discovery = __toESM(require_discovery());
  var import_portal = __toESM(require_portal());

  // bridge/modules/renderer.js
  window.poiRenderer = {
    activeMarkers: /* @__PURE__ */ new Map(),
    // Map<id, NativeMarker>
    lastPoiData: [],
    update(pois) {
      this.lastPoiData = pois;
      if (!window.poiHijack || !window.poiHijack.activeMaps)
        return;
      for (const map of window.poiHijack.activeMaps) {
        if (this.isGoogleMap(map)) {
          this.renderGoogle(map, pois);
        } else if (this.isMapbox(map)) {
          this.renderMapbox(map, pois);
        }
      }
    },
    isGoogleMap(map) {
      return map.overlayMapTypes !== void 0 || typeof map.getDiv === "function";
    },
    isMapbox(map) {
      return map.addSource !== void 0 && map.addLayer !== void 0 && map.on !== void 0;
    },
    renderGoogle(map, pois) {
      if (!window.google || !window.google.maps || !window.google.maps.OverlayView)
        return;
      if (!window.PoiCustomOverlay) {
        class PoiCustomOverlay extends window.google.maps.OverlayView {
          constructor(poi, element) {
            super();
            this.poi = poi;
            this.element = element;
          }
          onAdd() {
            this.getPanes().floatPane.appendChild(this.element);
          }
          draw() {
            const overlayProjection = this.getProjection();
            const position = new window.google.maps.LatLng(this.poi.latitude, this.poi.longitude);
            const pos = overlayProjection.fromLatLngToDivPixel(position);
            if (pos) {
              this.element.style.left = pos.x + "px";
              this.element.style.top = pos.y + "px";
            }
          }
          onRemove() {
            if (this.element.parentNode)
              this.element.parentNode.removeChild(this.element);
          }
        }
        window.PoiCustomOverlay = PoiCustomOverlay;
      }
      if (!window.PoiBatchOverlay) {
        class PoiBatchOverlay extends window.google.maps.OverlayView {
          constructor(mapInstance) {
            super();
            this.mapInstance = mapInstance;
            this.container = document.createElement("div");
            this.container.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;";
            this.pois = [];
            this.markerPool = [];
            this.activeElements = /* @__PURE__ */ new Map();
            this.hasPendingDraw = false;
            this.container.addEventListener("click", (e) => {
              const target = e.target.closest(".poi-native-marker");
              if (target) {
                e.stopPropagation();
                const id = target.getAttribute("data-id");
                const lat = parseFloat(target.getAttribute("data-lat"));
                const lng = parseFloat(target.getAttribute("data-lng"));
                window.postMessage({ type: "POI_MARKER_CLICK", id, lat, lng }, "*");
              }
            }, true);
            this.container.addEventListener("mouseenter", (e) => {
              const target = e.target.closest(".poi-native-marker");
              if (target) {
                target.style.zIndex = "1000000";
                const id = target.getAttribute("data-id");
                const lat = parseFloat(target.getAttribute("data-lat"));
                const lng = parseFloat(target.getAttribute("data-lng"));
                window.postMessage({ type: "POI_MARKER_HOVER", id, lat, lng }, "*");
              }
            }, true);
            this.container.addEventListener("mouseleave", (e) => {
              const target = e.target.closest(".poi-native-marker");
              if (target) {
                target.style.zIndex = "102";
                const id = target.getAttribute("data-id");
                window.postMessage({ type: "POI_MARKER_LEAVE", id }, "*");
              }
            }, true);
          }
          updatePois(newPois) {
            this.pois = newPois;
            if (this.getProjection())
              this.draw();
          }
          onAdd() {
            this.getPanes().floatPane.appendChild(this.container);
          }
          onRemove() {
            if (this.container.parentNode)
              this.container.parentNode.removeChild(this.container);
          }
          draw() {
            if (this.hasPendingDraw)
              return;
            this.hasPendingDraw = true;
            requestAnimationFrame(() => {
              this.hasPendingDraw = false;
              this._drawBatch();
            });
          }
          _drawBatch() {
            const projection = this.getProjection();
            if (!projection)
              return;
            const bounds = this.mapInstance.getBounds();
            if (!bounds)
              return;
            const visibleIds = /* @__PURE__ */ new Set();
            const fragment = document.createDocumentFragment();
            this.pois.forEach((poi) => {
              const lat = parseFloat(poi.latitude);
              const lng = parseFloat(poi.longitude);
              const latLng = new window.google.maps.LatLng(lat, lng);
              if (!bounds.contains(latLng))
                return;
              const id = poi.id || poi.name;
              visibleIds.add(id);
              const pos = projection.fromLatLngToDivPixel(latLng);
              let el = this.activeElements.get(id);
              if (!el) {
                if (this.markerPool.length > 0) {
                  el = this.markerPool.pop();
                } else {
                  el = document.createElement("div");
                  el.className = "poi-native-marker";
                  el.style.cssText = `
                        position: absolute; width: 32px; height: 32px;
                        background-size: contain; background-repeat: no-repeat;
                        pointer-events: auto; cursor: pointer; z-index: 102;
                        will-change: transform; top: 0; left: 0;
                        filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
                      `;
                }
                const color = poi.color || "#ff0000";
                const secondaryColor = poi.secondaryColor || "#ffffff";
                const svg = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`
                     <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="${secondaryColor}" stroke-width="1"/>
                     </svg>`);
                el.style.backgroundImage = `url('${poi.logoData || svg}')`;
                el.setAttribute("data-id", id);
                el.setAttribute("data-lat", lat);
                el.setAttribute("data-lng", lng);
                this.activeElements.set(id, el);
                fragment.appendChild(el);
              } else {
              }
              el.style.transform = `translate(-50%, -100%) translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
            });
            if (fragment.childElementCount > 0) {
              this.container.appendChild(fragment);
            }
            this.activeElements.forEach((el, id) => {
              if (!visibleIds.has(id)) {
                el.remove();
                this.markerPool.push(el);
                this.activeElements.delete(id);
              }
            });
          }
        }
        window.PoiBatchOverlay = PoiBatchOverlay;
      }
      if (!map._poiBatchLayer) {
        map._poiBatchLayer = new window.PoiBatchOverlay(map);
        map._poiBatchLayer.setMap(map);
      }
      map._poiBatchLayer.updatePois(pois);
    },
    renderMapbox(map, pois) {
      if (!window.mapboxgl || !window.mapboxgl.Marker)
        return;
      if (!map._poiUid)
        map._poiUid = Math.random().toString(36).substr(2, 9);
      const usedIds = /* @__PURE__ */ new Set();
      pois.forEach((poi) => {
        const id = `${map._poiUid}-${poi.id || poi.name}`;
        usedIds.add(id);
        if (this.activeMarkers.has(id))
          return;
        const el = document.createElement("div");
        el.className = "poi-native-marker-mapbox";
        const color = poi.color || "#ff0000";
        const secondaryColor = poi.secondaryColor || "#ffffff";
        const logo = poi.logoData;
        const fallbackSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
           <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="${secondaryColor}" stroke-width="1"/>
         </svg>
       `)}`;
        el.style.cssText = `
         width: 32px; height: 32px; cursor: pointer; z-index: 5000;
         background-image: url('${logo || fallbackSvg}');
         background-size: contain; background-repeat: no-repeat;
         filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
       `;
        el.onclick = (e) => {
          e.stopPropagation();
          window.postMessage({ type: "POI_MARKER_CLICK", id: poi.id, lat: poi.latitude, lng: poi.longitude }, "*");
        };
        el.onmouseenter = () => {
          el.style.zIndex = "1000000";
          window.postMessage({ type: "POI_MARKER_HOVER", id: poi.id, lat: poi.latitude, lng: poi.longitude }, "*");
        };
        el.onmouseleave = () => {
          el.style.zIndex = "5000";
          window.postMessage({ type: "POI_MARKER_LEAVE", id: poi.id }, "*");
        };
        const marker = new window.mapboxgl.Marker({ element: el }).setLngLat([parseFloat(poi.longitude), parseFloat(poi.latitude)]).addTo(map);
        this.activeMarkers.set(id, marker);
      });
      for (const [id, marker] of this.activeMarkers) {
        if (id.startsWith(map._poiUid) && !usedIds.has(id)) {
          marker.remove();
          this.activeMarkers.delete(id);
        }
      }
    }
  };

  // overlays/MapOverlayBase.js
  var MapOverlayBase2 = class _MapOverlayBase {
    /**
     * Creates a new MapOverlayBase instance
     * @param {boolean} debug - Enable debug logging
     */
    constructor(debug = false) {
      if (new.target === _MapOverlayBase) {
        throw new Error("MapOverlayBase is abstract and cannot be instantiated directly");
      }
      this.debug = debug;
      this.mapInstance = null;
      this.container = null;
      this.isActive = false;
      this.pois = [];
      this.markers = /* @__PURE__ */ new Map();
      this.mapId = null;
      this.domain = null;
      this.detectedAt = null;
    }
    /**
     * Logs debug messages if debug mode is enabled
     * @param {...any} args - Arguments to log
     */
    log(...args) {
      if (this.debug) {
        console.log(`[${this.constructor.name}]`, ...args);
      }
    }
    /**
     * Generates a unique map ID for this overlay instance
     * @returns {string} Unique map identifier
     */
    generateMapId() {
      return `map_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    // ============================================
    // Abstract Methods - Must be implemented by subclasses
    // ============================================
    /**
     * Detects and returns the map container element for this site
     * @abstract
     * @returns {HTMLElement|null} The map container element or null if not found
     */
    detect() {
      throw new Error("Must implement detect() - returns the map container element");
    }
    /**
     * Checks if the given map instance is compatible with this overlay
     * @abstract
     * @param {Object} mapInstance - The map instance to check
     * @returns {boolean} True if compatible, false otherwise
     */
    isCompatibleMap(mapInstance) {
      throw new Error("Must implement isCompatibleMap(mapInstance)");
    }
    /**
     * Renders markers for the given POIs on the map
     * @abstract
     * @param {Array} pois - Array of POI objects with latitude, longitude, and metadata
     * @param {Object} mapInstance - The map instance to render on
     */
    renderMarkers(pois, mapInstance) {
      throw new Error("Must implement renderMarkers(pois, mapInstance)");
    }
    /**
     * Creates a single marker for a POI
     * @abstract
     * @param {Object} poi - POI object with latitude, longitude, and metadata
     * @param {Object} map - The map instance
     * @returns {Object} The created marker instance
     */
    createMarker(poi, map) {
      throw new Error("Must implement createMarker(poi, map)");
    }
    // ============================================
    // Optional Override Methods
    // ============================================
    /**
     * Updates an existing marker with new POI data
     * Override in subclass if needed
     * @param {Object} marker - The marker instance to update
     * @param {Object} poi - Updated POI data
     */
    updateMarker(marker, poi) {
    }
    /**
     * Removes a marker from the map
     * Override in subclass if needed
     * @param {Object} marker - The marker instance to remove
     */
    removeMarker(marker) {
      if (marker && marker.remove) {
        marker.remove();
      } else if (marker && marker.setMap) {
        marker.setMap(null);
      }
    }
    // ============================================
    // Core Lifecycle Methods
    // ============================================
    /**
     * Hijacks/initializes the map instance for this overlay
     * Called after detect() successfully finds a container
     * @param {Object} mapInstance - The map instance to hijack
     */
    hijack(mapInstance) {
      if (!mapInstance) {
        this.log("hijack() called with null map instance");
        return false;
      }
      if (!this.isCompatibleMap(mapInstance)) {
        this.log("Map instance is not compatible with this overlay");
        return false;
      }
      this.mapInstance = mapInstance;
      this.mapId = this.generateMapId();
      this.detectedAt = Date.now();
      this.isActive = true;
      this.log("Map hijacked successfully, mapId:", this.mapId);
      return true;
    }
    /**
     * Inserts POI markers into the map
     * This is the main entry point called by the system
     * @param {Array} pois - Array of POI objects
     */
    insert(pois) {
      if (!this.mapInstance) {
        this.log("insert() called but no map instance available");
        return;
      }
      if (!Array.isArray(pois)) {
        this.log("insert() called with non-array pois");
        return;
      }
      this.pois = pois;
      this.renderMarkers(pois, this.mapInstance);
    }
    /**
     * Legacy render method - now delegates to renderMarkers
     * @deprecated Use insert() or renderMarkers() instead
     */
    render() {
      if (this.pois.length > 0 && this.mapInstance) {
        this.renderMarkers(this.pois, this.mapInstance);
      }
    }
    /**
     * Clears all markers from the map
     */
    clear() {
      this.markers.forEach((marker, id) => {
        this.removeMarker(marker);
      });
      this.markers.clear();
      this.log("All markers cleared");
    }
    /**
     * Cleans up the overlay and releases resources
     */
    cleanup() {
      this.clear();
      this.mapInstance = null;
      this.container = null;
      this.isActive = false;
      this.pois = [];
      this.log("Overlay cleaned up");
    }
    /**
     * Gets the current map bounds
     * @returns {Object|null} Bounds object with north, south, east, west or null
     */
    getBounds() {
      if (!this.mapInstance)
        return null;
      try {
        const b = this.mapInstance.getBounds();
        if (!b)
          return null;
        if (b.getNorthEast && b.getSouthWest) {
          return {
            north: b.getNorthEast().lat(),
            south: b.getSouthWest().lat(),
            east: b.getNorthEast().lng(),
            west: b.getSouthWest().lng()
          };
        }
        if (b.getNorth) {
          return {
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest()
          };
        }
      } catch (e) {
        this.log("Error getting bounds:", e);
      }
      return null;
    }
    /**
     * Checks if the extension has already rendered a marker for this POI
     * Used to prevent duplicate overlay rendering
     * @param {Object} poi - POI object
     * @returns {boolean} True if extension marker exists
     * @protected
     */
    _hasExtensionMarker(poi) {
      const selector = `[class*="poi-"], [data-poi-id="${MapUtils.getPoiId(poi)}"]`;
      return !!document.querySelector(selector);
    }
    /**
     * Checks if the site has already placed a native marker for this POI
     * Used to skip rendering if site's own pins are visible
     * Should be overridden by subclasses for site-specific detection
     * @param {Object} poi - POI object
     * @returns {boolean} True if site native marker exists
     * @protected
     */
    _hasSiteNativeMarker(poi) {
      return false;
    }
    /**
     * Checks if a marker (extension or site) already exists for this POI
     * Combines both extension and site marker checks
     * @param {Object} poi - POI object
     * @returns {boolean} True if any marker exists
     */
    _hasNativeMarker(poi) {
      if (typeof this._hasLoggedSiteMarker === "undefined") {
        this._hasLoggedSiteMarker = false;
      }
      if (this._hasSiteNativeMarker(poi)) {
        if (!this._hasLoggedSiteMarker) {
          this.log("Site native marker detected, skipping overlay render");
          this._hasLoggedSiteMarker = true;
        }
        return true;
      }
      if (this._hasExtensionMarker(poi)) {
        return true;
      }
      return false;
    }
    /**
     * Filters POIs to exclude those with native markers (site or extension)
     * @param {Array} pois - Array of POI objects
     * @returns {Array} Filtered POIs
     */
    _filterNativePois(pois) {
      return pois.filter((poi) => !this._hasNativeMarker(poi));
    }
    /**
     * Filters POIs to only those within the current map bounds
     * @param {Array} pois - Array of POI objects
     * @returns {Array} Filtered POIs within bounds
     */
    filterByBounds(pois) {
      const bounds = this.getBounds();
      if (!bounds)
        return pois;
      return pois.filter((poi) => {
        const lat = parseFloat(poi.latitude);
        const lng = parseFloat(poi.longitude);
        return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
      });
    }
  };
  if (typeof window !== "undefined") {
    window.MapOverlayBase = MapOverlayBase2;
  }

  // overlays/GoogleMapsOverlayBase.js
  if (typeof MapOverlayBase === "undefined" && typeof window !== "undefined") {
  }
  var GoogleMapsOverlayBase2 = class extends MapOverlayBase {
    /**
     * Creates a new GoogleMapsOverlayBase instance
     * @param {boolean} debug - Enable debug logging
     */
    constructor(debug = false) {
      super(debug);
      this.markerPool = new MarkerPool();
      this.batchOverlay = null;
      this.activeElements = /* @__PURE__ */ new Map();
      this._nativeMarkersInjected = false;
      this._nativeMarkerPollInterval = null;
      this.log(`[${this.constructor.name}] instance created. Debug:`, debug);
      this._nativeMarkerObserver = null;
      this._startNativeMarkerObserver();
      this._startNativeMarkerPolling();
    }
    /**
     * Sets up a MutationObserver to watch for native marker insertion and auto-clear overlays
     * Subclasses should override _getNativeMarkerSelector() to provide site-specific selectors
     */
    _startNativeMarkerObserver() {
      if (typeof window === "undefined" || typeof document === "undefined")
        return;
      if (this._nativeMarkerObserver)
        return;
      const callback = (mutationsList) => {
        this.log("MutationObserver callback fired", mutationsList);
        if (this._nativeMarkersInjected)
          return;
        const selector = this._getNativeMarkerSelector();
        if (selector && document.querySelector(selector)) {
          this._nativeMarkersInjected = true;
          this.log("Native marker detected by MutationObserver, clearing overlay markers");
          this.clear();
        }
      };
      this._nativeMarkerObserver = new MutationObserver(callback);
      this._nativeMarkerObserver.observe(document.body, { childList: true, subtree: true });
    }
    /**
     * Gets the CSS selector for native markers on this site
     * Override in subclass to provide site-specific selectors (e.g., site's own pins)
     * Base class returns the extension's native marker class for automatic switching
     * @returns {string|null} CSS selector or null if no native markers expected
     * @protected
     */
    _getNativeMarkerSelector() {
      return ".poi-native-marker, .poi-native-marker-mapbox";
    }
    /**
     * Starts periodic polling to check if native markers have appeared
     * This catches cases where native markers are injected after overlay initialization
     * (e.g., when debug window is opened, or after user interaction)
     * Subclasses should override _getNativeMarkerSelector() to provide site-specific selectors
     * @private
     */
    _startNativeMarkerPolling() {
      if (typeof window === "undefined" || typeof document === "undefined")
        return;
      if (this._nativeMarkerPollInterval)
        return;
      this.log("Starting native marker polling (250ms)...");
      let lastDetectedCount = 0;
      this._nativeMarkerPollInterval = setInterval(() => {
        try {
          if (this._nativeMarkersInjected) {
            this._stopNativeMarkerPolling();
            return;
          }
          const selector = this._getNativeMarkerSelector();
          if (!selector) {
            return;
          }
          const nativeMarkers = document.querySelectorAll(selector);
          const count = nativeMarkers.length;
          if (count > 0 && lastDetectedCount === 0) {
            this._nativeMarkersInjected = true;
            this.log(`Native markers detected by polling (${count} found), immediately clearing overlay`);
            this.clear();
            this._stopNativeMarkerPolling();
          }
          lastDetectedCount = count;
        } catch (e) {
          this.log("Error during native marker polling:", e);
        }
      }, 250);
    }
    /**
     * Stops the periodic native marker polling
     * @private
     */
    _stopNativeMarkerPolling() {
      if (this._nativeMarkerPollInterval) {
        clearInterval(this._nativeMarkerPollInterval);
        this._nativeMarkerPollInterval = null;
      }
    }
    /**
     * Disconnects the MutationObserver (call on cleanup)
     */
    _stopNativeMarkerObserver() {
      if (this._nativeMarkerObserver) {
        this._nativeMarkerObserver.disconnect();
        this._nativeMarkerObserver = null;
      }
    }
    /**
     * @override
     * Checks if the given map instance is a Google Maps instance
     * @param {Object} mapInstance - The map instance to check
     * @returns {boolean} True if Google Maps
     */
    isCompatibleMap(mapInstance) {
      return MapTypeDetector.isGoogleMap(mapInstance);
    }
    /**
     * Creates the PoiBatchOverlay class (Google Maps OverlayView)
     * This is created dynamically because it depends on google.maps being loaded
     * @returns {Function} The PoiBatchOverlay class
     * @private
     */
    _createBatchOverlayClass() {
      if (window.PoiBatchOverlay) {
        return window.PoiBatchOverlay;
      }
      if (!window.google || !window.google.maps || !window.google.maps.OverlayView) {
        this.log("Google Maps API not available");
        return null;
      }
      const self = this;
      class PoiBatchOverlay extends window.google.maps.OverlayView {
        constructor(mapInstance) {
          super();
          this.mapInstance = mapInstance;
          this.container = document.createElement("div");
          this.container.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;";
          this.pois = [];
          this.hasPendingDraw = false;
          this.container.addEventListener("click", (e) => {
            const target = e.target.closest(".poi-native-marker");
            if (target) {
              e.stopPropagation();
              const id = target.getAttribute("data-id");
              const lat = parseFloat(target.getAttribute("data-lat"));
              const lng = parseFloat(target.getAttribute("data-lng"));
              window.postMessage({ type: "POI_MARKER_CLICK", id, lat, lng }, "*");
            }
          }, true);
          this.container.addEventListener("mouseenter", (e) => {
            const target = e.target.closest(".poi-native-marker");
            if (target) {
              target.style.zIndex = "1000000";
              const id = target.getAttribute("data-id");
              const lat = parseFloat(target.getAttribute("data-lat"));
              const lng = parseFloat(target.getAttribute("data-lng"));
              window.postMessage({ type: "POI_MARKER_HOVER", id, lat, lng }, "*");
            }
          }, true);
          this.container.addEventListener("mouseleave", (e) => {
            const target = e.target.closest(".poi-native-marker");
            if (target) {
              target.style.zIndex = "102";
              const id = target.getAttribute("data-id");
              window.postMessage({ type: "POI_MARKER_LEAVE", id }, "*");
            }
          }, true);
        }
        updatePois(newPois) {
          this.pois = newPois;
          if (newPois && newPois.length > 0) {
            self._nativeMarkersInjected = true;
          }
          if (this.getProjection())
            this.draw();
        }
        onAdd() {
          this.getPanes().floatPane.appendChild(this.container);
        }
        onRemove() {
          if (this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
          }
        }
        draw() {
          if (this.hasPendingDraw)
            return;
          this.hasPendingDraw = true;
          requestAnimationFrame(() => {
            this.hasPendingDraw = false;
            this._drawBatch();
          });
        }
        _drawBatch() {
          const projection = this.getProjection();
          if (!projection)
            return;
          const bounds = this.mapInstance.getBounds();
          if (!bounds)
            return;
          const visibleIds = /* @__PURE__ */ new Set();
          const fragment = document.createDocumentFragment();
          this.pois.forEach((poi) => {
            const lat = parseFloat(poi.latitude);
            const lng = parseFloat(poi.longitude);
            const latLng = new window.google.maps.LatLng(lat, lng);
            if (!bounds.contains(latLng))
              return;
            const id = MapUtils.getPoiId(poi);
            visibleIds.add(id);
            const pos = projection.fromLatLngToDivPixel(latLng);
            let el = self.activeElements.get(id);
            if (!el) {
              el = self.markerPool.acquire(() => {
                const div = document.createElement("div");
                div.className = "poi-overlay-marker";
                div.style.cssText = `
                position: absolute; width: 32px; height: 32px;
                background-size: contain; background-repeat: no-repeat;
                pointer-events: auto; cursor: pointer; z-index: 102;
                will-change: transform; top: 0; left: 0;
                filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
              `;
                return div;
              });
              const color = poi.color || "#ff0000";
              const secondaryColor = poi.secondaryColor || "#ffffff";
              const svg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);
              el.style.backgroundImage = `url('${poi.logoData || svg}')`;
              el.setAttribute("data-id", id);
              el.setAttribute("data-lat", lat);
              el.setAttribute("data-lng", lng);
              self.activeElements.set(id, el);
              fragment.appendChild(el);
            }
            el.style.transform = `translate(-50%, -100%) translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
          });
          if (fragment.childElementCount > 0) {
            this.container.appendChild(fragment);
          }
          self.activeElements.forEach((el, id) => {
            if (!visibleIds.has(id)) {
              self.markerPool.release(el);
              self.activeElements.delete(id);
            }
          });
        }
      }
      window.PoiBatchOverlay = PoiBatchOverlay;
      return PoiBatchOverlay;
    }
    /**
     * @override
     * Renders markers for Google Maps overlays
     * @param {Array} pois - Array of POI objects
     * @param {Object} mapInstance - The map instance
     */
    renderMarkers(pois, mapInstance) {
      if (this._nativeMarkersInjected) {
        this.log("Native markers injected (flag set), skipping overlay render");
        return;
      }
      if (pois && pois.length > 0) {
        const selector = this._getNativeMarkerSelector();
        if (selector) {
          const nativeMarkers = document.querySelectorAll(selector);
          if (nativeMarkers.length > 0) {
            this._nativeMarkersInjected = true;
            this.log("Site native markers detected at render time, clearing overlay");
            this.clear();
            return;
          }
        }
      }
      const filteredPois = this._filterNativePois(pois);
      if (!mapInstance) {
        this.log("No map instance provided");
        return;
      }
      const PoiBatchOverlay = this._createBatchOverlayClass();
      if (!PoiBatchOverlay) {
        this.log("Could not create PoiBatchOverlay class");
        return;
      }
      if (!mapInstance._poiBatchLayer) {
        mapInstance._poiBatchLayer = new PoiBatchOverlay(mapInstance);
        mapInstance._poiBatchLayer.setMap(mapInstance);
        this.batchOverlay = mapInstance._poiBatchLayer;
      }
      mapInstance._poiBatchLayer.updatePois(filteredPois);
      this.log(`Rendered ${filteredPois.length} markers`);
    }
    /**
     * @override
     * Creates a single marker element (used for individual marker creation)
     * @param {Object} poi - POI object
     * @param {Object} map - Google Maps instance
     * @returns {HTMLElement} The marker element
     */
    createMarker(poi, map) {
      const el = document.createElement("div");
      el.className = "poi-overlay-marker";
      const color = poi.color || "#ff0000";
      const secondaryColor = poi.secondaryColor || "#ffffff";
      const svg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);
      el.style.cssText = `
      position: absolute; width: 32px; height: 32px;
      background-image: url('${poi.logoData || svg}');
      background-size: contain; background-repeat: no-repeat;
      pointer-events: auto; cursor: pointer; z-index: 102;
      filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
    `;
      el.setAttribute("data-id", MapUtils.getPoiId(poi));
      el.setAttribute("data-lat", poi.latitude);
      el.setAttribute("data-lng", poi.longitude);
      return el;
    }
    /**
     * @override
     * Clears all markers
     */
    clear() {
      this.activeElements.forEach((el, id) => {
        this.markerPool.release(el);
      });
      this.activeElements.clear();
      if (this.batchOverlay) {
        this.batchOverlay.updatePois([]);
      }
      super.clear();
    }
    /**
     * @override
     * Cleanup resources
     */
    cleanup() {
      this.clear();
      this.markerPool.clear();
      if (this.batchOverlay) {
        this.batchOverlay.setMap(null);
        this.batchOverlay = null;
      }
      this._stopNativeMarkerObserver();
      this._stopNativeMarkerPolling();
      super.cleanup();
    }
  };
  if (typeof window !== "undefined") {
    window.GoogleMapsOverlayBase = GoogleMapsOverlayBase2;
  }

  // overlays/MapboxOverlayBase.js
  if (typeof MapOverlayBase === "undefined" && typeof window !== "undefined") {
  }
  var MapboxOverlayBase2 = class extends MapOverlayBase {
    /**
     * Creates a new MapboxOverlayBase instance
     * @param {boolean} debug - Enable debug logging
     */
    constructor(debug = false) {
      super(debug);
      this.activeMarkers = /* @__PURE__ */ new Map();
      this._nativeMarkersInjected = false;
      this._nativeMarkerObserver = null;
      this._nativeMarkerPollInterval = null;
      this.log(`[${this.constructor.name}] instance created. Debug:`, debug);
      this._startNativeMarkerObserver();
      this._startNativeMarkerPolling();
    }
    /**
     * Sets up a MutationObserver to watch for native marker insertion and auto-clear overlays
     * Subclasses should override _getNativeMarkerSelector() to provide site-specific selectors
     */
    _startNativeMarkerObserver() {
      if (typeof window === "undefined" || typeof document === "undefined")
        return;
      if (this._nativeMarkerObserver)
        return;
      const callback = (mutationsList) => {
        if (this._nativeMarkersInjected)
          return;
        const selector = this._getNativeMarkerSelector();
        if (selector && document.querySelector(selector)) {
          this._nativeMarkersInjected = true;
          this.log("Native marker detected by MutationObserver, clearing overlay markers");
          this.clear();
        }
      };
      this._nativeMarkerObserver = new MutationObserver(callback);
      this._nativeMarkerObserver.observe(document.body, { childList: true, subtree: true });
    }
    /**
     * Stops the periodic native marker polling
     * @private
     */
    _stopNativeMarkerPolling() {
      if (this._nativeMarkerPollInterval) {
        clearInterval(this._nativeMarkerPollInterval);
        this._nativeMarkerPollInterval = null;
      }
    }
    /**
     * Starts periodic polling to check if native markers have appeared
     * Subclasses should override _getNativeMarkerSelector() to provide site-specific selectors
     * @private
     */
    _startNativeMarkerPolling() {
      if (typeof window === "undefined" || typeof document === "undefined")
        return;
      if (this._nativeMarkerPollInterval)
        return;
      this.log("Starting native marker polling (250ms)...");
      let lastDetectedCount = 0;
      this._nativeMarkerPollInterval = setInterval(() => {
        try {
          if (this._nativeMarkersInjected) {
            this._stopNativeMarkerPolling();
            return;
          }
          const selector = this._getNativeMarkerSelector();
          if (!selector) {
            return;
          }
          const nativeMarkers = document.querySelectorAll(selector);
          const count = nativeMarkers.length;
          if (count > 0 && lastDetectedCount === 0) {
            this._nativeMarkersInjected = true;
            this.log(`Native markers detected by polling (${count} found), immediately clearing overlay`);
            this.clear();
            this._stopNativeMarkerPolling();
          }
          lastDetectedCount = count;
        } catch (e) {
          this.log("Error during native marker polling:", e);
        }
      }, 250);
    }
    /**
     * Gets the CSS selector for native markers on this site
     * Override in subclass to provide site-specific selectors (e.g., site's own pins)
     * Base class returns the extension's native marker class for automatic switching
     * @returns {string|null} CSS selector or null if no native markers expected
     * @protected
     */
    _getNativeMarkerSelector() {
      return ".poi-native-marker-mapbox, .poi-native-marker";
    }
    /**
     * Disconnects the MutationObserver (call on cleanup)
     */
    _stopNativeMarkerObserver() {
      if (this._nativeMarkerObserver) {
        this._nativeMarkerObserver.disconnect();
        this._nativeMarkerObserver = null;
      }
    }
    /**
     * @override
     * Checks if the given map instance is a Mapbox GL JS instance
     * @param {Object} mapInstance - The map instance to check
     * @returns {boolean} True if Mapbox GL JS
     */
    isCompatibleMap(mapInstance) {
      return MapTypeDetector.isMapbox(mapInstance);
    }
    /**
     * Gets the z-index for markers (can be overridden by subclasses)
     * @returns {number} The z-index value
     */
    getMarkerZIndex() {
      return 10;
    }
    /**
     * @override
     * Renders markers for Mapbox overlays
     * @param {Array} pois - Array of POI objects
     * @param {Object} mapInstance - The map instance
     */
    renderMarkers(pois, mapInstance) {
      if (this._nativeMarkersInjected) {
        this.log("Native markers injected (flag set), skipping overlay render");
        return;
      }
      if (pois && pois.length > 0) {
        const selector = this._getNativeMarkerSelector();
        if (selector) {
          const nativeMarkers = document.querySelectorAll(selector);
          if (nativeMarkers.length > 0) {
            this._nativeMarkersInjected = true;
            this.log("Site native markers detected at render time, clearing overlay");
            this.clear();
            return;
          }
        }
      }
      if (typeof window !== "undefined" && window.poiState && window.poiState.nativeMode) {
        this.log("Native mode active, clearing overlay markers");
        this.clear();
        return;
      }
      const filteredPois = this._filterNativePois(pois);
      if (!mapInstance) {
        this.log("No map instance provided");
        return;
      }
      if (!window.mapboxgl || !window.mapboxgl.Marker) {
        this.log("Mapbox GL JS not available");
        return;
      }
      if (!mapInstance._poiUid) {
        mapInstance._poiUid = Math.random().toString(36).substr(2, 9);
      }
      const usedIds = /* @__PURE__ */ new Set();
      filteredPois.forEach((poi) => {
        const id = `${mapInstance._poiUid}-${MapUtils.getPoiId(poi)}`;
        usedIds.add(id);
        if (this.activeMarkers.has(id)) {
          return;
        }
        const marker = this.createMarker(poi, mapInstance);
        this.activeMarkers.set(id, marker);
        this.markers.set(id, marker);
      });
      this.activeMarkers.forEach((marker, id) => {
        if (id.startsWith(mapInstance._poiUid) && !usedIds.has(id)) {
          this.removeMarker(marker);
          this.activeMarkers.delete(id);
          this.markers.delete(id);
        }
      });
      this.log(`Rendered ${filteredPois.length} markers, active: ${this.activeMarkers.size}`);
    }
    /**
     * @override
     * Creates a single Mapbox marker for a POI
     * @param {Object} poi - POI object
     * @param {Object} map - Mapbox GL JS instance
     * @returns {Object} The Mapbox Marker instance
     */
    createMarker(poi, map) {
      const el = this.createMarkerElement(poi);
      const marker = new window.mapboxgl.Marker({ element: el }).setLngLat([parseFloat(poi.longitude), parseFloat(poi.latitude)]).addTo(map);
      return marker;
    }
    /**
     * Creates the DOM element for a marker
     * Can be overridden by subclasses for custom styling
     * @param {Object} poi - POI object
     * @returns {HTMLElement} The marker element
     */
    createMarkerElement(poi) {
      const el = document.createElement("div");
      el.className = "poi-native-marker-mapbox";
      const color = poi.color || "#ff0000";
      const secondaryColor = poi.secondaryColor || "#ffffff";
      const logo = poi.logoData;
      const zIndex = this.getMarkerZIndex();
      const fallbackSvg = MapUtils.generateFallbackSVG(color, secondaryColor, 32);
      el.style.cssText = `
      width: 32px;
      height: 32px;
      cursor: pointer;
      position: relative;
      z-index: ${zIndex};
      background-image: url('${logo || fallbackSvg}');
      background-size: contain;
      background-repeat: no-repeat;
      filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
    `;
      el.setAttribute("data-id", MapUtils.getPoiId(poi));
      el.setAttribute("data-lat", poi.latitude);
      el.setAttribute("data-lng", poi.longitude);
      el.onclick = (e) => {
        e.stopPropagation();
        window.postMessage({
          type: "POI_MARKER_CLICK",
          id: poi.id,
          lat: poi.latitude,
          lng: poi.longitude
        }, "*");
      };
      el.onmouseenter = () => {
        el.style.zIndex = "1000000";
        window.postMessage({
          type: "POI_MARKER_HOVER",
          id: poi.id,
          lat: poi.latitude,
          lng: poi.longitude
        }, "*");
      };
      el.onmouseleave = () => {
        el.style.zIndex = String(zIndex);
        window.postMessage({
          type: "POI_MARKER_LEAVE",
          id: poi.id
        }, "*");
      };
      return el;
    }
    /**
     * @override
     * Removes a Mapbox marker
     * @param {Object} marker - The Mapbox Marker instance
     */
    removeMarker(marker) {
      if (marker && typeof marker.remove === "function") {
        marker.remove();
      }
    }
    /**
     * @override
     * Clears all markers
     */
    clear() {
      this.activeMarkers.forEach((marker, id) => {
        this.removeMarker(marker);
      });
      this.activeMarkers.clear();
      super.clear();
    }
    /**
     * @override
     * Cleanup resources
     */
    cleanup() {
      this.clear();
      this._stopNativeMarkerObserver();
      this._stopNativeMarkerPolling();
      super.cleanup();
    }
    /**
     * @override
     * Gets the current map bounds from a Mapbox map
     * @returns {Object|null} Bounds object with north, south, east, west or null
     */
    getBounds() {
      if (!this.mapInstance)
        return null;
      try {
        const b = this.mapInstance.getBounds();
        if (!b)
          return null;
        return {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest()
        };
      } catch (e) {
        this.log("Error getting bounds:", e);
      }
      return null;
    }
    /**
     * Filters out POIs with native markers
     * @param {Array} pois - Array of POI objects
     * @returns {Array} Filtered POI objects
     */
    _filterNativePois(pois) {
      return pois.filter((poi) => !this._hasNativeMarker(poi));
    }
    /**
     * Checks if a POI has a native marker in the DOM
     * Queries the DOM for markers with any native-marker class variant
     * @param {Object} poi - POI object
     * @returns {boolean} True if the POI has a native marker
     */
    _hasNativeMarker(poi) {
      if (typeof this._hasLoggedNativeMarker === "undefined") {
        this._hasLoggedNativeMarker = false;
        this._nativeMarkerPreviouslyFound = false;
      }
      const selector = `.poi-native-marker[data-id="${MapUtils.getPoiId(poi)}"]`;
      const found = !!document.querySelector(selector);
      if (found && !this._hasLoggedNativeMarker && !this._nativeMarkerPreviouslyFound) {
        this.log("Native marker detected");
        this._hasLoggedNativeMarker = true;
      }
      if (found) {
        this._nativeMarkerPreviouslyFound = true;
      }
      return found;
    }
  };
  if (typeof window !== "undefined") {
    window.MapboxOverlayBase = MapboxOverlayBase2;
  }

  // bridge/entry.js
  var import_ZillowOverlay = __toESM(require_ZillowOverlay());
  var import_RedfinOverlay = __toESM(require_RedfinOverlay());
  var import_HomesComOverlay = __toESM(require_HomesComOverlay());
  var import_OneKeyOverlay = __toESM(require_OneKeyOverlay());
  var import_RealtorOverlay = __toESM(require_RealtorOverlay());
  var import_GenericMapOverlay = __toESM(require_GenericMapOverlay());
  var import_OverlayRegistry = __toESM(require_OverlayRegistry());
  var import_overlayFactory = __toESM(require_overlayFactory());
})();
//# sourceMappingURL=bridge-bundle.js.map
