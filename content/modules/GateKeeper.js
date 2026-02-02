/**
 * GateKeeper - Synchronous in-memory gate for extension enable/disable state
 * 
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for whether the extension should
 * perform ANY DOM modifications. All DOM-modifying code MUST check GateKeeper.isEnabled()
 * synchronously before executing.
 * 
 * Design principles:
 * - 100% in-memory, synchronous checks
 * - NO DOM modifications when disabled (not even markers or attributes)
 * - Loaded before any other modules
 * - Singleton pattern for global access
 * 
 * Usage:
 *   if (!GateKeeper.isEnabled()) return; // Early exit in any DOM-modifying function
 */
class GateKeeper {
  constructor() {
    if (GateKeeper.instance) {
      return GateKeeper.instance;
    }
    GateKeeper.instance = this;
    
    // In-memory state - starts as null (uninitialized)
    // Must be explicitly set before extension runs
    this._enabled = null;
    this._initialized = false;
    this._hostname = null;
    this._listeners = [];
  }

  /**
   * Initialize the gate with the current enabled state
   * Called once at startup after loading preferences from storage
   * @param {boolean} enabled - Whether extension is enabled for current site
   * @param {string} hostname - Current hostname for tracking
   */
  initialize(enabled, hostname) {
    this._enabled = enabled;
    this._hostname = hostname;
    this._initialized = true;
    console.log('[GateKeeper] Initialized:', { enabled, hostname });
  }

  /**
   * SYNCHRONOUS check if extension is enabled
   * This is the main gate - call this before ANY DOM modification
   * @returns {boolean} True if enabled and allowed to modify DOM
   */
  isEnabled() {
    // If not initialized, default to DISABLED (fail-safe)
    if (!this._initialized) {
      return false;
    }
    return this._enabled === true;
  }

  /**
   * SYNCHRONOUS check if extension is disabled
   * Convenience method for clearer code
   * @returns {boolean} True if disabled or not initialized
   */
  isDisabled() {
    return !this.isEnabled();
  }

  /**
   * Get initialization state
   * @returns {boolean} True if initialize() has been called
   */
  isInitialized() {
    return this._initialized;
  }

  /**
   * Update enabled state (called when user toggles extension)
   * @param {boolean} enabled - New enabled state
   */
  setEnabled(enabled) {
    const oldState = this._enabled;
    this._enabled = enabled;
    console.log('[GateKeeper] State changed:', { from: oldState, to: enabled });
    
    // Notify listeners synchronously
    this._notifyListeners(enabled, oldState);
  }

  /**
   * Register a listener for state changes
   * @param {Function} callback - Called with (newState, oldState)
   */
  onStateChange(callback) {
    this._listeners.push(callback);
  }

  /**
   * Remove a state change listener
   * @param {Function} callback - Callback to remove
   */
  offStateChange(callback) {
    this._listeners = this._listeners.filter(l => l !== callback);
  }

  /**
   * Notify all listeners of state change
   * @private
   */
  _notifyListeners(newState, oldState) {
    for (const listener of this._listeners) {
      try {
        listener(newState, oldState);
      } catch (e) {
        console.error('[GateKeeper] Error in state change listener:', e);
      }
    }
  }

  /**
   * Get current hostname
   * @returns {string|null}
   */
  getHostname() {
    return this._hostname;
  }

  /**
   * Destroy/reset the gate (for testing or cleanup)
   */
  reset() {
    this._enabled = null;
    this._initialized = false;
    this._hostname = null;
    this._listeners = [];
    console.log('[GateKeeper] Reset');
  }
}

// Create singleton instance immediately
window.gateKeeper = new GateKeeper();
