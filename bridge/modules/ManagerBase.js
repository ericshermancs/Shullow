/**
 * POI Bridge: Manager Base Class
 * Base class for all manager singletons with initialization lifecycle.
 */

/**
 * ManagerBase - Abstract base class for manager singletons
 * 
 * Provides:
 * - Singleton pattern enforcement
 * - Initialization lifecycle management
 * - Cleanup interface
 * 
 * @abstract
 */
class ManagerBase {
  /**
   * Creates a new ManagerBase instance (or returns existing singleton)
   */
  constructor() {
    // Singleton pattern enforcement
    if (this.constructor.instance) {
      return this.constructor.instance;
    }
    this.constructor.instance = this;
    
    this.initialized = false;
    this.initializing = false;
    this._debug = false;
  }

  /**
   * Enable or disable debug logging
   * @param {boolean} enabled - Enable debug mode
   */
  setDebug(enabled) {
    this._debug = enabled;
  }

  /**
   * Logs debug messages if debug mode is enabled
   * @param {...any} args - Arguments to log
   */
  log(...args) {
    if (this._debug) {
      console.log(`[${this.constructor.name}]`, ...args);
    }
  }

  /**
   * Logs warnings regardless of debug mode
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    console.warn(`[${this.constructor.name}]`, ...args);
  }

  /**
   * Logs errors regardless of debug mode
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    console.error(`[${this.constructor.name}]`, ...args);
  }

  /**
   * Initializes the manager (idempotent - only runs once)
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      this.log('Already initialized, skipping');
      return;
    }

    if (this.initializing) {
      this.log('Initialization in progress, waiting...');
      // Wait for existing initialization to complete
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return;
    }

    this.initializing = true;
    this.log('Initializing...');

    try {
      await this.onInitialize();
      this.initialized = true;
      this.log('Initialization complete');
    } catch (e) {
      this.error('Initialization failed:', e);
      throw e;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Called during initialization - must be implemented by subclasses
   * @abstract
   * @returns {Promise<void>}
   */
  async onInitialize() {
    throw new Error('Must implement onInitialize()');
  }

  /**
   * Cleans up resources and resets state
   * @abstract
   */
  cleanup() {
    throw new Error('Must implement cleanup()');
  }

  /**
   * Resets the singleton instance (useful for testing)
   */
  static reset() {
    if (this.instance) {
      try {
        this.instance.cleanup();
      } catch (e) {
        console.warn('Cleanup during reset failed:', e);
      }
      this.instance = null;
    }
  }

  /**
   * Gets the singleton instance
   * @returns {ManagerBase} The singleton instance
   */
  static getInstance() {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance;
  }
}

if (typeof window !== 'undefined') {
  window.ManagerBase = ManagerBase;
}
