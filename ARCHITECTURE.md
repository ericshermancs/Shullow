# Shullow - Architecture Documentation

## Overview

Shullow is a Chrome extension that injects customizable Points of Interest (POI) markers onto real estate map websites. The architecture is built on an **event-driven, cross-world communication model** that separates concerns between the isolated content script world and the page's main execution context.

**Core Design Philosophy:**
- **Isolation**: Content scripts run in an isolated world; map access requires bridge injection
- **Singleton Pattern**: All managers follow singleton pattern with initialization lifecycle
- **Event-Driven**: Changes trigger broadcasts that cascade through the system
- **Domain Locking**: Multi-map support via Phase 6.5 registry isolation
- **Priority-Based**: Bounds data uses priority queues to ensure freshness

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                                 │
├──────────────────────────────────────┬──────────────────────────────┤
│                                      │                              │
│       CONTENT WORLD (Isolated)       │   MAIN WORLD (Page Context)  │
│       (Limited DOM Access)           │   (Full Map Access)          │
│                                      │                              │
│  ┌──────────────────────────────┐   │  ┌──────────────────────────┐ │
│  │     content/main.js          │   │  │   bridge/main.js         │ │
│  │  - Extension boot logic      │   │  │  - Manager orchestration │ │
│  │  - Stability loop            │───┼──│  - Loop & rendering      │ │
│  │  - Storage relay             │   │  │  - DOM attribute sync    │ │
│  └──────────────────────────────┘   │  └──────────────────────────┘ │
│           │                         │          │                    │
│  ┌────────▼──────────────────────┐  │  ┌───────▼────────────────────┐ │
│  │  POIStateManager             │  │  │  BRIDGE MANAGERS           │ │
│  │  - Chrome.storage interface  │  │  │  - MapHijackManager       │ │
│  │  - POI group management      │  │  │  - MapDiscoveryManager    │ │
│  │  - Preferences & styles      │  │  │  - PortalManager          │ │
│  │  - Refresh triggers          │  │  │  - OverlayRegistry access │ │
│  └──────────────────────────────┘  │  └───────────────────────────┘ │
│           │                         │          │                    │
│  ┌────────▼──────────────────────┐  │  ┌───────▼────────────────────┐ │
│  │  OverlayManager              │  │  │  OVERLAY SYSTEM            │ │
│  │  - DOM overlay div           │  │  │  - OverlayRegistry         │ │
│  │  - Debug panel               │  │  │  - siteConfig.js           │ │
│  │  - Marker tracking           │  │  │  - Native map marker APIs  │ │
│  │  - Popup events              │  │  │    (Google/Mapbox)         │ │
│  └──────────────────────────────┘  │  └───────────────────────────┘ │
│           │                         │                                │
│  ┌────────▼──────────────────────┐  │                                │
│  │  EventManager                 │  │                                │
│  │  - Message routing            │  │                                │
│  │  - Storage listeners          │  │                                │
│  │  - postMessage handlers       │  │                                │
│  └──────────────────────────────┘  │                                │
│                                      │                              │
└──────────────────────────────────────┴──────────────────────────────┘
```

## Communication Flow

### 1. Initial Boot Sequence

```
Page Load
  ↓
content/entry-gate.js (runs at document_start)
  ↓
content/main.js (runs at document_end)
  ├─ Check if site is enabled
  │  └─ If disabled: Set __poiDormant flag, return
  │  └─ If enabled: Call bootExtension()
  │
  └─ bootExtension()
     ├─ Inject bridge-bundle.js script into MAIN world
     ├─ Start stability loop (detects map containers)
     └─ Listen for bridge messages via window.postMessage
```

### 2. Map Detection & Registration

```
bridge/main.js Loop (every 500ms)
  ↓
MapHijackManager.interceptConstructors()
  ├─ Hijack google.maps.Map constructor
  ├─ Hijack mapboxgl.Map constructor
  └─ Store captured instances in Set
  
MapDiscoveryManager.scan()
  ├─ Shadow DOM traversal
  ├─ React Fiber scanning
  ├─ DOM selector queries
  └─ Extract map instances
  
OverlayRegistry.register(mapInstance, containerElement)
  ├─ Detect domain from hostname
  ├─ Lock domain (immutable)
  ├─ Create MapEntry with site config
  └─ Attach event listeners for bounds updates
```

### 3. Bounds Update Flow

```
Map bounds change
  ↓
MapHijackManager event listener fires (moveend/idle)
  ↓
PortalManager.update(bounds, priority)
  ├─ Compare against lastBounds
  ├─ Check priority vs lastPriority
  └─ If fresher: mirror to DOM attributes
     └─ element['data-poi-bounds'] = JSON
  
content/events.js detects DOM attribute change
  ↓
Triggers POIStateManager.refresh()
  ├─ Filter active POIs
  ├─ Calculate which POIs are in viewport
  ├─ postMessage to bridge with POI data
  └─ Bridge renders via native map APIs
```

### 4. POI Rendering

```
bridge/main.js receives POI_DATA_UPDATE
  ↓
