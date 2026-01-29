/**
 * @file types.js
 * @description Type definitions for the Domain Interface.
 * Defines how a specific real estate domain (Zillow, Redfin, etc.) is identified,
 * how its map is detected, and how data is normalized.
 */

/**
 * @typedef {Object} POI
 * @property {string} name - The display name of the Point of Interest
 * @property {number} lat - Latitude
 * @property {number} lng - Longitude
 * @property {string} [description] - Optional description or address
 * @property {string} [category] - Optional category (e.g., "synagogue", "market")
 * @property {Object} [meta] - Any extra metadata
 */

/**
 * @typedef {Object} DomainConfig
 * @property {'google'|'mapbox'|'bing'|'leaflet'|'unknown'} mapType - The underlying map engine used by the site.
 * @property {Object} selectors - CSS selectors for critical elements.
 * @property {string} [selectors.container] - Primary selector for the map container.
 * @property {string} [selectors.sidebar] - Selector for the sidebar (to avoid).
 * @property {string} [selectors.viewport] - Specific viewport selector if different from container.
 * @property {Array<string>} [strategies] - List of named detection strategies to use (e.g., 'shadow-dom', 'iframe-fallback', 'homes-special').
 * @property {Object} [injection] - Configuration for the bridge injection.
 * @property {string} [injection.unwrapStrategy] - Strategy to unwrap/access the map instance (e.g., 'redfin-wrapper', 'default').
 * @property {boolean} [injection.waitForGlobal] - Whether to wait for a global variable (like `google`) before hijacking.
 */

/**
 * @typedef {Object} DomainHooks
 * @property {(container: HTMLElement) => void} [onCapture] - Called when the map container is successfully detected.
 * @property {(bridge: any) => void} [onInject] - Called when the bridge script is about to be injected.
 * @property {(poi: POI) => void} [onMarkerCreate] - Called before a marker is placed on the map.
 */

/**
 * @typedef {Object} DataMapping
 * @property {(row: Object|Array<string>) => POI|null} normalize - Converts a raw data row (CSV/JSON) into a standardized POI object.
 * @property {Array<string>} [requiredFields] - List of fields that must exist for the row to be valid.
 */

/**
 * @typedef {Object} Domain
 * @property {string} id - Unique identifier for the domain (e.g., 'zillow', 'redfin').
 * @property {(url: URL) => boolean} match - Function to determine if this domain definition applies to the current URL.
 * @property {DomainConfig} config - Configuration for detection and injection.
 * @property {DomainHooks} [hooks] - Lifecycle hooks for domain-specific logic.
 * @property {DataMapping} dataMapping - Rules for normalizing data for this domain.
 */

export {};
