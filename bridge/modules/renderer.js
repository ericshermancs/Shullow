/**
 * POI Bridge: Renderer Module
 * The PRIMARY rendering engine for all map types.
 * Handles injecting native map markers (poi-native-marker) into hijacked map instances.
 * 
 * Supports:
 * - Google Maps (via PoiBatchOverlay / PoiCustomOverlay with google.maps.OverlayView)
 * - Mapbox GL JS (via mapboxgl.Marker with poi-native-marker-mapbox class)
 * 
 * Site-specific overlay classes (overlays/ folder) handle domain detection,
 * bounds tracking, and OverlayRegistry management — but NOT rendering.
 * All rendering flows through window.poiRenderer.update(pois).
 */
window.poiRenderer = {
  activeMarkers: new Map(), // Map<id, NativeMarker>
  lastPoiData: [],
  configCache: new WeakMap(), // Cache configs per map instance
  siteConfigReady: false,
  
  /**
   * Checks if siteConfig is ready and initializes it
   */
  ensureSiteConfig() {
    if (this.siteConfigReady) return true;
    
    if (window.siteConfig && typeof window.siteConfig.getConfig === 'function') {
      this.siteConfigReady = true;
      console.log('[Renderer] siteConfig ready');
      return true;
    }
    
    return false;
  },
  
  /**
   * Gets the domain for a map instance
   */
  getMapDomain(map) {
    try {
      // Try getDiv for Google Maps
      if (typeof map.getDiv === 'function') {
        const div = map.getDiv();
        if (div && div.ownerDocument && div.ownerDocument.location) {
          return div.ownerDocument.location.hostname;
        }
      }
      
      // Try _container for Mapbox
      if (map._container && map._container.ownerDocument && map._container.ownerDocument.location) {
        return map._container.ownerDocument.location.hostname;
      }
      
      // Fallback to window
      if (window === window.top) {
        return window.location.hostname;
      }
    } catch (e) {
      // Cross-origin or error
    }
    return '';
  },
  
  /**
   * Gets site configuration for a map (cached per map instance)
   */
  getSiteConfig(map) {
    // Check cache first
    if (this.configCache.has(map)) {
      return this.configCache.get(map);
    }
    
    // Ensure siteConfig is ready
    if (!this.ensureSiteConfig()) {
      console.warn('[Renderer] siteConfig not ready yet, using defaults');
      const defaults = { styles: { markerZIndex: 5000, markerHoverZIndex: 1000000 } };
      return defaults;
    }
    
    const domain = this.getMapDomain(map);
    const config = window.siteConfig.getConfig(domain);
    
    // Cache it
    this.configCache.set(map, config);
    
    return config;
  },
  
   clear() {
      this.lastPoiData = [];
      // Clear Mapbox markers
      this.activeMarkers.forEach((marker) => {
         if (marker && typeof marker.remove === 'function') {
            marker.remove();
         } else if (marker && typeof marker.setMap === 'function') {
            marker.setMap(null);
         }
      });
      this.activeMarkers.clear();

      // Clear Google batch overlays if present
      if (window.poiHijack && window.poiHijack.activeMaps) {
         for (const map of window.poiHijack.activeMaps) {
            if (map && map._poiBatchLayer) {
               try {
                  map._poiBatchLayer.setMap(null);
               } catch (e) {}
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
    
    // We iterate over all active maps found by Hijack module
    if (!window.poiHijack || !window.poiHijack.activeMaps) return;
    
    for (const map of window.poiHijack.activeMaps) {
      if (this.isGoogleMap(map)) {
        this.renderGoogle(map, pois);
      } else if (this.isMapbox(map)) {
        this.renderMapbox(map, pois);
      }
    }
  },

  isGoogleMap(map) {
    return (map.overlayMapTypes !== undefined || typeof map.getDiv === 'function');
  },

  isMapbox(map) {
    return (map.addSource !== undefined && map.addLayer !== undefined && map.on !== undefined);
  },

  renderGoogle(map, pois) {
    // Check if OverlayView is available
    if (!window.google || !window.google.maps || !window.google.maps.OverlayView) return;

    // Define Custom Overlay Class if not defined
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
                this.element.style.left = pos.x + 'px';
                this.element.style.top = pos.y + 'px';
             }
          }
          onRemove() {
             if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
          }
       }
       window.PoiCustomOverlay = PoiCustomOverlay;
    }

    // NEW: Batch Overlay for Massive Performance
    // Instead of N overlay views, we use ONE overlay view for ALL markers on this map.
    if (!window.PoiBatchOverlay) {
       class PoiBatchOverlay extends window.google.maps.OverlayView {
          constructor(mapInstance) {
             super();
             this.mapInstance = mapInstance;
             this.container = document.createElement('div');
             this.container.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
             this.pois = [];
             this.markerPool = []; // Pool of DIVs
             this.activeElements = new Map(); // POI ID -> Element
             this.hasPendingDraw = false;
             
             // Event Delegation
             this.container.addEventListener('click', (e) => {
                const target = e.target.closest('.poi-native-marker');
                if (target) {
                   e.stopPropagation();
                   // Read data attributes
                   const id = target.getAttribute('data-id');
                   const lat = parseFloat(target.getAttribute('data-lat'));
                   const lng = parseFloat(target.getAttribute('data-lng'));
                   window.postMessage({ type: 'POI_MARKER_CLICK', id, lat, lng }, '*');
                }
             }, true); // Capture phase to beat Google Maps listeners
             
             this.container.addEventListener('mouseenter', (e) => {
                const target = e.target.closest('.poi-native-marker');
                if (target) {
                   const config = window.poiRenderer.getSiteConfig(this.mapInstance);
                   target.style.zIndex = (config.styles.markerHoverZIndex || 1000000).toString();
                   const id = target.getAttribute('data-id');
                   const lat = parseFloat(target.getAttribute('data-lat'));
                   const lng = parseFloat(target.getAttribute('data-lng'));
                   const message = { type: 'POI_MARKER_HOVER', id, lat, lng };
                   console.log('[Renderer] Posting hover event:', message);
                   window.postMessage(message, '*');
                }
             }, true);
             
             this.container.addEventListener('mouseleave', (e) => {
                const target = e.target.closest('.poi-native-marker');
                if (target) {
                   const config = window.poiRenderer.getSiteConfig(this.mapInstance);
                   target.style.zIndex = (config.styles.markerZIndex || 5000).toString();
                   const id = target.getAttribute('data-id');
                   window.postMessage({ type: 'POI_MARKER_LEAVE', id }, '*');
                }
             }, true);
          }
          
          updatePois(newPois) {
             this.pois = newPois;
             // Trigger redraw
             if (this.getProjection()) this.draw();
          }

          onAdd() {
             this.getPanes().floatPane.appendChild(this.container);
          }

          onRemove() {
             if (this.container.parentNode) this.container.parentNode.removeChild(this.container);
          }

          draw() {
             if (this.hasPendingDraw) return;
             this.hasPendingDraw = true;
             
             requestAnimationFrame(() => {
                this.hasPendingDraw = false;
                this._drawBatch();
             });
          }
          
          _drawBatch() {
             const projection = this.getProjection();
             if (!projection) return;
             
             const bounds = this.mapInstance.getBounds();
             if (!bounds) return;
             
             // Diff Strategy:
             // 1. Identify POIs currently in view
             // 2. Recycle elements for POIs no longer in view
             // 3. Create/Reuse elements for POIs now in view
             
             const visibleIds = new Set();
             const fragment = document.createDocumentFragment();
             
             this.pois.forEach(poi => {
                const lat = parseFloat(poi.latitude);
                const lng = parseFloat(poi.longitude);
                const latLng = new window.google.maps.LatLng(lat, lng);
                
                // Bounds Check
                if (!bounds.contains(latLng)) return;
                
                const id = poi.id || poi.name;
                visibleIds.add(id);
                
                const pos = projection.fromLatLngToDivPixel(latLng);
                
                let el = this.activeElements.get(id);
                
                if (!el) {
                   // Get from pool or create
                   if (this.markerPool.length > 0) {
                      el = this.markerPool.pop();
                   } else {
                      el = document.createElement('div');
                      el.className = 'poi-native-marker';
                      // Styles are set once, only transform changes
                      const config = window.poiRenderer.getSiteConfig(this.mapInstance);
                      const baseZIndex = config.styles.markerZIndex || 5000;
                      el.style.cssText = `
                        position: absolute; width: 32px; height: 32px;
                        background-size: contain; background-repeat: no-repeat;
                        pointer-events: auto; cursor: pointer; z-index: ${baseZIndex};
                        will-change: transform; top: 0; left: 0;
                        filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
                      `;
                   }
                   
                   // Update visual content (Logo/Color)
                   const color = poi.color || '#ff0000';
                   const secondaryColor = poi.secondaryColor || '#ffffff';
                   // Inline SVG construction (optimized string concat)
                   const svg = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(`
                     <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="${secondaryColor}" stroke-width="1"/>
                     </svg>`);
                   el.style.backgroundImage = `url('${poi.logoData || svg}')`;
                   
                   // Store Data Attributes for Delegation
                   el.setAttribute('data-id', id);
                   el.setAttribute('data-lat', lat);
                   el.setAttribute('data-lng', lng);
                   
                   this.activeElements.set(id, el);
                   fragment.appendChild(el);
                } else {
                   // Ensure it's attached (might be re-added if logic changes, but usually stays in DOM)
                   // If we are reusing, we don't append to fragment unless it was detached.
                   // Here we assume it stays attached.
                }
                
                // Update Position (Transform is faster than top/left)
                // translate(-50%, -100%) handles the anchor point (bottom center)
                el.style.transform = `translate(-50%, -100%) translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px)`;
             });
             
             // Append new elements
             if (fragment.childElementCount > 0) {
                this.container.appendChild(fragment);
             }
             
             // Cleanup hidden elements (Return to pool)
             this.activeElements.forEach((el, id) => {
                if (!visibleIds.has(id)) {
                   el.remove(); // Detach from DOM
                   this.markerPool.push(el); // Add to pool
                   this.activeElements.delete(id);
                }
             });
          }
       }
       window.PoiBatchOverlay = PoiBatchOverlay;
    }

    // Identify/Create Batch Layer for this map instance
    if (!map._poiBatchLayer) {
       map._poiBatchLayer = new window.PoiBatchOverlay(map);
       map._poiBatchLayer.setMap(map);
    }
    
    // Update Data
    map._poiBatchLayer.updatePois(pois);
  },

  renderMapbox(map, pois) {
    if (!window.mapboxgl || !window.mapboxgl.Marker) return;
    
    if (!map._poiUid) map._poiUid = Math.random().toString(36).substr(2, 9);
    const usedIds = new Set();

    pois.forEach(poi => {
       const id = `${map._poiUid}-${poi.id || poi.name}`;
       usedIds.add(id);
       
       if (this.activeMarkers.has(id)) return;

       const el = document.createElement('div');
       el.className = 'poi-native-marker-mapbox';
       const color = poi.color || '#ff0000';
       const secondaryColor = poi.secondaryColor || '#ffffff';
       const logo = poi.logoData;
       
       // Fallback SVG if no logo
       const fallbackSvg = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
           <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="${secondaryColor}" stroke-width="1"/>
         </svg>
       `)}`;

       const config = this.getSiteConfig(map);
       const baseZIndex = config.styles.markerZIndex || 5000;
       
       el.style.cssText = `
         width: 32px; height: 32px; cursor: pointer; z-index: ${baseZIndex};
         background-image: url('${logo || fallbackSvg}');
         background-size: contain; background-repeat: no-repeat;
         filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));
       `;
       
       el.onclick = (e) => {
          e.stopPropagation();
          window.postMessage({ type: 'POI_MARKER_CLICK', id: poi.id, lat: poi.latitude, lng: poi.longitude }, '*');
       };
       
       // Hover Listeners
       el.onmouseenter = () => {
          const hoverZIndex = config.styles.markerHoverZIndex || 1000000;
          el.style.zIndex = hoverZIndex.toString();
          const message = { type: 'POI_MARKER_HOVER', id: poi.id, lat: poi.latitude, lng: poi.longitude };
          console.log('[Renderer] Posting hover event (Mapbox):', message);
          window.postMessage(message, '*');
       };
       
       el.onmouseleave = () => {
          el.style.zIndex = baseZIndex.toString();
          window.postMessage({ type: 'POI_MARKER_LEAVE', id: poi.id }, '*');
       };

       const marker = new window.mapboxgl.Marker({ element: el })
          .setLngLat([parseFloat(poi.longitude), parseFloat(poi.latitude)])
          .addTo(map);
          
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
