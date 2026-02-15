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
        try {
          const state = await chrome.storage.local.get(['activeGroups', 'preferences']);
          if (state.activeGroups) this._activeGroups = state.activeGroups;
          if (state.preferences) this._preferences = { ...this._preferences, ...state.preferences };
        } catch (e) {
          // Extension context invalidated (reload/update) - use cached state
          console.warn('[STATE] Extension context invalidated, using cached state');
        }
      }
      this._skipStorageRead = false;

      // Update manager visibility
      window.manager?.updateVisibility();

      // Check if site is disabled — if so, clear all POIs from bridge + manager
      const host = window.location.hostname;
      const sitePref = this._preferences.sitePreferences?.[host] || {};
      const siteEnabled = (typeof sitePref.siteEnabled === 'boolean')
        ? sitePref.siteEnabled
        : (typeof sitePref.overlayEnabled === 'boolean' ? sitePref.overlayEnabled : true);

      if (!siteEnabled) {
        console.log('[STATE] Site is disabled, clearing all POIs');
        this._clearAllPOIs();
        // Reset lastActiveGroups and clear cache so when site is re-enabled, all groups are rebuilt fresh
        this._lastActiveGroups = {};
        this._poiCache = null;
        this._poiCacheTime = 0;
        return;
      }

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
      
      // Check if site was just re-enabled: lastSelected was empty but selected is not
      const wasDisabled = lastSelected.length === 0 && selected.length > 0;
      
      // Optimization: If only removing groups, filter instead of rebuild
      if (!wasDisabled && removed.length > 0 && selected.length > 0) {
        this._filterPOIsForRemovedGroups(removed);
        this._lastActiveGroups = { ...this._activeGroups };
        return;
      }
      
      // Full rebuild for new groups or when re-enabled
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
    const bridgeFiltered = (this._bridgeLastPois || []).filter(p => !removed.includes(p.groupUuid));
    
    if (window.manager?.markerData.length > 0) {
      removed.forEach(uuid => window.manager?.removeMarkersForGroup(uuid));
      window.manager.markerData = window.manager.markerData.filter(p => !removed.includes(p.groupUuid));
    }
    
    window.postMessage({ type: 'POI_DATA_UPDATE', pois: bridgeFiltered }, '*');
    this._bridgeLastPois = bridgeFiltered;
  }

  /**
   * Rebuilds POI data for selected groups
   * @private
   */
  async _rebuildAllPOIs(selected) {
    console.log('[STATE] _rebuildAllPOIs() called with selected:', selected);
    const poiGroups = await this._getPoiGroups();
    console.log('[STATE] _rebuildAllPOIs() got poiGroups with keys:', Object.keys(poiGroups));
    const all = [];
    const bridgePois = [];
    
    selected.forEach(uuid => {
      const group = poiGroups[uuid];
      console.log(`[STATE] _rebuildAllPOIs() looking for uuid=${uuid}, found?:`, !!group);
      if (!group) return;
      
      const groupPois = group.pois || [];
      console.log(`[STATE] _rebuildAllPOIs() group "${group.name}" has ${groupPois.length} POIs`);
      const groupName = group.name;
      const style = this._preferences.groupStyles[uuid] || {};
      const color = style.color || this._preferences.accentColor;
      const secondaryColor = style.secondaryColor || '#ffffff';
      const logoData = style.logoData;
      
      groupPois.forEach(p => {
        all.push({ ...p, groupName, groupUuid: uuid });
        bridgePois.push({
          id: p.id,
          name: p.name,
          latitude: p.latitude,
          longitude: p.longitude,
          color,
          secondaryColor,
          logoData,
          groupName,
          groupUuid: uuid
        });
      });
    });
    
    window.manager?.load(all);
    window.postMessage({ type: 'POI_DATA_UPDATE', pois: bridgePois }, '*');
    console.log(`[STATE] Bridge update sent: ${bridgePois.length} POIs`);
    this._bridgeLastPois = bridgePois;
  }

  /**
   * Gets POI groups from cache or storage.
   * Groups are now stored per-profile, so we need to fetch from the active profile.
   * @private
   */
  async _getPoiGroups() {
    const cacheAge = Date.now() - this._poiCacheTime;
    if (this._poiCache && cacheAge < 60000) {
      console.log('[STATE] _getPoiGroups() returning cached data (age:', cacheAge, 'ms)');
      return this._poiCache;
    }
    
    console.log('[STATE] _getPoiGroups() reading fresh from storage...');
    try {
      // Try new per-profile storage first
      const data = await chrome.storage.local.get(['profiles', 'activeProfile', 'poiGroups']);
      const profiles = data.profiles || {};
      const activeProfileUuid = data.activeProfile;
      const activeProfile = profiles[activeProfileUuid];
      
      console.log('[STATE] _getPoiGroups() activeProfileUuid:', activeProfileUuid);
      console.log('[STATE] _getPoiGroups() activeProfile exists?', !!activeProfile);
      if (activeProfile) console.log('[STATE] _getPoiGroups() activeProfile.groups keys:', Object.keys(activeProfile.groups || {}));
      
      let poiGroups = {};
      
      // Get groups from active profile (new per-profile storage)
      if (activeProfile && activeProfile.groups) {
        poiGroups = activeProfile.groups;
      } else {
        // Fallback to legacy global poiGroups for backwards compatibility
        poiGroups = data.poiGroups || {};
      }
      
      console.log('[STATE] _getPoiGroups() returning groups with keys:', Object.keys(poiGroups));
      this._poiCache = poiGroups;
      this._poiCacheTime = Date.now();
      return poiGroups;
    } catch (e) {
      console.error('[STATE] Error getting POI groups:', e);
      return {};
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
