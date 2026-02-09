/**
 * POI Injector Overlay Module
 * Handles the debug panel and marker data tracking.
 * Pin rendering is handled exclusively by the bridge (native map markers).
 */

const getEffectiveHost = () => {
  if (window.top === window) return window.location.hostname;
  try {
    if (document.referrer) return new URL(document.referrer).hostname;
  } catch (e) {}
  return window.location.hostname;
};

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
    this.activePopupData = null;
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
      box-sizing: border-box; overflow: hidden;
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
      display: none;
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
    const host = getEffectiveHost();
    const sitePref = pref.sitePreferences?.[host] || {};
    const siteEnabled = (typeof sitePref.siteEnabled === 'boolean')
      ? sitePref.siteEnabled
      : (typeof sitePref.overlayEnabled === 'boolean' ? sitePref.overlayEnabled : true);
    
    this.overlay.style.display = siteEnabled ? 'block' : 'none';
    this.debugPanel.style.display = (siteEnabled && pref.debugEnabled) ? 'block' : 'none';
    
    this.debugPanel.style.color = pref.accentColor;
    this.debugPanel.style.borderColor = pref.accentColor;
  }

  updateDebug() {
    if (!this.debugPanel || !window.poiState.preferences.debugEnabled) return;
    const state = window.poiState;
    const b = this.mapBounds;
    const active = Object.keys(state.activeGroups).filter(k => state.activeGroups[k]).join(', ') || 'NONE';
    
    const bridgeStatus = document.documentElement.getAttribute('data-poi-bridge-status') || 'OFFLINE';
    const attrType = document.documentElement.getAttribute('data-poi-map-type');
    const type = (attrType && attrType !== 'none') ? attrType : 'searching...';

    this.debugPanel.innerHTML = `
      <b style="color:#fff; border-bottom:1px solid ${state.preferences.accentColor}; display:block; margin-bottom:5px;">Shullow (v12.10)</b>
      STATUS: <span style="color:${state.preferences.accentColor}">ACTIVE</span><br>
      BRIDGE: <span style="color:${bridgeStatus === 'OFFLINE' ? 'red' : 'green'}">${bridgeStatus}</span><br>
      PROBE: <span style="color:#f39c12">${type}</span><br>
      GRP: <span style="color:#fff">${active}</span><br>
      ${b ? `LAT: ${b.south.toFixed(4)} to ${b.north.toFixed(4)}<br>LNG: ${b.west.toFixed(4)} to ${b.east.toFixed(4)}` : 'BOUNDS: <span style="color:red">N/A</span>'}
    `;
  }

  destroy() {
    this.hidePopup();
    if (this.resizeObserver) this.resizeObserver.disconnect();
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
    if (state && state.globalBounds && (Date.now() - state.lastMessageTime < 5000)) {
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
      this.updatePopupPosition();
      this.updateDebug();
      return;
    }
    this.mapBounds = b;
    this.lastBoundsJson = json;
    this.updatePopupPosition();
    this.updateDebug();
  }

  load(pois) {
    this.markerData = pois;
    this.updateDebug();
  }

  clearMarkers() {
    this.markerData = [];
    this.updateDebug();
  }

  removeMarkersForGroup(groupUuid) {
    this.markerData = this.markerData.filter(p => p.groupUuid !== groupUuid);
    this.updateDebug();
  }

  // Pin rendering is handled by the bridge (native map markers).
  // render() updates the debug panel and repositions any active popup.
  render() {
    this.updatePopupPosition();
    this.updateDebug();
  }

  /**
   * Update popup position based on current map bounds.
   * Uses Mercator projection to convert lat/lng → pixel coordinates.
   */
  updatePopupPosition() {
    if (!this.activePopup || !this.activePopupData || !this.mapBounds || !this.viewportBounds) return;

    const b = this.mapBounds;
    const w = this.viewportBounds.width;
    const h = this.viewportBounds.height;

    const projectY = (lat) => {
      const sin = Math.sin(lat * Math.PI / 180);
      return Math.log((1 + sin) / (1 - sin)) / 2;
    };

    const minLatProj = projectY(b.south);
    const maxLatProj = projectY(b.north);

    const pLat = parseFloat(this.activePopupData.poi.latitude);
    const pLng = parseFloat(this.activePopupData.poi.longitude);

    if (pLat >= b.south && pLat <= b.north && pLng >= b.west && pLng <= b.east) {
      const px = ((pLng - b.west) / (b.east - b.west)) * w;
      const pLatProj = projectY(pLat);
      const py = ((maxLatProj - pLatProj) / (maxLatProj - minLatProj)) * h;

      this.activePopup.style.left = `${px}px`;
      this.activePopup.style.top = `${py - 42}px`;
    } else {
      this.hidePopup();
    }
  }

  /**
   * Handles native marker click from bridge.
   * Shows a detail popup for the clicked POI.
   */
  handleNativeClick(id, lat, lng) {
    const poi = this.markerData.find(p => (p.id || p.name) === id);
    if (poi) {
      const pref = window.poiState.preferences;
      const style = pref.groupStyles[poi.groupUuid] || {};
      const color = style.color || pref.accentColor || '#ff0000';

      this.showPopup(poi, 0, 0, color);
      this.updatePopupPosition();
    }
  }

  /**
   * Handles native marker hover from bridge.
   * Shows a detail popup after a brief delay to prevent flicker.
   */
  handleNativeHover(id, lat, lng) {
    const poi = this.markerData.find(p => (p.id || p.name) === id);
    if (poi) {
      if (this.hoverTimeout) clearTimeout(this.hoverTimeout);

      const pref = window.poiState.preferences;
      const style = pref.groupStyles[poi.groupUuid] || {};
      const color = style.color || pref.accentColor || '#ff0000';

      this.hoverTimeout = setTimeout(() => {
        this.showPopup(poi, 0, 0, color);
        this.updatePopupPosition();
      }, 100);
    }
  }

  /**
   * Handles native marker leave (mouse out) from bridge.
   * Hides popup after a brief delay (allows hovering onto the popup itself).
   */
  handleNativeLeave(id) {
    if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    this.hoverTimeout = setTimeout(() => { this.hidePopup(); }, 300);
  }

  /**
   * Creates and displays a detail popup for a POI.
   */
  showPopup(poi, x, y, color) {
    this.hidePopup();

    this.activePopupData = { poi, color };

    this.activePopup = document.createElement('div');
    this.activePopup.className = 'poi-detail-popup';
    this.activePopup.style.cssText = `
      position: absolute; left: ${x}px; top: ${y - 42}px; transform: translate(-50%, -100%);
      background: rgba(0, 0, 0, 0.95); color: #ffffff; font-family: monospace; font-size: 12px;
      border: 1px solid ${color}; padding: 10px; z-index: 2147483647; pointer-events: auto;
      white-space: normal; width: max-content; max-width: 250px; cursor: default;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5), 0 0 10px ${color}44; border-radius: 4px;
      transition: top 0.1s linear, left 0.1s linear;
    `;

    // Allow hovering popup to keep it open
    this.activePopup.onmouseenter = () => {
      if (this.hoverTimeout) clearTimeout(this.hoverTimeout);
    };
    this.activePopup.onmouseleave = () => {
      this.hidePopup();
    };

    this.activePopup.innerHTML = `
      <div style="font-weight: bold; border-bottom: 1px solid ${color}; margin-bottom: 6px; padding-bottom: 4px; color: #ffffff !important;">${poi.name}</div>
      <div style="font-size: 10px; opacity: 0.9; color: #cccccc !important;">GROUP: ${poi.groupName.toUpperCase()}</div>
      <div style="font-size: 11px; margin-top: 6px; line-height: 1.3; color: #ffffff !important;">${poi.address || 'No address available'}</div>
      ${Object.entries(poi)
        .filter(([k, v]) => !['name', 'groupName', 'groupUuid', 'address', 'latitude', 'longitude', 'id', 'color', 'secondaryColor', 'logoData'].includes(k) && v !== null && v !== undefined && String(v).trim() !== '')
        .map(([k, v]) => `<div style="font-size: 9px; opacity: 0.7; margin-top: 2px; color: #dddddd !important;">${k.toUpperCase()}: ${v}</div>`)
        .join('')}
    `;
    this.overlay.appendChild(this.activePopup);
  }

  /**
   * Hides the currently active popup and cleans up timers.
   */
  hidePopup() {
    if (this.activePopup) {
      this.activePopup.remove();
      this.activePopup = null;
      this.activePopupData = null;
    }
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
  }
}

window.OverlayManager = OverlayManager;