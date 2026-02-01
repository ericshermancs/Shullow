/**
 * POI Injector State Module
 * Manages preferences, active groups, and coordinate state.
 * 
 * Converted to OOP class for better encapsulation and lifecycle management.
 * Note: This is a content script, so we use a simpler class pattern
 * (not extending ManagerBase which is in the bridge world).
 */

/**
 * POIStateManager - Manages extension state for content scripts
 * 
 * Features:
 * - Chrome storage sync
 * - Active group management
 * - Preferences management
 * - POI data refresh
 */
class POIStateManager {
  constructor() {
    // Singleton pattern
    if (POIStateManager.instance) {
      return POIStateManager.instance;
    }
    POIStateManager.instance = this;

    this._activeGroups = {};
    this._preferences = {
      overlayEnabled: true,
      debugEnabled: false,
      sitePreferences: {},
      groupStyles: {},
      accentColor: '#d1ff00'
    };
    this._nativeMode = false;
    this._globalBounds = null;
    this._globalMethod = 'searching...';
    this._lastMessageTime = 0;
    this._initialized = false;
  }

  // Getters and Setters for backwards compatibility
  get activeGroups() { return this._activeGroups; }
  set activeGroups(val) { this._activeGroups = val; }

  get preferences() { return this._preferences; }
  set preferences(val) { this._preferences = val; }

  get nativeMode() { return this._nativeMode; }
  set nativeMode(val) { this._nativeMode = val; }

  get globalBounds() { return this._globalBounds; }
  set globalBounds(val) { this._globalBounds = val; }

  get globalMethod() { return this._globalMethod; }
  set globalMethod(val) { this._globalMethod = val; }

  get lastMessageTime() { return this._lastMessageTime; }
  set lastMessageTime(val) { this._lastMessageTime = val; }

  /**
   * Initializes state from Chrome storage
   * @returns {Promise<void>}
   */
  async initializeState() {
    if (this._initialized) return;

    try {
      const state = await chrome.storage.local.get(['activeGroups', 'preferences']);
      if (state.activeGroups) this._activeGroups = state.activeGroups;
      if (state.preferences) this._preferences = { ...this._preferences, ...state.preferences };
      if (window.manager) { 
        window.manager.updateVisibility(); 
        window.manager.render(); 
      }
      this._initialized = true;
    } catch (e) {
      console.error('POI State: Initialization failed', e);
    }
  }

  /**
   * Loads state from Chrome storage
   * Alias for initializeState for API compatibility with ManagerBase
   * @returns {Promise<void>}
   */
  async loadFromStorage() {
    return this.initializeState();
  }

  /**
   * Gets the active groups as an array
   * @returns {Array} Array of active group names
   */
  getActiveGroups() {
    return Object.keys(this._activeGroups).filter(k => this._activeGroups[k]);
  }

  /**
   * Sets a preference value
   * @param {string} key - Preference key
   * @param {any} value - Preference value
   */
  setPreference(key, value) {
    this._preferences[key] = value;
    this.sync();
  }

  /**
   * Syncs state to Chrome storage
   * @returns {Promise<void>}
   */
  async sync() {
    try {
      await chrome.storage.local.set({
        activeGroups: this._activeGroups,
        preferences: this._preferences
      });
    } catch (e) {
      console.error('POI State: Sync failed', e);
    }
  }

  /**
   * Refreshes POI data from storage and updates the manager
   * @returns {Promise<void>}
   */
  async refresh() {
    try {
      const state = await chrome.storage.local.get(['activeGroups', 'preferences']);
      this._activeGroups = state.activeGroups || {}; 
      this._preferences = { ...this._preferences, ...(state.preferences || {}) };

      if (window.manager) {
        window.manager.updateVisibility();
      }

      const selected = Object.keys(this._activeGroups).filter(k => this._activeGroups[k]);
      if (selected.length === 0) { 
        if (window.manager) {
          window.manager.markerData = [];
          window.manager.render(); 
        }
        return; 
      }
      
      const data = await chrome.storage.local.get(['poiGroups']);
      const all = [];
      selected.forEach(g => {
        const groupPois = (data.poiGroups?.[g] || []).map(p => ({ ...p, groupName: g }));
        all.push(...groupPois);
      });
      if (window.manager) window.manager.load(all);
      
      // Bridge Sync: Send POI data to the main world for native rendering
      window.postMessage({
        type: 'POI_DATA_UPDATE',
        pois: all.map(p => {
          const style = this._preferences.groupStyles[p.groupName] || {};
          return {
            id: p.id,
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude,
            color: style.color || this._preferences.accentColor,
            secondaryColor: style.secondaryColor || '#ffffff',
            logoData: style.logoData // Send logo URL/SVG
          };
        })
      }, '*');
    } catch (e) {
      console.error('POI State: Refresh failed', e);
    }
  }

  /**
   * Cleanup (for API compatibility with ManagerBase)
   */
  cleanup() {
    this._activeGroups = {};
    this._initialized = false;
  }
}

// Create singleton instance and export to global scope
const stateManager = new POIStateManager();
window.poiState = stateManager;
