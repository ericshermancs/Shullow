// Content script for Map POI Injector (Robust Overlay v3.9)

console.log('%c POI Injector: Overlay script starting...', 'background: #222; color: #3498db');

// Inlined SVG to bypass CSP
const PIN_SVG_DATA = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#ff0000" stroke="#ffffff" stroke-width="1"/>
</svg>
`)}`;

class OverlayManager {
  constructor(container) {
    this.container = container;
    this.overlay = null;
    this.markerData = [];
    this.mapBounds = null;
    this.viewportBounds = null;
    this.initialize();
  }

  initialize() {
    console.log('POI Injector: Initializing overlay on', this.container);
    const existing = document.getElementById('poi-overlay');
    if (existing) existing.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'poi-overlay';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 2147483647; background: transparent;
      border: 3px dashed rgba(255, 0, 0, 0.3); box-sizing: border-box;
    `;
    
    const target = this.container.tagName === 'IFRAME' ? this.container.parentElement : this.container;
    if (getComputedStyle(target).position === 'static') {
      target.style.position = 'relative';
    }
    target.appendChild(this.overlay);

    this.createDebugPanel();
    this.sync();
    window.addEventListener('resize', () => this.sync());
  }

  createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'poi-debug-panel';
    panel.style.cssText = `
      position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.85);
      color: #0f0; font-family: monospace; font-size: 11px; padding: 12px;
      border-radius: 6px; pointer-events: auto; z-index: 2147483647;
      border: 1px solid #0f0; line-height: 1.5;
    `;
    this.overlay.appendChild(panel);
  }

  updateDebug() {
    const panel = document.getElementById('poi-debug-panel');
    if (!panel) return;
    const b = this.mapBounds;
    // Display all active groups, joined by comma, or 'NONE' if empty
    const activeGroupNames = Object.keys(activeGroups).filter(key => activeGroups[key]).join(', ');
    const activeDisplay = activeGroupNames || 'NONE';

    panel.innerHTML = `
      <b style="color:#fff; border-bottom:1px solid #0f0; display:block; margin-bottom:5px;">POI INJECTOR DEBUG (v3.9)</b>
      STATUS: <span style="color:#0f0">ACTIVE</span><br>
      ACTIVE GRP: <span style="color:#fff">${activeDisplay}</span><br>
      POIS LOADED: ${this.markerData.length}<br>
      ${b ? `LAT: ${b.south.toFixed(4)} to ${b.north.toFixed(4)}<br>LNG: ${b.west.toFixed(4)} to ${b.east.toFixed(4)}` : 'BOUNDS: <span style="color:red">N/A</span>'}
    `;
  }

  sync() {
    if (!this.overlay || !this.container.isConnected) return;
    const rect = this.container.getBoundingClientRect();
    this.overlay.style.width = rect.width + 'px';
    this.overlay.style.height = rect.height + 'px';
    
    if (this.container.tagName === 'IFRAME') {
      this.overlay.style.top = this.container.offsetTop + 'px';
      this.overlay.style.left = this.container.offsetLeft + 'px';
    }
    
    this.viewportBounds = { width: rect.width, height: rect.height };
    this.extractBounds();
  }

  extractBounds() {
    let found = false;

    // 1. Try Redfin Global (__map_bounds__) - PRIMARY FOR REDFIN
    if (window.__map_bounds__) {
      try {
        const b = window.__map_bounds__;
        // Redfin's __map_bounds__ structure is often { Mh: { lo, hi }, si: { lo, hi } }
        // where one is lat and one is lng. Lng has wider range for NYC.
        let latBounds, lngBounds;
        if (b.Mh && b.si && 'lo' in b.Mh && 'hi' in b.Mh && 'lo' in b.si && 'hi' in b.si) {
            // Heuristic to distinguish lat/lng
            if (Math.abs(b.Mh.hi - b.Mh.lo) > Math.abs(b.si.hi - b.si.lo)) { // Larger span is usually longitude
                lngBounds = b.Mh;
                latBounds = b.si;
            } else {
                lngBounds = b.si;
                latBounds = b.Mh;
            }
            this.mapBounds = {
                north: latBounds.hi, south: latBounds.lo,
                east: lngBounds.hi, west: lngBounds.lo
            };
            found = true;
        }
      } catch (e) { console.error("Error parsing Redfin __map_bounds__:", e); }
    }

    // 2. Try Zillow URL (searchQueryState)
    if (!found) {
        const zmatch = window.location.href.match(/searchQueryState=([^&]+)/);
        if (zmatch) {
          try {
            const state = JSON.parse(decodeURIComponent(zmatch[1]));
            if (state.mapBounds) {
              this.mapBounds = state.mapBounds;
              found = true;
            }
          } catch (e) { console.error("Error parsing Zillow searchQueryState:", e); }
        }
    }
    
    // 3. Redfin Fallback Search (window.App.mapState or similar React props)
    if (!found && window.App && window.App.mapState && window.App.mapState.bounds) {
        this.mapBounds = window.App.mapState.bounds;
        found = true;
    }
    
    // 4. React Fiber Probe (Lightweight - directly on map container)
    if (!found) {
        const gm = document.querySelector('.gm-style'); // Google Maps container
        const redfinMap = document.querySelector('.searchMapContainer, .MapContainer, .InteractiveMap, .Map, #map');
        const targetContainer = gm || redfinMap;

        if (targetContainer) {
            const reactKey = Object.keys(targetContainer).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
            if (reactKey) {
                let fiber = targetContainer[reactKey];
                let depth = 0;
                while (fiber && depth < 10) { // Limit depth to avoid performance issues
                    const props = fiber.memoizedProps || {};
                    if (props.bounds && 'north' in props.bounds) {
                        this.mapBounds = props.bounds;
                        found = true; break;
                    }
                    if (props.map && typeof props.map.getBounds === 'function') {
                        try {
                            const b = props.map.getBounds();
                            if (b) {
                                this.mapBounds = {
                                    north: b.getNorthEast().lat(), south: b.getSouthWest().lat(),
                                    east: b.getNorthEast().lng(), west: b.getSouthWest().lng()
                                };
                                found = true; break;
                            }
                        } catch (e) {}
                    }
                    fiber = fiber.return; depth++;
                }
            }
        }
    }

    if (found) {
        this.render();
    } else {
        this.updateDebug();
    }
  }

  load(pois) {
    this.markerData = pois;
    this.render();
  }

  clearMarkers() { // Added to clear previous markers when groups change
    if (this.overlay) {
      // Clear only marker elements, keep debug panel
      const markers = this.overlay.querySelectorAll('.poi-marker-overlay');
      markers.forEach(m => m.remove());
      this.markerData = []; // Reset marker data
      this.updateDebug(); // Update debug panel to reflect cleared markers
    }
  }

  render() {
    if (!this.overlay || !this.mapBounds || !this.markerData.length || !this.viewportBounds) {
      this.updateDebug();
      return;
    }

    const panel = document.getElementById('poi-debug-panel');
    this.overlay.innerHTML = ''; // Clear previous markers
    if (panel) this.overlay.appendChild(panel);

    const b = this.mapBounds;
    const w = this.viewportBounds.width;
    const h = this.viewportBounds.height;

    let count = 0;
    this.markerData.forEach(poi => {
      const lat = parseFloat(poi.latitude);
      const lng = parseFloat(poi.longitude);
      
      if (lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east) {
        count++;
        const x = ((lng - b.west) / (b.east - b.west)) * w;
        const y = ((b.north - lat) / (b.north - b.south)) * h;

        const pin = document.createElement('div');
        pin.className = 'poi-marker-overlay';
        pin.style.cssText = `
          position: absolute; left: ${x}px; top: ${y}px; width: 38px; height: 38px;
          background-image: url('${PIN_SVG_DATA}');
          background-size: contain; background-repeat: no-repeat;
          transform: translate(-50%, -100%); pointer-events: auto; cursor: pointer;
          filter: drop-shadow(0px 3px 5px rgba(0,0,0,0.5)); z-index: 1000;
        `;
        pin.title = poi.name;
        pin.onclick = () => alert(poi.name + "\n" + (poi.address || ""));
        this.overlay.appendChild(pin);
      }
    });
    this.updateDebug();
  }
}

// --- ORCHESTRATION ---
// Modified: activeGroups is now an object mapping group names to boolean status
// e.g., { 'Group A': true, 'Group B': false }
let activeGroups = {}; 
let useSyncStore = false;
let manager = null; // Initialized later

async function refresh() {
  console.log("Content script: refresh() called.");
  try {
    // Retrieve activeGroups from storage. It should now be an object of { groupName: boolean }
    const state = await chrome.storage.local.get(['activeGroups', 'storageType']);
    activeGroups = state.activeGroups || {}; 
    useSyncStore = state.storageType === 'sync'; 
    console.log("Content script: Retrieved activeGroups from storage for refresh:", activeGroups);
    
    // Check if any groups are actually selected (value is true)
    const selectedGroupNames = Object.keys(activeGroups).filter(groupName => activeGroups[groupName]);

    if (selectedGroupNames.length === 0) {
        console.log('Content script: No active groups selected. Clearing markers.');
        if (manager) manager.clearMarkers(); 
        if (manager) manager.updateDebug(); // Ensure debug panel reflects no active groups
        return;
    }
    
    const store = useSyncStore ? chrome.storage.sync : chrome.storage.local;
    const data = await store.get(['poiGroups']);
    const allPois = [];
    
    console.log(`Content script: Aggregating POIs for ${selectedGroupNames.length} selected groups.`);
    selectedGroupNames.forEach(groupName => {
        const pois = data.poiGroups?.[groupName] || [];
        console.log(`Content script: Found ${pois.length} POIs in group "${groupName}"`);
        allPois.push(...pois);
    });
    
    console.log(`Content script: refresh() aggregated ${allPois.length} POIs across ${selectedGroupNames.length} selected groups.`);
    
    if (manager) {
        manager.load(allPois);
    }
  } catch (e) {
    console.error('Content script: Error in refresh()', e);
  }
}

// Listen for messages (from popup)
chrome.runtime.onMessage.addListener((msg, sender, resp) => {
  console.log('Content script: Received message', msg);
  if (msg.action === 'update-active-groups') { 
    // Expect msg.activeGroups to be an object like { groupName: boolean, ... }
    activeGroups = msg.activeGroups || {}; 
    useSyncStore = !!msg.useSyncStorage;
    console.log('Content script: Processing update-active-groups from popup:', activeGroups);
    
    if (manager) manager.clearMarkers(); 
    
    // Refresh POIs based on the new active groups
    refresh().then(() => {
        console.log(`Content script: Processed active groups update. Final active groups: ${Object.keys(activeGroups).filter(key => activeGroups[key]).join(', ') || 'NONE'}`);
        resp({ status: 'ok', processed_groups: Object.keys(activeGroups).filter(key => activeGroups[key]).length });
    }).catch(err => console.error("Content script: Error processing group updates:", err));

  } else if (msg.action === 'refresh-pois') { 
    console.log("Content script: Received explicit refresh-pois message.");
    refresh();
    resp({ status: 'ok' });
  }
  return true; // Indicate that the response is asynchronous
});

// --- DETECT FUNCTION DEFINITION ---
// Moved detect function definition to be hoisted before its usage in setInterval
function detect() {
  // 1. Redfin specific map containers
  const redfinMapContainer = document.querySelector('.searchMapContainer, .MapContainer, .InteractiveMap, .Map, #map');
  if (redfinMapContainer && redfinMapContainer.offsetHeight > 100) return redfinMapContainer;

  // 2. Generic Google Maps container
  const gm = document.querySelector('.gm-style');
  if (gm) return gm.parentElement;
  
  // 3. Mapbox container
  const mb = document.querySelector('.mapboxgl-canvas');
  if (mb) return mb.parentElement;

  // 4. Iframe Fallback
  const mapPatterns = [/maps\.google\.com/, /zillow\.com\/maps/, /redfin\.com\/map/];
  const iframes = document.querySelectorAll('iframe');
  for (const f of iframes) {
    if (mapPatterns.some(p => p.test(f.src))) return f;
  }
  return null;
}
// --- END DETECT FUNCTION DEFINITION ---


// Re-detection loop
setInterval(() => {
  if (!manager || !manager.container.isConnected) {
    const d = detect(); // Call to detect()
    if (d) {
       console.log(`Content script: Detected map container, initializing manager.`);
       // Pass the detected container element itself to OverlayManager
       manager = new OverlayManager(d.el || d); // Ensure 'd' is the element
       refresh();
    }
  } else {
    // Ensure sync is called regularly to keep overlay positioned and update debug info
    manager.sync();
  }
}, 3000);


// Initial refresh on content script load
refresh();
