// Content script for Map POI Injector (Restored working Overlay version)

console.log('%c POI Injector: Overlay script starting...', 'background: #222; color: #3498db');

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
    const existing = document.getElementById('poi-overlay');
    if (existing) existing.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'poi-overlay';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 2147483647; background: transparent;
      border: 3px dashed rgba(255, 0, 0, 0.4); box-sizing: border-box;
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
    panel.innerHTML = `
      <b style="color:#fff; border-bottom:1px solid #0f0; display:block; margin-bottom:5px;">POI INJECTOR DEBUG</b>
      STATUS: <span style="color:#0f0">OVERLAY ACTIVE</span><br>
      POIS LOADED: ${this.markerData.length}<br>
      ${b ? `LAT: ${b.south.toFixed(4)} to ${b.north.toFixed(4)}<br>LNG: ${b.west.toFixed(4)} to ${b.east.toFixed(4)}` : 'BOUNDS: N/A'}
    `;
  }

  sync() {
    if (!this.overlay) return;
    const rect = this.container.getBoundingClientRect();
    this.overlay.style.width = rect.width + 'px';
    this.overlay.style.height = rect.height + 'px';
    if (this.container.tagName === 'IFRAME') {
      this.overlay.style.top = this.container.offsetTop + 'px';
      this.overlay.style.left = this.container.offsetLeft + 'px';
    }
    this.viewportBounds = { width: rect.width, height: rect.height };
    this.updateBoundsFromUrl();
  }

  updateBoundsFromUrl() {
    const match = window.location.href.match(/searchQueryState=([^&]+)/);
    if (match) {
      try {
        const state = JSON.parse(decodeURIComponent(match[1]));
        if (state.mapBounds) {
          this.mapBounds = state.mapBounds;
          this.render();
        }
      } catch (e) {}
    }
  }

  load(pois) {
    this.markerData = pois;
    this.render();
  }

  render() {
    if (!this.overlay || !this.mapBounds || !this.markerData.length) {
      this.updateDebug();
      return;
    }

    const panel = document.getElementById('poi-debug-panel');
    this.overlay.innerHTML = '';
    if (panel) this.overlay.appendChild(panel);

    const b = this.mapBounds;
    const w = this.viewportBounds.width;
    const h = this.viewportBounds.height;

    this.markerData.forEach(poi => {
      const lat = parseFloat(poi.latitude);
      const lng = parseFloat(poi.longitude);
      
      if (lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east) {
        const x = ((lng - b.west) / (b.east - b.west)) * w;
        const y = ((b.north - lat) / (b.north - b.south)) * h;

        const pin = document.createElement('div');
        pin.style.cssText = `
          position: absolute; left: ${x}px; top: ${y}px; width: 30px; height: 30px;
          background: red; border: 2px solid white; border-radius: 50%;
          transform: translate(-50%, -100%); pointer-events: auto; cursor: pointer;
          box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        `;
        pin.title = poi.name;
        pin.onclick = () => alert(poi.name);
        this.overlay.appendChild(pin);
      }
    });
    this.updateDebug();
  }
}

// --- ORCHESTRATION ---
let manager = null;

function detect() {
  const mapPatterns = [/maps\.google\.com/, /zillow\.com\/maps/, /redfin\.com\/map/];
  const iframes = document.querySelectorAll('iframe');
  for (const f of iframes) {
    if (mapPatterns.some(p => p.test(f.src))) return f;
  }
  return document.querySelector('.gm-style')?.parentElement || document.querySelector('#map, .map, [class*="MapContainer"]');
}

async function refresh() {
  const state = await chrome.storage.local.get(['activeGroup', 'storageType']);
  const activeGroup = state.activeGroup;
  if (!activeGroup) return;

  const store = state.storageType === 'sync' ? chrome.storage.sync : chrome.storage.local;
  const data = await store.get(['poiGroups']);
  const pois = data.poiGroups?.[activeGroup] || [];
  
  if (manager) manager.load(pois);
}

setInterval(() => {
  if (!manager) {
    const c = detect();
    if (c) {
      manager = new OverlayManager(c);
      refresh();
    }
  } else {
    manager.sync();
  }
}, 2000);

chrome.runtime.onMessage.addListener((msg, sender, resp) => {
  if (msg.action === 'refresh-pois') refresh();
});

refresh();