Loop renders via:
  ├─ window.poiRenderer (for native Google/Mapbox markers)
  └─ OverlayRegistry.getOverlay(mapId)
     └─ Uses site-specific rendering logic from siteConfig.js
```

## Directory Structure

```
├── manifest.json                    # Extension manifest (MV3)
│
│
├── bridge/                          # MAIN world context (page execution)
│   ├── main.js                      # Orchestrator & loop
│   ├── entry.js                     # Bundle entry point
│   ├── bridge-bundle.js             # Bundled script for injection
│   └── modules/
│       ├── ManagerBase.js           # Abstract singleton base class
│       ├── mapUtilities.js          # MarkerPool, MapUtils, etc.
│       ├── hijack.js                # MapHijackManager - constructor interception
│       ├── discovery.js             # MapDiscoveryManager - map detection
│       ├── portal.js                # PortalManager - bounds prioritization & DOM mirroring
│       ├── sniff.js                 # [DEPRECATED] NetworkSnifferManager
│       └── renderer.js              # [LEGACY] Rendering utilities
│
├── content/                         # CONTENT world context (isolated)
│   ├── main.js                      # Bootstrap & stability loop
│   ├── entry-gate.js                # Early initialization
│   ├── detector.js                  # DOM utilities for map detection
│   ├── content.css                  # Debug panel & overlay styles
│   └── modules/
│       ├── state.js                 # POIStateManager - storage & state
│       ├── overlay.js               # OverlayManager - DOM overlay & debug panel
│       └── events.js                # EventManager - message routing & listeners
│
├── overlays/                        # Overlay registry & site configuration
│   ├── OverlayRegistry.js           # Phase 6.5 multi-map registry
│   └── siteConfig.js                # Centralized site-specific config
│
├── overlay/                         # Legacy folder (marker overlay UI)
│   ├── marker-overlay.html
│   └── marker-overlay.js
│
├── popup/                           # Extension popup UI
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   └── modules/
│       ├── color-wheel.js           # Color picker component
│       └── storage.js               # Popup-side storage manager
│
├── data/                            # Data import/export
│   ├── data-manager.js              # POI group management
│   ├── csv-parser.js                # CSV import
│   └── json-parser.js               # JSON import
│
└── options/                         # Extension options page
    ├── options.html
    ├── options.js
    └── options.css
```

## Core Components

### ManagerBase.js

**Singleton Pattern with Initialization Lifecycle**

```javascript
class ManagerBase {
  constructor() {
    // Enforce singleton
    if (this.constructor.instance) return this.constructor.instance;
    this.constructor.instance = this;
    
    this.initialized = false;
    this.initializing = false;
    this._debug = false;
  }

  async initialize() {
    if (this.initializing) return;
    this.initializing = true;
    await this.onInitialize();
    this.initialized = true;
    this.initializing = false;
  }

  async onInitialize() {
    // Override in subclasses
  }

  cleanup() {
    // Override in subclasses
  }
}
```

Every bridge manager extends this for consistent lifecycle management.

### MapHijackManager

**Constructor Interception**

Hijacks `google.maps.Map` and `mapboxgl.Map` constructors to capture instances as they're created. Attaches event listeners for bounds changes:

- Google Maps: listens to `'idle'`, `'moveend'`, `'zoom_changed'`
- Mapbox: listens to `'moveend'`, `'idle'`, `'zoom'`

Event handlers call `PortalManager.update()` with priority `'instance-event'` (highest).

### MapDiscoveryManager

**Multi-Strategy Map Detection**

Discovers existing maps through:
1. **Mapbox Global Registry** - `mapboxgl._instances`
2. **Web Components** - `gmp-map`, `gmp-advanced-marker`
3. **React Fiber Scanning** - Walks React Fiber tree for map components
4. **Shadow DOM Traversal** - Pierces shadow boundaries
5. **DOM Selectors** - Site-specific selectors from siteConfig.js

Each discovered map is registered with `OverlayRegistry` for domain-locking.

### PortalManager

**Bounds Prioritization & Cross-World Communication**

Maintains priority queue for bounds updates:
- `instance-event` (100) - Direct user interaction
- `redfin-redux-sub` (90) - Real-time Redux subscriptions
- `instance-capture` (80) - Extracted from active map
- `redfin-redux` (50) - Polled Redux state
- `network-url` (20) - Network request sniffing

Only fresher data overwrites `lastBounds`. Mirrors bounds to DOM attributes for content script detection.

### OverlayRegistry (Phase 6.5)

**Multi-Map Isolation**

**Problem**: On sites with iframes/ads, global domain detection would see wrong domains.

**Solution**:
- Each map gets unique ID and MapEntry
- Domain is locked at discovery time
- Site config is immutable per map
- Network requests cannot change assignments

```javascript
class MapEntry {
  constructor(id, mapInstance, domain, siteConfig) {
    this.id = id;
    this.mapInstance = mapInstance;
    this.domain = domain;           // Immutable
    this.siteConfig = siteConfig;   // Locked
  }
}
```

### POIStateManager

**Content World Storage Interface**

Manages:
- Chrome storage (local) for POI groups and preferences
- Active group tracking
- Site-specific preferences
- Styling per group (colors, logos)
- Refresh trigger logic

Provides singleton instance: `window.poiState` or `window.getPoiStateManager()`

### OverlayManager

**Content World DOM Overlay**

Maintains:
- `#poi-overlay` div - Positioned over map container
- `#poi-debug-panel` - Debug information display
- Marker data tracking
- Viewport bounds calculation
- Popup/tooltip handlers

