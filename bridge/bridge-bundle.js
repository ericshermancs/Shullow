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
      var MapUtils = class {
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
      var MarkerPool = class {
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
      var MapTypeDetector = class {
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
        module.exports = { MapUtils, MarkerPool, MapTypeDetector };
      }
      if (typeof window !== "undefined") {
        window.MapUtils = MapUtils;
        window.MarkerPool = MarkerPool;
        window.MapTypeDetector = MapTypeDetector;
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
          console.log("[MapHijackManager] interceptConstructors called");
          if (window.google?.maps?.Map) {
            console.log("[MapHijackManager] window.google.maps.Map found, hijacking immediately");
            this.hijackGoogle(window.google.maps);
          } else {
            console.log("[MapHijackManager] window.google.maps.Map not found yet, setting up property trap");
            if (!window._poiTrappedGoogle) {
              try {
                let _google = window.google;
                Object.defineProperty(window, "google", {
                  get() {
                    return _google;
                  },
                  set(val) {
                    _google = val;
                    console.log("[MapHijackManager] google property set, val.maps:", !!val?.maps);
                    if (val?.maps) {
                      if (val.maps.Map) {
                        console.log("[MapHijackManager] Hijacking from property setter");
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
              } catch (e) {
                console.warn("[MapHijackManager] Failed to set property trap on window.google:", e.message);
              }
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
          console.log("[MapHijackManager] hijackGoogle called, mapsObj.Map:", !!mapsObj.Map);
          try {
            if (mapsObj.Map && !mapsObj.Map._isHijacked) {
              let HijackedMap2 = function(...args) {
                if (!new.target)
                  return new HijackedMap2(...args);
                console.log("[MapHijackManager] Google Maps constructor called, capturing instance");
                const instance = new Original(...args);
                self.activeMaps.add(instance);
                self.attachListeners(instance);
                return instance;
              };
              var HijackedMap = HijackedMap2;
              console.log("[MapHijackManager] Hijacking google.maps.Map constructor");
              const Original = mapsObj.Map;
              HijackedMap2.prototype = Original.prototype;
              HijackedMap2._isHijacked = true;
              Object.assign(HijackedMap2, Original);
              mapsObj.Map = HijackedMap2;
              console.log("[MapHijackManager] Hijack complete");
            } else {
              console.log("[MapHijackManager] Map already hijacked or not available");
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
            console.error("[MapHijackManager] Error in hijackGoogle:", e);
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
         * Attempts to extract a map-like instance from a candidate object
         * @param {any} candidate
         * @returns {any|null}
         * @private
         */
        _extractMapFromCandidate(candidate) {
          try {
            if (!candidate || typeof candidate !== "object")
              return null;
            if (typeof candidate.getBounds === "function" || typeof candidate.setCenter === "function") {
              return candidate;
            }
            const visited = /* @__PURE__ */ new WeakSet();
            const queue = [candidate];
            let depth = 0;
            while (queue.length > 0 && depth < 2) {
              const nextQueue = [];
              for (const obj of queue) {
                if (!obj || typeof obj !== "object")
                  continue;
                if (visited.has(obj))
                  continue;
                visited.add(obj);
                const keys = Object.keys(obj);
                for (const key of keys) {
                  try {
                    const val = obj[key];
                    if (!val || typeof val !== "object")
                      continue;
                    if (typeof val.getBounds === "function" || typeof val.setCenter === "function") {
                      return val;
                    }
                    nextQueue.push(val);
                  } catch (e) {
                  }
                }
              }
              queue.length = 0;
              queue.push(...nextQueue);
              depth++;
            }
          } catch (e) {
          }
          return null;
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
          console.log("[MapDiscoveryManager] _registerMap called with map:", map);
          window.poiHijack.activeMaps.add(map);
          window.poiHijack.attachListeners(map);
          if (window.overlayRegistry) {
            console.log("[MapDiscoveryManager] Calling overlayRegistry.register()");
            const entry = window.overlayRegistry.register(map, container);
            if (entry && entry.overlay) {
              this.log(`Registered map ${entry.id} with overlay for domain: ${entry.domain}`);
            }
          } else {
            console.warn("[MapDiscoveryManager] overlayRegistry not available!");
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
          console.log("[MapDiscoveryManager] run() called, activeMaps:", window.poiHijack.activeMaps.size);
          this._discoverMapboxGlobal();
          this._discoverWebComponents();
          this._discoverDOMAndFiber();
          if (window.poiHijack.activeMaps.size === 0 && window.google?.maps) {
            console.log("[MapDiscoveryManager] No maps found via discovery, checking window.google.maps...");
            if (window.google.maps._instances) {
              console.log("[MapDiscoveryManager] Found window.google.maps._instances");
              for (const instance of window.google.maps._instances) {
                if (instance && typeof instance.getBounds === "function") {
                  console.log("[MapDiscoveryManager] Registering map from window.google.maps._instances");
                  this._registerMap(instance, null);
                }
              }
            }
          }
          console.log("[MapDiscoveryManager] run() complete, now have:", window.poiHijack.activeMaps.size, "maps");
        }
        /**
         * Discover maps via Mapbox global registry
         * @private
         */
        _discoverMapboxGlobal() {
          try {
            if (window.mapboxgl?.getInstances) {
              const instances = window.mapboxgl.getInstances();
              console.log("[MapDiscoveryManager] Mapbox global registry found:", instances?.length || 0, "instances");
              instances?.forEach((map) => {
                if (map && typeof map.getBounds === "function") {
                  const container = map._container || null;
                  console.log("[MapDiscoveryManager] Registering Mapbox map");
                  this._registerMap(map, container);
                }
              });
            }
          } catch (e) {
            console.error("[MapDiscoveryManager] Error in Mapbox discovery:", e);
          }
        }
        /**
         * Discover maps via Web Components (Shadow DOM)
         * @private
         */
        _discoverWebComponents() {
          try {
            const elements = this.findAllInShadow(document, "gmp-map");
            elements.forEach((el) => {
              const map = el.map || el.innerMap || el.getMap?.();
              if (map && typeof map.getBounds === "function") {
                console.log("[MapDiscoveryManager] Registering gmp-map");
                this._registerMap(map, el);
              }
            });
          } catch (e) {
            console.error("[MapDiscoveryManager] Error in web components discovery:", e);
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
          const mapProps = ["map", "mapInstance", "innerMap", "__google_map__", "mapObject", "viewer", "__e3_"];
          let foundCount = 0;
          console.log("[MapDiscoveryManager] _discoverDOMAndFiber: checking", selectors.length, "selectors...");
          const quickTest = document.querySelector(".gm-style");
          console.log('[MapDiscoveryManager] Quick test: document.querySelector(".gm-style"):', !!quickTest);
          if (quickTest) {
            let curr = quickTest;
            for (let i = 0; i < 5 && curr; i++) {
              for (const p of mapProps) {
                try {
                  const candidate = curr[p];
                  if (candidate && typeof candidate.getBounds === "function") {
                    console.log("[MapDiscoveryManager] FOUND MAP via property", p);
                    foundCount++;
                    this._registerMap(candidate, quickTest);
                    break;
                  }
                } catch (e) {
                }
              }
              curr = curr.parentElement;
            }
          }
          selectors.forEach((sel) => {
            try {
              const elements = this.findAllInShadow(document, sel);
              console.log('[MapDiscoveryManager] Selector "' + sel + '": found', elements.length, "elements");
              elements.forEach((el) => {
                let curr = el;
                for (let i = 0; i < 5 && curr; i++) {
                  for (const p of mapProps) {
                    try {
                      const candidate = curr[p];
                      if (candidate && typeof candidate.getBounds === "function") {
                        console.log("[MapDiscoveryManager] Found map instance via", p, "on selector:", sel);
                        foundCount++;
                        this._registerMap(candidate, el);
                      } else if (candidate && typeof candidate === "object") {
                        const extracted = this._extractMapFromCandidate(candidate);
                        if (extracted) {
                          console.log("[MapDiscoveryManager] Extracted map instance via", p, "on selector:", sel);
                          foundCount++;
                          this._registerMap(extracted, el);
                        }
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
                              console.log("[MapDiscoveryManager] Found map via Fiber prop:", p);
                              this._registerMap(val, el);
                            } else if (val && typeof val === "object") {
                              const extracted = this._extractMapFromCandidate(val);
                              if (extracted) {
                                console.log("[MapDiscoveryManager] Extracted map via Fiber prop:", p);
                                this._registerMap(extracted, el);
                              }
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
            } catch (e) {
              console.error('[MapDiscoveryManager] Error processing selector "' + sel + '":', e);
            }
          });
          console.log("[MapDiscoveryManager] _discoverDOMAndFiber found:", foundCount, "maps total");
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

  // overlays/siteConfig.js
  var require_siteConfig = __commonJS({
    "overlays/siteConfig.js"(exports, module) {
      var DEFAULT_STYLES = {
        markerZIndex: 103,
        markerHoverZIndex: 1e6,
        containerZIndex: null,
        markerOpacity: 1,
        markerSize: 32
      };
      var SITE_CONFIG = {
        "zillow.com": {
          displayName: "Zillow",
          mapType: "mapbox",
          // Container detection - ordered by priority
          selectors: [
            ".mapboxgl-map",
            "#search-page-map",
            '[data-testid="map"]',
            ".map-container",
            "#map"
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
        "redfin.com": {
          displayName: "Redfin",
          mapType: "google",
          selectors: [
            ".gm-style",
            '[data-rf-test-id="map"]',
            "#map-container",
            ".MapContainer",
            ".HomeViews"
          ],
          styles: {
            // Could override here, e.g.: markerZIndex: 10000
            // Or remove: containerZIndex: null
          },
          features: {
            reduxStore: true,
            // Redfin-specific: subscribe to Redux for bounds
            shadowDOM: false,
            boundsTracking: true
          }
        },
        "realtor.com": {
          displayName: "Realtor",
          mapType: "auto",
          // Can be either Google or Mapbox
          selectors: [
            ".mapboxgl-map",
            ".gm-style",
            "gmp-map",
            "#map-container",
            '[data-testid="map"]',
            ".map-container",
            "#mapboxgl-map"
          ],
          styles: {
            // Inherits defaults
          },
          features: {
            reduxStore: false,
            shadowDOM: true,
            // Realtor uses Shadow DOM
            boundsTracking: true
          }
        },
        "homes.com": {
          displayName: "Homes.com",
          mapType: "google",
          selectors: [
            ".gm-style",
            "#map",
            ".map-container",
            '[data-testid="map"]'
          ],
          styles: {
            // Inherits defaults
            markerZIndex: -100
          },
          features: {
            reduxStore: false,
            shadowDOM: false,
            boundsTracking: true
          }
        },
        "onekeymls.com": {
          displayName: "OneKey MLS",
          mapType: "mapbox",
          selectors: [
            ".mapboxgl-map",
            "#map",
            ".map-container"
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
        "default": {
          displayName: "Generic",
          mapType: "auto",
          selectors: [
            ".mapboxgl-map",
            ".gm-style",
            "gmp-map",
            "#map",
            '[role="application"]',
            ".map-container"
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
      var DOMAIN_ALIASES = {
        "www.zillow.com": "zillow.com",
        "www.redfin.com": "redfin.com",
        "www.homes.com": "homes.com",
        "www.onekeymls.com": "onekeymls.com",
        "www.realtor.com": "realtor.com"
      };
      var SiteConfigManager = class {
        constructor() {
          this.config = SITE_CONFIG;
          this.aliases = DOMAIN_ALIASES;
          this.defaultStyles = DEFAULT_STYLES;
          this.debug = false;
          console.log("[SiteConfig] Initialized with", Object.keys(this.config).length, "site configs");
        }
        setDebug(enabled) {
          this.debug = enabled;
        }
        log(...args) {
          if (this.debug) {
            console.log("[SiteConfig]", ...args);
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
          if (!siteStyles)
            return merged;
          for (const [key, value] of Object.entries(siteStyles)) {
            if (value === null) {
              delete merged[key];
            } else {
              merged[key] = value;
            }
          }
          return merged;
        }
        /**
         * Normalizes a domain (removes www, applies aliases)
         */
        normalizeDomain(domain) {
          if (!domain)
            return "default";
          let normalized = domain.toLowerCase().trim();
          if (this.aliases[normalized]) {
            normalized = this.aliases[normalized];
          }
          if (normalized.startsWith("www.")) {
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
          if (this.config[normalized]) {
            siteConfig = this.config[normalized];
            this.log(`Exact match for ${normalized}`);
          } else {
            for (const [key, value] of Object.entries(this.config)) {
              if (key !== "default" && (normalized.includes(key) || key.includes(normalized))) {
                this.log(`Partial match: ${normalized} -> ${key}`);
                siteConfig = value;
                break;
              }
            }
          }
          if (!siteConfig) {
            this.log(`No match for ${normalized}, using default`);
            siteConfig = this.config.default;
          }
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
          if (config.features.shadowDOM) {
            return this._detectInShadowDOM(config.selectors);
          }
          for (const selector of config.selectors) {
            try {
              const el = document.querySelector(selector);
              if (el) {
                this.log(`Detected container for ${domain}: ${selector}`);
                return el;
              }
            } catch (e) {
            }
          }
          return null;
        }
        /**
         * Searches for elements within Shadow DOM
         */
        _detectInShadowDOM(selectors, root = document.body, found = null) {
          if (!root)
            return found;
          try {
            if (!found) {
              for (const selector of selectors) {
                const elements = root.querySelectorAll(selector);
                if (elements.length > 0) {
                  found = elements[0];
                  break;
                }
              }
            }
            if (!found) {
              const all = root.querySelectorAll("*");
              for (const el of all) {
                if (el.shadowRoot) {
                  if (el.tagName.includes("ICON") || el.tagName.includes("BUTTON")) {
                    continue;
                  }
                  found = this._detectInShadowDOM(selectors, el.shadowRoot, found);
                  if (found)
                    break;
                }
              }
            }
          } catch (e) {
          }
          return found;
        }
        /**
         * Applies site-specific styles to markers
         */
        applyMarkerStyles(element, domain, isHover = false) {
          const config = this.getConfig(domain);
          const zIndex = isHover ? config.styles.markerHoverZIndex : config.styles.markerZIndex;
          if (zIndex !== null) {
            element.style.zIndex = zIndex.toString();
          }
        }
        /**
         * Gets all configured sites
         */
        getAllSites() {
          return Object.keys(this.config).filter((k) => k !== "default");
        }
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = { DEFAULT_STYLES, SITE_CONFIG, DOMAIN_ALIASES, SiteConfigManager };
      }
      if (typeof window !== "undefined") {
        window.DEFAULT_STYLES = DEFAULT_STYLES;
        window.SITE_CONFIG = SITE_CONFIG;
        window.DOMAIN_ALIASES = DOMAIN_ALIASES;
        window.SiteConfigManager = SiteConfigManager;
        window.siteConfig = new SiteConfigManager();
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
        }
      };
      var OverlayRegistry = class {
        constructor() {
          this.entries = /* @__PURE__ */ new Map();
          this.instanceToId = /* @__PURE__ */ new WeakMap();
          this.idCounter = 0;
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
          let siteConfig = null;
          if (window.siteConfig && typeof window.siteConfig.getConfig === "function") {
            siteConfig = window.siteConfig.getConfig(domain);
            console.log("[OverlayRegistry] Loaded siteConfig for domain:", domain, siteConfig);
          } else {
            console.warn("[OverlayRegistry] window.siteConfig not available, using fallback");
            siteConfig = {
              displayName: domain || "Unknown",
              mapType: "auto",
              selectors: [],
              styles: {},
              features: {}
            };
          }
          const entry = new MapEntry(id, mapInstance, domain, siteConfig);
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

  // bridge/main.js
  (function() {
    const PREFIX = "[BRIDGE] ";
    let attempts = 0;
    let registryInitialized = false;
    let lastReceivedPois = [];
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
      if (window.overlayRegistry) {
        registryInitialized = true;
        console.log(PREFIX + "OverlayRegistry initialized");
      }
    }
    let loopCount = 0;
    function loop() {
      loopCount++;
      if (loopCount % 20 === 0) {
        const maps = window.poiHijack ? window.poiHijack.activeMaps.size : "?";
        console.log(`${PREFIX}heartbeat #${loopCount}: maps=${maps}, cachedPois=${lastReceivedPois.length}`);
      }
      if (!window.poiHijack || !window.poiDiscovery || !window.poiPortal) {
        if (attempts < 20) {
          attempts++;
          return;
        }
        console.warn(PREFIX + "Bridge modules missing after 20s.");
        return;
      }
      initializeRegistry();
      if (window.google?.maps?.Map && !window.google.maps.Map._isHijacked) {
        console.log(PREFIX + "Google Maps now available, hijacking...");
        window.poiHijack.hijackGoogle(window.google.maps);
      }
      if (!window.poiBridgeReady) {
        window.poiBridgeReady = true;
        console.log(PREFIX + "POI Bridge Active");
        document.documentElement.setAttribute("data-poi-bridge-status", "ONLINE");
        window.postMessage({ type: "POI_BRIDGE_READY" }, "*");
      }
      try {
        window.poiHijack.apply();
      } catch (e) {
        console.error(PREFIX + "Hijack error:", e);
      }
      try {
        window.poiDiscovery.run();
      } catch (e) {
        console.error(PREFIX + "Discovery error:", e);
      }
      try {
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
        if (window.poiRenderer && lastReceivedPois.length > 0) {
          window.poiRenderer.update(lastReceivedPois);
        }
      } catch (e) {
        console.error(PREFIX + "Loop error:", e);
      }
    }
    setInterval(loop, 500);
    setInterval(() => {
      if (window.overlayRegistry) {
        window.overlayRegistry.cleanup();
      }
    }, 3e5);
    window.addEventListener("message", (event) => {
      if (!event.data)
        return;
      if (event.data.type === "POI_DATA_UPDATE") {
        console.log(`${PREFIX}POI_DATA_UPDATE received: ${event.data.pois.length} POIs`);
        lastReceivedPois = event.data.pois;
        if (window.poiRenderer) {
          window.poiRenderer.update(event.data.pois);
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
    configCache: /* @__PURE__ */ new WeakMap(),
    // Cache configs per map instance
    siteConfigReady: false,
    /**
     * Checks if siteConfig is ready and initializes it
     */
    ensureSiteConfig() {
      if (this.siteConfigReady)
        return true;
      if (window.siteConfig && typeof window.siteConfig.getConfig === "function") {
        this.siteConfigReady = true;
        console.log("[Renderer] siteConfig ready");
        return true;
      }
      return false;
    },
    /**
     * Gets the domain for a map instance
     */
    getMapDomain(map) {
      try {
        if (typeof map.getDiv === "function") {
          const div = map.getDiv();
          if (div && div.ownerDocument && div.ownerDocument.location) {
            return div.ownerDocument.location.hostname;
          }
        }
        if (map._container && map._container.ownerDocument && map._container.ownerDocument.location) {
          return map._container.ownerDocument.location.hostname;
        }
        if (window === window.top) {
          return window.location.hostname;
        }
      } catch (e) {
      }
      return "";
    },
    /**
     * Gets site configuration for a map (cached per map instance)
     */
    getSiteConfig(map) {
      if (this.configCache.has(map)) {
        return this.configCache.get(map);
      }
      if (!this.ensureSiteConfig()) {
        console.warn("[Renderer] siteConfig not ready yet, using defaults");
        const defaults = { styles: { markerZIndex: 5e3, markerHoverZIndex: 1e6 } };
        return defaults;
      }
      const domain = this.getMapDomain(map);
      const config = window.siteConfig.getConfig(domain);
      this.configCache.set(map, config);
      return config;
    },
    clear() {
      this.lastPoiData = [];
      this.activeMarkers.forEach((marker) => {
        if (marker && typeof marker.remove === "function") {
          marker.remove();
        } else if (marker && typeof marker.setMap === "function") {
          marker.setMap(null);
        }
      });
      this.activeMarkers.clear();
      if (window.poiHijack && window.poiHijack.activeMaps) {
        for (const map of window.poiHijack.activeMaps) {
          if (map && map._poiBatchLayer) {
            try {
              map._poiBatchLayer.setMap(null);
            } catch (e) {
            }
            if (map._poiBatchLayer.container) {
              map._poiBatchLayer.container.remove();
            }
            map._poiBatchLayer = null;
          }
        }
      }
    },
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
                const config = window.poiRenderer.getSiteConfig(this.mapInstance);
                target.style.zIndex = (config.styles.markerHoverZIndex || 1e6).toString();
                const id = target.getAttribute("data-id");
                const lat = parseFloat(target.getAttribute("data-lat"));
                const lng = parseFloat(target.getAttribute("data-lng"));
                const message = { type: "POI_MARKER_HOVER", id, lat, lng };
                console.log("[Renderer] Posting hover event:", message);
                window.postMessage(message, "*");
              }
            }, true);
            this.container.addEventListener("mouseleave", (e) => {
              const target = e.target.closest(".poi-native-marker");
              if (target) {
                const config = window.poiRenderer.getSiteConfig(this.mapInstance);
                target.style.zIndex = (config.styles.markerZIndex || 5e3).toString();
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
                  const config = window.poiRenderer.getSiteConfig(this.mapInstance);
                  const baseZIndex = config.styles.markerZIndex || 5e3;
                  el.style.cssText = `
                        position: absolute; width: 32px; height: 32px;
                        background-size: contain; background-repeat: no-repeat;
                        pointer-events: auto; cursor: pointer; z-index: ${baseZIndex};
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
        const config = this.getSiteConfig(map);
        const baseZIndex = config.styles.markerZIndex || 5e3;
        el.style.cssText = `
         width: 32px; height: 32px; cursor: pointer; z-index: ${baseZIndex};
         background-image: url('${logo || fallbackSvg}');
         background-size: contain; background-repeat: no-repeat;
         filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
       `;
        el.onclick = (e) => {
          e.stopPropagation();
          window.postMessage({ type: "POI_MARKER_CLICK", id: poi.id, lat: poi.latitude, lng: poi.longitude }, "*");
        };
        el.onmouseenter = () => {
          const hoverZIndex = config.styles.markerHoverZIndex || 1e6;
          el.style.zIndex = hoverZIndex.toString();
          const message = { type: "POI_MARKER_HOVER", id: poi.id, lat: poi.latitude, lng: poi.longitude };
          console.log("[Renderer] Posting hover event (Mapbox):", message);
          window.postMessage(message, "*");
        };
        el.onmouseleave = () => {
          el.style.zIndex = baseZIndex.toString();
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

  // bridge/entry.js
  var import_siteConfig = __toESM(require_siteConfig());
  var import_OverlayRegistry = __toESM(require_OverlayRegistry());
})();
//# sourceMappingURL=bridge-bundle.js.map
