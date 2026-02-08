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
  async refresh() {
    // Prevent concurrent refreshes - if already refreshing, queue this call
    if (this._isRefreshing) {
      console.log('[POI DEBUG] Refresh already in progress, skipping concurrent call');
      return;
    }
    
    this._isRefreshing = true;
    const tGlobal0 = performance.now();
    console.log('[POI DEBUG] ========== REFRESH START ==========');
    try {
      const t0 = performance.now();
      // Skip redundant storage read if message listener just updated (within 50ms)
      let skipStateRead = this._skipStorageRead;
      this._skipStorageRead = false; // Reset flag
      
      let t1 = performance.now();
      if (!skipStateRead) {
        // Fast path: Only read activeGroups and preferences, use cached POI data
        const t0_1 = performance.now();
        const state = await chrome.storage.local.get(['activeGroups', 'preferences']);
        t1 = performance.now();
        console.log(`[POI DEBUG] Storage read took ${(t1-t0_1).toFixed(1)}ms`);
        
        // Update state
        if (state.activeGroups) this._activeGroups = state.activeGroups;
        if (state.preferences) this._preferences = { ...this._preferences, ...state.preferences };
      } else {
        t1 = performance.now();
        console.log(`[POI DEBUG] Skipped storage read, using in-memory state`);
      }

      if (window.manager) {
        window.manager.updateVisibility();
      }

      const selected = Object.keys(this._activeGroups).filter(k => this._activeGroups[k]);
      
      // Detect what changed - if only one group was toggled off, we can optimize
      const lastSelected = Object.keys(this._lastActiveGroups).filter(k => this._lastActiveGroups[k]);
      const removed = lastSelected.filter(g => !selected.includes(g));
      const added = selected.filter(g => !lastSelected.includes(g));
      // onlyRemoved: only removing groups, not adding (works even if all removed)
      const onlyRemoved = removed.length > 0 && added.length === 0;
      
      console.log(`[POI DEBUG] selected=${selected.join(',')}, last=${lastSelected.join(',')}, removed=${removed.join(',')}, added=${added.join(',')}, onlyRemoved=${onlyRemoved}, hasManager=${!!window.manager}, markerCount=${window.manager?.markerData.length || 0}`);
      
      if (selected.length === 0) { 
        // OPTIMIZATION: If only removing groups, use fast path
        if (onlyRemoved && window.manager && window.manager.markerData.length > 0) {
          console.log(`[POI OPTIMIZE] Removing all remaining groups`);
          if (window.manager) window.manager.markerData = [];
          if (window.manager) window.manager.render();
          window.postMessage({
            type: 'POI_DATA_UPDATE',
            pois: []
          }, '*');
          this._lastActiveGroups = { ...this._activeGroups };
          const tEnd = performance.now();
          console.log(`[POI PERF] optimized clear: total=${(tEnd-t0).toFixed(1)}ms`);
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
        console.log(`[POI PERF] refresh() cleared in ${(performance.now() - t0).toFixed(1)}ms`);
        return; 
      }
      
      // OPTIMIZATION: If only removing groups, filter existing data instead of rebuilding
      if (onlyRemoved) {
        console.log(`[POI OPTIMIZE] ✓ Entering optimization path (not reading storage)`);
        const tOpt1 = performance.now();
        console.log(`[POI OPTIMIZE] Only removing groups: ${removed.join(', ')}, filtering existing data`);
        
        // Remove markers for each removed group (no full re-render)
        if (window.manager && window.manager.markerData.length > 0) {
          removed.forEach(groupName => {
            window.manager.removeMarkersForGroup(groupName);
          });
          const tOpt2 = performance.now();
          
          const filtered = window.manager.markerData.filter(p => !removed.includes(p.groupName));
          window.manager.markerData = filtered;
          const tOpt3 = performance.now();
          
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
          const tOpt4 = performance.now();
          
          window.postMessage({
            type: 'POI_DATA_UPDATE',
            pois: bridgeFiltered
          }, '*');
          
          this._lastActiveGroups = { ...this._activeGroups };
          const tEnd = performance.now();
          console.log(`[POI PERF] optimized removal: remove=${(tOpt2-tOpt1).toFixed(1)}ms, filter=${(tOpt3-tOpt2).toFixed(1)}ms, map=${(tOpt4-tOpt3).toFixed(1)}ms, bridge=${(tEnd-tOpt4).toFixed(1)}ms, total=${(tEnd-t0).toFixed(1)}ms, pois=${filtered.length}`);
        } else {
          // No manager or no markers, but still send bridge update
          const tOpt2 = performance.now();
          console.log(`[POI DEBUG] No manager to filter, sending bridge update only`);
          
          // Still need to filter cached data for bridge if available
          const bridgeFiltered = (this._bridgeLastPois || []).filter(p => !removed.includes(p.groupName));
          this._bridgeLastPois = bridgeFiltered;
          
          window.postMessage({
            type: 'POI_DATA_UPDATE',
            pois: bridgeFiltered
          }, '*');
          
          this._lastActiveGroups = { ...this._activeGroups };
          const tEnd = performance.now();
          console.log(`[POI PERF] optimized removal (no manager): total=${(tEnd-t0).toFixed(1)}ms`);
        }
        this._isRefreshing = false;
        const tGlobalEnd = performance.now();
        console.log(`[POI DEBUG] ========== REFRESH END (optimized, wall time: ${(tGlobalEnd-tGlobal0).toFixed(1)}ms) ==========`);
        return;
      }
      
      // Use cache if available and recent (within 1 minute)
      let poiGroups;
      const cacheAge = Date.now() - this._poiCacheTime;
      if (this._poiCache && cacheAge < 60000) {
        poiGroups = this._poiCache;
        console.log(`[POI CACHE] Using cached POI data (age: ${cacheAge}ms)`);
      } else {
        const data = await chrome.storage.local.get(['poiGroups']);
        poiGroups = data.poiGroups || {};
        this._poiCache = poiGroups;
        this._poiCacheTime = Date.now();
        console.log(`[POI CACHE] Refreshed POI cache (reason: ${this._poiCache ? 'expired' : 'null'}, age: ${cacheAge}ms)`);
      }
      const t2 = performance.now();
      
      // Optimize: Build POI array with styles in one pass (avoid double mapping)
      const all = [];
      const bridgePois = [];
      
      selected.forEach(g => {
        const groupPois = poiGroups[g] || [];
        const style = this._preferences.groupStyles[g] || {};
        const color = style.color || this._preferences.accentColor;
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
      
      const t3 = performance.now();
      if (window.manager) window.manager.load(all);
      const t4 = performance.now();
      
      // Bridge Sync: Send POI data to the main world for native rendering
      window.postMessage({
        type: 'POI_DATA_UPDATE',
        pois: bridgePois
      }, '*');
      
      // Track last POIs sent for quick filtering on removal
      this._bridgeLastPois = bridgePois;
      
      const t5 = performance.now();
      this._lastActiveGroups = { ...this._activeGroups };
      console.log(`[POI PERF] refresh() complete: state=${(t1-t0).toFixed(1)}ms, poi=${(t2-t1).toFixed(1)}ms, process=${(t3-t2).toFixed(1)}ms, render=${(t4-t3).toFixed(1)}ms, bridge=${(t5-t4).toFixed(1)}ms, total=${(t5-t0).toFixed(1)}ms, pois=${all.length}`);
    } finally {
      this._isRefreshing = false;
      const tGlobalEnd = performance.now();
      console.log(`[POI DEBUG] ========== REFRESH END (total wall time: ${(tGlobalEnd-tGlobal0).toFixed(1)}ms) ==========`);
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
