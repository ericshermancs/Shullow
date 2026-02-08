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
  async refresh({ styleChanged = false, styleChangedGroup = null } = {}) {
    // Prevent concurrent refreshes - if already refreshing, queue this call
      if (this._isRefreshing) {
        return;
      }
    
    this._isRefreshing = true;
    try {
      console.log(`[STATE] refresh() START: styleChanged=${styleChanged}, styleChangedGroup=${styleChangedGroup}`);
      let skipStateRead = this._skipStorageRead;
      this._skipStorageRead = false;
      if (styleChanged) {
        this._poiCache = null;
        this._poiCacheTime = 0;
        console.log(`[STATE] Cache bypassed due to styleChanged`);
      }
      
      if (!skipStateRead) {
        // Fast path: Only read activeGroups and preferences, use cached POI data
        const state = await chrome.storage.local.get(['activeGroups', 'preferences']);
        
        // Update state
        if (state.activeGroups) this._activeGroups = state.activeGroups;
        if (state.preferences) this._preferences = { ...this._preferences, ...state.preferences };
      }

      if (window.manager) {
        window.manager.updateVisibility();
      }

      const selected = Object.keys(this._activeGroups).filter(k => this._activeGroups[k]);
      console.log(`[STATE] Selected groups: ${selected.join(',')}`);
      if (styleChanged && styleChangedGroup && window.manager?.removeMarkersForGroup) {
        window.manager.removeMarkersForGroup(styleChangedGroup);
      }
      
      // Detect what changed - if only one group was toggled off, we can optimize
      const lastSelected = Object.keys(this._lastActiveGroups).filter(k => this._lastActiveGroups[k]);
      const removed = lastSelected.filter(g => !selected.includes(g));
      const added = selected.filter(g => !lastSelected.includes(g));
      // onlyRemoved: only removing groups, not adding (works even if all removed)
      const onlyRemoved = removed.length > 0 && added.length === 0;
      
      if (selected.length === 0) { 
        // OPTIMIZATION: If only removing groups, use fast path
        if (onlyRemoved && window.manager && window.manager.markerData.length > 0) {
          if (window.manager) window.manager.markerData = [];
          if (window.manager) window.manager.render();
          window.postMessage({
            type: 'POI_DATA_UPDATE',
            pois: []
          }, '*');
          this._lastActiveGroups = { ...this._activeGroups };
          return;
        }
        
        if (window.manager) {
          window.manager.markerData = [];
          window.manager.render(); 
        }
        // Send empty data to bridge to clear native markers
        window.postMessage({
          type: 'POI_DATA_UPDATE',
          pois: []
        }, '*');
        this._lastActiveGroups = { ...this._activeGroups };
        return; 
      }
      
      // OPTIMIZATION: If only removing groups, filter existing data instead of rebuilding
      if (onlyRemoved) {
        // Remove markers for each removed group (no full re-render)
        if (window.manager && window.manager.markerData.length > 0) {
          removed.forEach(groupName => {
            window.manager.removeMarkersForGroup(groupName);
          });
          
          const filtered = window.manager.markerData.filter(p => !removed.includes(p.groupName));
          window.manager.markerData = filtered;
          
          // Also filter bridge data
          const bridgeFiltered = filtered.map(p => {
            const style = this._preferences.groupStyles[p.groupName] || {};
            return {
              id: p.id,
              name: p.name,
              latitude: p.latitude,
              longitude: p.longitude,
              color: style.color || this._preferences.accentColor,
              secondaryColor: style.secondaryColor || '#ffffff',
              logoData: style.logoData
            };
          });
          
          window.postMessage({
            type: 'POI_DATA_UPDATE',
            pois: bridgeFiltered
          }, '*');
          
          this._lastActiveGroups = { ...this._activeGroups };
        } else {
          // No manager or no markers, but still send bridge update
          // Still need to filter cached data for bridge if available
          const bridgeFiltered = (this._bridgeLastPois || []).filter(p => !removed.includes(p.groupName));
          this._bridgeLastPois = bridgeFiltered;
          
          window.postMessage({
            type: 'POI_DATA_UPDATE',
            pois: bridgeFiltered
          }, '*');
          
          this._lastActiveGroups = { ...this._activeGroups };
        }
        this._isRefreshing = false;
        return;
      }
      
      // Use cache if available and recent (within 1 minute)
      let poiGroups;
      const cacheAge = Date.now() - this._poiCacheTime;
      if (this._poiCache && cacheAge < 60000) {
        poiGroups = this._poiCache;
      } else {
        const data = await chrome.storage.local.get(['poiGroups']);
        poiGroups = data.poiGroups || {};
        this._poiCache = poiGroups;
        this._poiCacheTime = Date.now();
      }
      
      // Optimize: Build POI array with styles in one pass (avoid double mapping)
      const all = [];
      const bridgePois = [];
      
      selected.forEach(g => {
        const groupPois = poiGroups[g] || [];
        const style = this._preferences.groupStyles[g] || {};
        const color = style.color || this._preferences.accentColor;
        if (g === styleChangedGroup) console.log(`[STATE] Building POIs for ${g}: color=${color}`);
        const secondaryColor = style.secondaryColor || '#ffffff';
        const logoData = style.logoData;
        
        groupPois.forEach(p => {
          // For manager (needs full data)
          all.push({ ...p, groupName: g });
          
          // For bridge (only needs display data)
          bridgePois.push({
            id: p.id,
            name: p.name,
            latitude: p.latitude,
            longitude: p.longitude,
            color,
            secondaryColor,
            logoData // Keep logoData for compatibility
          });
        });
      });
      
      if (window.manager) window.manager.load(all);
      
      // Bridge Sync: Send POI data to the main world for native rendering
      window.postMessage({
        type: 'POI_DATA_UPDATE',
        pois: bridgePois
      }, '*');
      console.log(`[STATE] Bridge update sent: ${bridgePois.length} POIs, styleChangedGroup=${styleChangedGroup}`);
      
      this._bridgeLastPois = bridgePois;
      
      this._lastActiveGroups = { ...this._activeGroups };
    } finally {
      this._isRefreshing = false;
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
