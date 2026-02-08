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
      <b style="color:#fff; border-bottom:1px solid ${state.preferences.accentColor}; display:block; margin-bottom:5px;">POI TITAN (v12.10)</b>
      STATUS: <span style="color:${state.preferences.accentColor}">ACTIVE</span><br>
      BRIDGE: <span style="color:${bridgeStatus === 'OFFLINE' ? 'red' : 'green'}">${bridgeStatus}</span><br>
      PROBE: <span style="color:#f39c12">${type}</span><br>
      GRP: <span style="color:#fff">${active}</span><br>
      ${b ? `LAT: ${b.south.toFixed(4)} to ${b.north.toFixed(4)}<br>LNG: ${b.west.toFixed(4)} to ${b.east.toFixed(4)}` : 'BOUNDS: <span style="color:red">N/A</span>'}
    `;
  }

  destroy() {
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
      this.updateDebug();
      return;
    }
    this.mapBounds = b;
    this.lastBoundsJson = json;
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

  removeMarkersForGroup(groupName) {
    this.markerData = this.markerData.filter(p => p.groupName !== groupName);
    this.updateDebug();
  }

  // Pin rendering is handled by the bridge (native map markers).
  // render() only updates the debug panel.
  render() {
    this.updateDebug();
  }

  /**
   * Handles native marker click from bridge
   */
  handleNativeClick(id, lat, lng) {
    console.log('[OverlayManager] Native click:', id, lat, lng);
    // Find the POI data
    const poi = this.markerData.find(p => p.id === id || p.name === id);
    if (poi) {
      // Could show a popup/info window here in the future
      console.log('[OverlayManager] POI clicked:', poi);
    }
  }

  /**
   * Handles native marker hover from bridge
   */
  handleNativeHover(id, lat, lng) {
    console.log('[OverlayManager] Native hover:', id, lat, lng);
    // Find the POI data
    const poi = this.markerData.find(p => p.id === id || p.name === id);
    if (poi) {
      // Could show a tooltip here in the future
      console.log('[OverlayManager] POI hovered:', poi);
    }
  }

  /**
   * Handles native marker leave (mouse out) from bridge
   */
  handleNativeLeave(id) {
    console.log('[OverlayManager] Native leave:', id);
    // Could hide tooltip here in the future
  }
}

window.OverlayManager = OverlayManager;