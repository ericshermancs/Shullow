/**
 * POI Injector Overlay Module
 * Handles visual rendering of pins, popups, and the debug panel.
 */
const getPinSvg = (color = '#ff0000', secondaryColor = '#ffffff') => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${color}" stroke="${secondaryColor}" stroke-width="1"/>
</svg>
`)}`;

class OverlayManager {
  constructor(container) {
    this.container = container;
    this.overlay = null;
    this.debugPanel = null;
    this.markerData = [];
    this.mapBounds = null;
    this.viewportBounds = null;
    this.lastBoundsJson = null;
    this.resizeObserver = null;
    this.hoverTimeout = null;
    this.activePopup = null;
    this.initialize();
  }

  initialize() {
    console.log('POI Overlay: Initializing on', this.container);
    
    const existingOverlay = document.getElementById('poi-overlay');
    if (existingOverlay) existingOverlay.remove();

    this.overlay = document.createElement('div');
    this.overlay.id = 'poi-overlay';
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 2147483646; background: transparent;
      border: 3px dashed rgba(255, 0, 0, 0.1); box-sizing: border-box;
      overflow: hidden;
    `;
    
    const existingDebug = document.getElementById('poi-debug-panel');
    if (existingDebug) existingDebug.remove();

    this.debugPanel = document.createElement('div');
    this.debugPanel.id = 'poi-debug-panel';
    this.debugPanel.style.cssText = `
      position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.85);
      font-family: monospace; font-size: 11px; padding: 12px;
      border-radius: 6px; pointer-events: auto; z-index: 2147483647;
      border: 1px solid ${window.poiState.preferences.accentColor}; line-height: 1.5;
    `;
    
    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
    
    this.container.appendChild(this.overlay);
    this.container.appendChild(this.debugPanel);

    this.updateVisibility();
    this.sync();
    
    this.resizeObserver = new ResizeObserver(() => this.sync());
    this.resizeObserver.observe(this.container);
  }

  updateVisibility() {
    if (!this.overlay || !this.debugPanel) return;
    const pref = window.poiState.preferences;
    const host = window.location.hostname;
    const sitePref = pref.sitePreferences?.[host] || { overlayEnabled: true };
    
    this.overlay.style.display = sitePref.overlayEnabled ? 'block' : 'none';
    this.debugPanel.style.display = pref.debugEnabled ? 'block' : 'none';
    
    this.debugPanel.style.color = pref.accentColor;
    this.debugPanel.style.borderColor = pref.accentColor;
  }

  updateDebug() {
    if (!this.debugPanel || !window.poiState.preferences.debugEnabled) return;
    const state = window.poiState;
    const b = this.mapBounds;
    const active = Object.keys(state.activeGroups).filter(k => state.activeGroups[k]).join(', ') || 'NONE';
    
    const isPortalLive = (Date.now() - state.lastMessageTime < 5000);
    const source = isPortalLive ? 'PORTAL-LIVE' : 'LOCAL-SCRAPE';
    
    const bridgeStatus = document.documentElement.getAttribute('data-poi-bridge-status') || 'OFFLINE';
    const attrType = document.documentElement.getAttribute('data-poi-map-type');
    
    const type = (isPortalLive) ? state.globalMethod : ((attrType && attrType !== 'none') ? attrType : 'searching...');

    this.debugPanel.innerHTML = `
      <b style="color:#fff; border-bottom:1px solid ${state.preferences.accentColor}; display:block; margin-bottom:5px;">POI TITAN (v12.10)</b>
      STATUS: <span style="color:${state.preferences.accentColor}">ACTIVE</span><br>
      BRIDGE: <span style="color:${bridgeStatus === 'OFFLINE' ? 'red' : 'green'}">${bridgeStatus}</span><br>
      SOURCE: <span style="color:#3498db">${source}</span><br>
      PROBE: <span style="color:#f39c12">${type}</span><br>
      GRP: <span style="color:#fff">${active}</span><br>
      ${b ? `LAT: ${b.south.toFixed(4)} to ${b.north.toFixed(4)}<br>LNG: ${b.west.toFixed(4)} to ${b.east.toFixed(4)}` : 'BOUNDS: <span style="color:red">N/A</span>'}
    `;
  }

  destroy() {
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.hidePopup();
    if (this.overlay) this.overlay.remove();
    if (this.debugPanel) this.debugPanel.remove();
  }

  sync() {
    if (!this.overlay || !this.container.isConnected) return;
    const rect = this.container.getBoundingClientRect();
    this.viewportBounds = { width: rect.width, height: rect.height };
    this.extractBounds();
  }

  extractBounds() {
    const state = window.poiState;
    if (state.globalBounds && (Date.now() - state.lastMessageTime < 5000)) {
        this.updateMapBounds(state.globalBounds);
        return;
    }
    const b = MapDetector.extractBounds(this.container);
    if (b) this.updateMapBounds(b);
    else this.updateDebug();
  }

  updateMapBounds(b) {
    const json = JSON.stringify(b);
    if (json === this.lastBoundsJson) {
      this.updateDebug();
      return;
    }
    this.mapBounds = b;
    this.lastBoundsJson = json;
    this.render();
  }

  load(pois) { this.markerData = pois; this.render(); }

  clearMarkers() {
    if (this.overlay) {
      this.overlay.querySelectorAll('.poi-marker-overlay').forEach(m => m.remove());
      this.markerData = [];
      this.hidePopup();
      this.updateDebug();
    }
  }

  showPopup(poi, x, y, color) {
    this.hidePopup();
    
    this.activePopup = document.createElement('div');
    this.activePopup.className = 'poi-detail-popup';
    this.activePopup.style.cssText = `
      position: absolute; left: ${x}px; top: ${y - 42}px; transform: translate(-50%, -100%);
      background: rgba(0, 0, 0, 0.95); color: ${color}; font-family: monospace; font-size: 12px;
      border: 1px solid ${color}; padding: 10px; z-index: 2147483647; pointer-events: none;
      white-space: normal; width: max-content; max-width: 250px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5), 0 0 10px ${color}44; border-radius: 4px;
    `;
    this.activePopup.innerHTML = `
      <div style="font-weight: bold; border-bottom: 1px solid ${color}; margin-bottom: 6px; padding-bottom: 4px; color: #fff;">${poi.name}</div>
      <div style="font-size: 10px; opacity: 0.9;">GROUP: ${poi.groupName.toUpperCase()}</div>
      <div style="font-size: 11px; margin-top: 6px; line-height: 1.3; color: ${color};">${poi.address || 'No address available'}</div>
      ${Object.entries(poi).filter(([k]) => !['name', 'groupName', 'address', 'latitude', 'longitude'].includes(k)).map(([k,v]) => 
        `<div style="font-size: 9px; opacity: 0.7; margin-top: 2px;">${k.toUpperCase()}: ${v}</div>`
      ).join('')}
    `;
    this.overlay.appendChild(this.activePopup);
  }

  hidePopup() {
    if (this.activePopup) { this.activePopup.remove(); this.activePopup = null; }
    if (this.hoverTimeout) { clearTimeout(this.hoverTimeout); this.hoverTimeout = null; }
  }

  render() {
    if (!this.overlay || !this.mapBounds || !this.viewportBounds) return;
    this.overlay.querySelectorAll('.poi-marker-overlay').forEach(m => m.remove());
    this.hidePopup();
    const pref = window.poiState.preferences;
    const host = window.location.hostname;
    const sitePref = pref.sitePreferences?.[host] || { overlayEnabled: true };
    if (!sitePref.overlayEnabled) { this.updateDebug(); return; }
    const b = this.mapBounds;
    const w = this.viewportBounds.width;
    const h = this.viewportBounds.height;
    const projectY = (lat) => {
      const sin = Math.sin(lat * Math.PI / 180);
      return Math.log((1 + sin) / (1 - sin)) / 2;
    };
    const minLatProj = projectY(b.south);
    const maxLatProj = projectY(b.north);
    this.markerData.forEach(poi => {
      const lat = parseFloat(poi.latitude);
      const lng = parseFloat(poi.longitude);
      if (lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east) {
        const x = ((lng - b.west) / (b.east - b.west)) * w;
        const latProj = projectY(lat);
        const y = ((maxLatProj - latProj) / (maxLatProj - minLatProj)) * h;
        const pin = document.createElement('div');
        pin.className = 'poi-marker-overlay';
        const style = pref.groupStyles[poi.groupName] || {};
        const color = style.color || pref.accentColor || '#ff0000';
        const secondaryColor = style.secondaryColor || '#ffffff';
        const logo = style.logoData;
        pin.style.cssText = `
          position: absolute; left: ${x}px; top: ${y}px; width: 32px; height: 32px;
          background-image: url('${logo || getPinSvg(color, secondaryColor)}');
          background-size: contain; background-repeat: no-repeat;
          transform: translate(-50%, -100%); pointer-events: auto; cursor: pointer;
          filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4)); z-index: 1000;
        `;
        pin.onmouseenter = () => { this.hoverTimeout = setTimeout(() => { this.showPopup(poi, x, y, color); }, 100); };
        pin.onmouseleave = () => { this.hidePopup(); };
        pin.onclick = (e) => { e.stopPropagation(); window.postMessage({ type: 'POI_CENTER_MAP', lat, lng }, '*'); };
        this.overlay.appendChild(pin);
      }
    });
    this.updateDebug();
  }
}

window.OverlayManager = OverlayManager;
