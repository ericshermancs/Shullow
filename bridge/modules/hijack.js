/**
 * POI Bridge: Hijack Module
 * Captures map instances via constructor interception.
 */
window.poiHijack = {
  activeMaps: new Set(),
  attachListeners(instance) {
    if (!instance || instance._poiListener) return;
    console.log('[POI TITAN] Attaching listeners to captured instance');
    
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
        
        target.on('move', safeUpdate);
        target.on('moveend', safeUpdate);
        target.on('zoom', safeUpdate);
        target.on('zoomend', safeUpdate);
        
        // Redfin specific: Listen to style load or data load which often happens on pan
        target.on('dataloading', safeUpdate);
        target.on('data', safeUpdate);
        
        instance._poiListener = true; // Mark original instance as processed
      } else if (target.addListener) { // Google Maps
        const update = () => {
          console.log('[POI TITAN] Google Maps event fired');
          if (typeof target.getBounds === 'function') {
            const b = target.getBounds();
            // Google Maps getBounds returns LatLngBounds
            // getNorthEast() and getSouthWest() are standard
            if (b && b.getNorthEast && b.getSouthWest) {
              window.poiPortal.update({
                north: b.getNorthEast().lat(), south: b.getSouthWest().lat(),
                east: b.getNorthEast().lng(), west: b.getSouthWest().lng()
              }, 'instance-event');
            } else {
               console.log('[POI TITAN] getBounds returned invalid object', b);
            }
          } else {
             console.log('[POI TITAN] target.getBounds is not a function');
          }
        };
        
        target.addListener('bounds_changed', update);
        target.addListener('idle', update); // 'idle' fires when map is stable after pan/zoom
        target.addListener('center_changed', update);
        target.addListener('zoom_changed', update);
        instance._poiListener = true; // Mark original instance as processed
      }
    } catch(e) {
       console.error('[POI TITAN] Failed to attach listeners', e);
    }
  },

  apply() {
    const self = this;
    
    // TRAP: Google Maps (window.google)
    if (window.google?.maps?.Map) {
       this.hijackGoogle(window.google.maps);
    } else {
       if (!window._poiTrappedGoogle) {
          let _google = window.google;
          
          Object.defineProperty(window, 'google', {
             get() { return _google; },
             set(val) {
                _google = val;
                
                // If maps is already there, hijack immediately
                if (val?.maps) {
                   if (val.maps.Map) {
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
          window._poiTrappedGoogle = true;
       }
    }

    try {
      if (window.mapboxgl?.Map && !window.mapboxgl.Map._isHijacked) {
        const Original = window.mapboxgl.Map;
        const self = this;
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
  },

  hijackGoogle(mapsObj) {
     try {
       if (mapsObj.Map && !mapsObj.Map._isHijacked) {
         const Original = mapsObj.Map;
         const self = this;
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
         mapsObj.Map = HijackedMap;
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
                         console.log('[POI TITAN] Backdoor capture via', method);
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
     } catch(e) {}
  }
};