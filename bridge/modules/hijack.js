/**
 * POI Bridge: Hijack Module
 * Captures map instances via constructor interception.
 * 
 * Converted to OOP class extending ManagerBase for singleton pattern
 * and initialization lifecycle management.
 */

/**
 * MapHijackManager - Captures and manages map instances
 * 
 * Features:
 * - Intercepts Google Maps and Mapbox constructors
 * - Attaches event listeners for bounds updates
 * - Maintains a Set of active map instances
 * - Provides backdoor capture via prototype hijacking
 */
class MapHijackManager extends ManagerBase {
  constructor() {
    super();
    this.activeMaps = new Set();
    this.originalConstructors = {};
  }

  /**
   * @override
   * Called during initialization
   */
  async onInitialize() {
    this.interceptConstructors();
    this.log('MapHijackManager initialized');
  }

  /**
   * @override
   * Cleanup and restore original constructors
   */
  cleanup() {
    // Note: We don't restore constructors as it could break the page
    // Just clear our state
    this.activeMaps.clear();
    this.initialized = false;
    this.log('MapHijackManager cleaned up');
  }

  /**
   * Attaches event listeners to a captured map instance
   * @param {Object} instance - The map instance
   */
  attachListeners(instance) {
    if (!instance || instance._poiListener) return;
    console.log('[Shullow] Attaching listeners to captured instance');
    
    // Unwrap if it's a wrapper (Redfin specific)
    let target = instance;
    if (!target.addListener && !target.on) {
       if (target.map && (target.map.addListener || target.map.on)) target = target.map;
       else if (target.getMap && typeof target.getMap === 'function') {
          const m = target.getMap();
          if (m && (m.addListener || m.on)) target = m;
       }
    }

    try {
      if (target.on) { // Mapbox
        const update = () => {
          if (typeof target.getBounds === 'function') {
            const b = target.getBounds();
            if (b) {
              window.poiPortal.update({
                north: b.getNorth(), south: b.getSouth(),
                east: b.getEast(), west: b.getWest()
              }, 'instance-event');
            }
          }
        };
        // Redfin might throttle 'move', try 'moveend' too
        const safeUpdate = () => {
           try { update(); } catch(e) {}
        };
        
        // OPTIMIZATION: Only listen to 'moveend' to reduce flicker and load during drag
        // 'move' fires 60fps, which is unnecessary for POI updates
        // target.on('move', safeUpdate); 
        target.on('moveend', safeUpdate);
        // target.on('zoom', safeUpdate);
        target.on('zoomend', safeUpdate);
        
        instance._poiListener = true; // Mark original instance as processed
      } else if (target.addListener) { // Google Maps
        const update = () => {
          // console.log('[Shullow] Google Maps event fired');
          if (typeof target.getBounds === 'function') {
            const b = target.getBounds();
            // Google Maps getBounds returns LatLngBounds
            // getNorthEast() and getSouthWest() are standard
            if (b && b.getNorthEast && b.getSouthWest) {
              window.poiPortal.update({
                north: b.getNorthEast().lat(), south: b.getSouthWest().lat(),
                east: b.getNorthEast().lng(), west: b.getSouthWest().lng()
              }, 'instance-event');
            }
          }
        };
        
        // OPTIMIZATION: Only listen to 'idle' (fires when map is stable)
        // target.addListener('bounds_changed', update);
        target.addListener('idle', update); 
        // target.addListener('center_changed', update);
        // target.addListener('zoom_changed', update);
        instance._poiListener = true; // Mark original instance as processed
      }
    } catch(e) {
      console.error('[Shullow] Failed to attach listeners', e);
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
    console.log('[MapHijackManager] interceptConstructors called');
    
    // TRAP: Google Maps (window.google)
    if (window.google?.maps?.Map) {
       console.log('[MapHijackManager] window.google.maps.Map found, hijacking immediately');
       this.hijackGoogle(window.google.maps);
    } else {
       console.log('[MapHijackManager] window.google.maps.Map not found yet, setting up property trap');
       if (!window._poiTrappedGoogle) {
          try {
            let _google = window.google;
          
            Object.defineProperty(window, 'google', {
               get() { return _google; },
               set(val) {
                  _google = val;
                  console.log('[MapHijackManager] google property set, val.maps:', !!val?.maps);
                
                  // If maps is already there, hijack immediately
                  if (val?.maps) {
                     if (val.maps.Map) {
                        console.log('[MapHijackManager] Hijacking from property setter');
                        self.hijackGoogle(val.maps);
                     }
                   
                     // ALWAYS replace google.maps with a Proxy to catch lazy definition of Map
                     try {
                        const mapsProxy = new Proxy(val.maps, {
                           set(target, prop, value) {
                              if (prop === 'Map') {
                                 const Original = value;
                                 function HijackedMap(...args) {
                                    if (!new.target) return new HijackedMap(...args);
                                    const instance = new Original(...args);
                                    self.activeMaps.add(instance);
                                    self.attachListeners(instance);
                                    return instance;
                                 }
                                 HijackedMap.prototype = Original.prototype;
                                 HijackedMap._isHijacked = true;
                                 Object.assign(HijackedMap, Original);
                                 target[prop] = HijackedMap;
                                 return true;
                              }
                              target[prop] = value;
                              return true;
                           }
                        });
                        _google.maps = mapsProxy;
                     } catch(e) {}
                  }
               },
               configurable: true
            });
          } catch(e) {
            console.warn('[MapHijackManager] Failed to set property trap on window.google:', e.message);
          }
          // Always mark as trapped (even if it failed) to avoid retrying and throwing every loop
          window._poiTrappedGoogle = true;
       }
    }

    try {
      if (window.mapboxgl?.Map && !window.mapboxgl.Map._isHijacked) {
        const Original = window.mapboxgl.Map;
        function HijackedMap(...args) {
          const instance = new Original(...args);
          self.activeMaps.add(instance);
          self.attachListeners(instance);
          return instance;
        }
        HijackedMap.prototype = Original.prototype;
        HijackedMap._isHijacked = true;
        Object.assign(HijackedMap, Original);
        window.mapboxgl.Map = HijackedMap;
      }
    } catch(e) {}
  }

  /**
   * Hijacks Google Maps constructor and prototype methods
   * @param {Object} mapsObj - The google.maps object
   */
  hijackGoogle(mapsObj) {
    const self = this;
    console.log('[MapHijackManager] hijackGoogle called, mapsObj.Map:', !!mapsObj.Map);
    try {
       if (mapsObj.Map && !mapsObj.Map._isHijacked) {
         console.log('[MapHijackManager] Hijacking google.maps.Map constructor');
         const Original = mapsObj.Map;
         function HijackedMap(...args) {
           if (!new.target) return new HijackedMap(...args);
           console.log('[MapHijackManager] Google Maps constructor called, capturing instance');
           const instance = new Original(...args);
           self.activeMaps.add(instance);
           self.attachListeners(instance);
           return instance;
         }
         HijackedMap.prototype = Original.prototype;
         HijackedMap._isHijacked = true;
         Object.assign(HijackedMap, Original);
         mapsObj.Map = HijackedMap;
         console.log('[MapHijackManager] Hijack complete');
       } else {
         console.log('[MapHijackManager] Map already hijacked or not available');
       }
       
       // BACKDOOR: Prototype Hijack
       // Even if constructor hijack fails (race condition), we catch the instance 
       // when it calls standard methods.
       if (mapsObj.Map && mapsObj.Map.prototype) {
          const proto = mapsObj.Map.prototype;
          const methods = ['setCenter', 'setZoom', 'setOptions', 'fitBounds', 'panTo', 'panBy', 'set'];
          
          methods.forEach(method => {
             if (proto[method] && !proto[method]._isHijacked) {
                const origMethod = proto[method];
                proto[method] = function(...args) {
                   // Capture instance using Duck Typing
                   // Use window.poiHijack.activeMaps directly to avoid scope issues
                   if (this && typeof this.getDiv === 'function' && typeof this.getBounds === 'function') {
                      if (window.poiHijack && window.poiHijack.activeMaps && !window.poiHijack.activeMaps.has(this)) {
                         console.log('[Shullow] Backdoor capture via', method);
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
     } catch(e) {
       console.error('[MapHijackManager] Error in hijackGoogle:', e);
     }
  }

  /**
   * Public method to trigger constructor interception
   * (maintains backwards compatibility with existing code)
   */
  apply() {
    this.interceptConstructors();
  }
}

// Create singleton instance and expose on window for backwards compatibility
const hijackManager = new MapHijackManager();
window.poiHijack = hijackManager;

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapHijackManager;
}