**Does NOT render markers** - rendering is delegated to bridge via native map APIs.

### siteConfig.js

**Centralized Site Configuration**

Replaces overlay class hierarchy with config objects:

```javascript
const SITE_CONFIG = {
  'zillow.com': {
    displayName: 'Zillow',
    mapType: 'mapbox',
    selectors: ['.mapboxgl-map', '#search-page-map', ...],
    styles: { markerZIndex: 103, ... },
    features: {
      reduxStore: false,
      shadowDOM: false,
      boundsTracking: true
    }
  },
  'redfin.com': {
    mapType: 'google',
    features: { reduxStore: true, ... },
    ...
  },
  ...
}
```

Supports:
- Multiple sites with different map libraries
- Per-site style overrides
- Feature flags (Redux integration, Shadow DOM, etc.)
- Container detection selectors
- Domain pattern matching

## Data Flow Example

**User zooms on Zillow map → Markers update:**

```
1. User zooms map on zillow.com

2. mapboxgl.Map fires 'moveend' event

3. MapHijackManager listener calls:
   PortalManager.update({ north, south, east, west }, 'instance-event')

4. PortalManager checks priority (100 > previous), updates lastBounds

5. DOM attribute 'data-poi-bounds' changes:
   documentElement['data-poi-bounds'] = JSON.stringify(bounds)

6. content/events.js MutationObserver detects attribute change

7. Triggers POIStateManager.refresh():
   - Loads active groups from this.activeGroups
   - Filters POIs within new bounds
   - Assembles POI array with colors/logos

8. Sends postMessage to bridge:
   window.postMessage({
     type: 'POI_DATA_UPDATE',
     data: { pois: [...], bounds: {...} }
   }, '*')

9. bridge/main.js receives message in loop:
   - Extracts POIs
   - Gets map instance from window.poiHijack.activeMaps
   - Uses siteConfig for styling
   - Calls native Google/Mapbox marker API

10. Markers appear on map
```

## Event-Driven Architecture

### Message Types

**Content → Bridge**:
- `POI_DATA_UPDATE` - POI array with current bounds

**Bridge → Content**:
- `POI_BRIDGE_READY` - Bridge announces readiness
- `POI_BOUNDS_UPDATE` - Bounds from map (for debugging)

**Storage Changes**:
- Popup saves preferences → triggers storage change event
- Content script listens on `chrome.storage.onChanged`
- Triggers state refresh and relay to bridge

**Popup → Content**:
- Group toggled on/off → update activeGroups
- Debug mode toggled → control display
- Theme customized → update accentColor

## Performance Optimizations

1. **Marker Pooling** - Reusable marker DOM elements to avoid constant creation/destruction

2. **Batched Rendering** - Google Maps OverlayView groups marker updates into single render pass

3. **Priority Queuing** - Prevents stale bounds data from overwriting fresh data

4. **Cache & Debounce** - POIStateManager caches POI data to avoid rapid storage reads

5. **Lazy Discovery** - Maps only discovered on demand (hijack or active selectors)

6. **Idle Throttling** - Debug panel updates only when needed, detection scanners pause when no maps found

## Security Considerations

1. **Isolated World Separation** - Content scripts can't access page's global scope (vice versa)

2. **Bridge Bundle Injection** - Injected as separate script tag, not eval'd

3. **DOM Attribute Mirroring** - Safe way to pass data between worlds (string attributes)

4. **postMessage Protocol** - Only trusted message types processed

5. **Network Sniffing Disabled** - Phase 6.4+ no fetch/XHR interception for safety

6. **Domain Locking** - Registry prevents domain pollution from ads/iframes

## Testing & Debug

### Enable Debug Mode

```javascript
// In browser console on target site:
window.overlayRegistry.setDebug(true);
window.poiHijack.setDebug(true);
window.poiDiscovery.setDebug(true);
window.poiPortal.setDebug(true);
```

Toggle in popup UI for detailed debug panel on map.

### Console Messages

- `[BRIDGE]` - bridge/main.js lifecycle
- `[MapHijackManager]` - Constructor captures
- `[MapDiscoveryManager]` - Detection results
- `[PortalManager]` - Bounds updates & priority
- `[POI Overlay]` - DOM overlay status
- `[OverlayRegistry]` - Registration & lookups

### Network Tab

Monitor `postMessage` events:
- Check browser DevTools Console for message types
- Use `window.postMessage` debugging to trace data flow

## Version History

- **v0.2** - Site config consolidation, Phase 6.5 registry
- **v0.1** - Initial bridge-based architecture

## License

MIT
