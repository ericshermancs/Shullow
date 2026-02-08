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
    this._initialized = false;
    
    // Cache for POI data to avoid slow storage reads
    this._poiCache = null;
    this._poiCacheTime = 0;
    
    // Track last active groups to detect changes
    this._lastActiveGroups = {};
    
    // Flag to skip redundant storage reads when message listener just updated
    this._skipStorageRead = false;
    
    // Flag to prevent concurrent refreshes
    this._isRefreshing = false;
    
    // Track last POIs sent to bridge for quick filtering
    this._bridgeLastPois = [];

    // Bridge state (set by events.js from bridge messages)
    this._globalBounds = null;
    this._globalMethod = 'searching...';
    this._lastMessageTime = 0;
  }

  // Getters and Setters for backwards compatibility
  get activeGroups() { return this._activeGroups; }
  set activeGroups(val) { this._activeGroups = val; }

  get preferences() { return this._preferences; }
  set preferences(val) { this._preferences = val; }

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

    if (this._isRefreshing) return;
    
    this._isRefreshing = true;
    try {
      console.log(`[STATE] refresh() START`);
      
      // Update state from storage if needed
      if (!this._skipStorageRead) {
        const state = await chrome.storage.local.get(['activeGroups', 'preferences']);
        if (state.activeGroups) this._activeGroups = state.activeGroups;
        if (state.preferences) this._preferences = { ...this._preferences, ...state.preferences };
      }
      this._skipStorageRead = false;

      // Update manager visibility
      window.manager?.updateVisibility();

      const selected = Object.keys(this._activeGroups).filter(k => this._activeGroups[k]);
      const lastSelected = Object.keys(this._lastActiveGroups).filter(k => this._lastActiveGroups[k]);
      const removed = lastSelected.filter(g => !selected.includes(g));
      
      console.log(`[STATE] refresh(): selected=${JSON.stringify(selected)}, lastSelected=${JSON.stringify(lastSelected)}, removed=${JSON.stringify(removed)}, activeGroups=${JSON.stringify(this._activeGroups)}`);
      
      // Handle empty selection - clear all
      if (selected.length === 0) {
        console.log('[STATE] No active groups selected, clearing all POIs');
        this._clearAllPOIs();
        this._lastActiveGroups = { ...this._activeGroups };
        return;
      }
      
      // Optimization: If only removing groups, filter instead of rebuild
      if (removed.length > 0 && selected.length > 0) {
        this._filterPOIsForRemovedGroups(removed);
        this._lastActiveGroups = { ...this._activeGroups };
        return;
      }
      
      // Full rebuild for new groups
      await this._rebuildAllPOIs(selected);
      this._lastActiveGroups = { ...this._activeGroups };
    } finally {
      this._isRefreshing = false;
    }
  }


  /**
   * Clears all POI markers and notifies bridge
   * @private
   */
  _clearAllPOIs() {
    if (window.manager) {
      window.manager.markerData = [];
      window.manager.render();
    }
    window.postMessage({ type: 'POI_DATA_UPDATE', pois: [] }, '*');
  }

  /**
   * Filters POIs by removing groups from existing data
   * @private
   */
  _filterPOIsForRemovedGroups(removed) {
    const bridgeFiltered = (this._bridgeLastPois || []).filter(p => !removed.includes(p.groupName));
    
    if (window.manager?.markerData.length > 0) {
      removed.forEach(group => window.manager?.removeMarkersForGroup(group));
      window.manager.markerData = window.manager.markerData.filter(p => !removed.includes(p.groupName));
    }
    
    window.postMessage({ type: 'POI_DATA_UPDATE', pois: bridgeFiltered }, '*');
    this._bridgeLastPois = bridgeFiltered;
  }

  /**
   * Rebuilds POI data for selected groups
   * @private
   */
  async _rebuildAllPOIs(selected) {
    const poiGroups = await this._getPoiGroups();
    const all = [];
    const bridgePois = [];
    
    selected.forEach(g => {
      const groupPois = poiGroups[g] || [];
      const style = this._preferences.groupStyles[g] || {};
      const color = style.color || this._preferences.accentColor;
      const secondaryColor = style.secondaryColor || '#ffffff';
      const logoData = style.logoData;
      
      groupPois.forEach(p => {
        all.push({ ...p, groupName: g });
        bridgePois.push({
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          color,
          secondaryColor,
          logoData
        });
      });
    });
    
    window.manager?.load(all);
    window.postMessage({ type: 'POI_DATA_UPDATE', pois: bridgePois }, '*');
    console.log(`[STATE] Bridge update sent: ${bridgePois.length} POIs`);
    this._bridgeLastPois = bridgePois;
  }

  /**
   * Gets POI groups from cache or storage
   * @private
   */
  async _getPoiGroups() {
    const cacheAge = Date.now() - this._poiCacheTime;
    if (this._poiCache && cacheAge < 60000) {
      return this._poiCache;
    }
    
    const data = await chrome.storage.local.get(['poiGroups']);
    const poiGroups = data.poiGroups || {};
    this._poiCache = poiGroups;
    this._poiCacheTime = Date.now();
    return poiGroups;
  }

  /**
   * Cleanup (for API compatibility with ManagerBase)
   */
  cleanup() {
    this._activeGroups = {};
    this._initialized = false;
  }
}

// Export class to global scope without instantiating (lazy init)
if (typeof window !== 'undefined') {
  window.POIStateManager = POIStateManager;
  window.getPoiStateManager = () => {
    if (!window.poiState) {
      window.poiState = new POIStateManager();
    }
    return window.poiState;
  };
}
