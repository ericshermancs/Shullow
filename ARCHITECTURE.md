# POI TITAN - Architecture Documentation

## Overview

POI TITAN (formerly "Map POI Injector" / "Shullow") is a Chrome extension that injects Points of Interest (POI) markers onto real estate map websites like Zillow, Redfin, Homes.com, OneKeyMLS, and Realtor.com.

## Architecture

The extension follows a modular, object-oriented architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CHROME EXTENSION                              │
├─────────────────────────────────────────────────────────────────────┤
│  CONTENT WORLD (Isolated)          │  MAIN WORLD (Page Context)     │
│                                     │                                │
│  ┌─────────────────────────────┐    │  ┌──────────────────────────┐  │
│  │     content/main.js         │    │  │    bridge/main.js        │  │
│  │  - Orchestration            │────┼──│  - Main loop             │  │
│  │  - Bridge injection         │    │  │  - Registry init         │  │
│  └─────────────────────────────┘    │  └──────────────────────────┘  │
│                                     │              │                 │
│  ┌─────────────────────────────┐    │  ┌──────────────────────────┐  │
│  │  content/modules/state.js   │    │  │   MANAGER CLASSES        │  │
│  │  POIStateManager            │    │  │   - MapHijackManager     │  │
│  │  - Chrome storage           │    │  │   - MapDiscoveryManager  │  │
│  │  - Preferences              │    │  │   - NetworkSnifferManager│  │
│  └─────────────────────────────┘    │  │   - PortalManager        │  │
│                                     │  └──────────────────────────┘  │
│  ┌─────────────────────────────┐    │              │                 │
│  │  content/modules/overlay.js │    │  ┌──────────────────────────┐  │
│  │  OverlayManager             │    │  │   OVERLAY SYSTEM         │  │
│  │  - DOM overlay rendering    │    │  │   - OverlayRegistry      │  │
│  └─────────────────────────────┘    │  │   - OverlayFactory       │  │
│                                     │  │   - Site-specific overlays│  │
│                                     │  └──────────────────────────┘  │
└─────────────────────────────────────┴────────────────────────────────┘
```

## Directory Structure

```
shullow/
├── manifest.json              # Extension manifest (v3)
├── background/
│   └── background.js          # Service worker
├── bridge/
│   ├── main.js                # MAIN world orchestrator
│   ├── bridge-bundle.js       # Bundled scripts for injection
│   └── modules/
│       ├── ManagerBase.js     # Singleton base class
│       ├── mapUtilities.js    # MapUtils, MarkerPool, MapTypeDetector
│       ├── hijack.js          # MapHijackManager - constructor interception
│       ├── discovery.js       # MapDiscoveryManager - map discovery
│       ├── sniff.js           # NetworkSnifferManager - network monitoring
│       ├── portal.js          # PortalManager - cross-world communication
│       └── renderer.js        # [DEPRECATED] Legacy renderer
├── content/
│   ├── main.js                # Content script entry
│   ├── detector.js            # MapDetector utility
│   ├── content.css            # Overlay styles
│   └── modules/
│       ├── state.js           # POIStateManager
│       ├── overlay.js         # OverlayManager (content-side)
│       └── events.js          # Event handling
├── overlays/
│   ├── MapOverlayBase.js      # Abstract base class
│   ├── GoogleMapsOverlayBase.js  # Google Maps base
│   ├── MapboxOverlayBase.js   # Mapbox GL JS base
│   ├── ZillowOverlay.js       # Zillow.com overlay
│   ├── RedfinOverlay.js       # Redfin.com overlay
│   ├── HomesComOverlay.js     # Homes.com overlay
│   ├── OneKeyOverlay.js       # OneKeyMLS.com overlay
│   ├── RealtorOverlay.js      # Realtor.com overlay
│   ├── GenericMapOverlay.js   # Fallback overlay
│   ├── OverlayRegistry.js     # Map-overlay registry
│   ├── overlayFactory.js      # Overlay factory
│   └── overlayConfig.json     # Site configuration
└── popup/
    └── popup.html             # Extension popup UI
```

## Class Hierarchy

### Manager Classes (Singletons)

All manager classes extend `ManagerBase` which provides:
- Singleton enforcement
- Async initialization lifecycle
- Debug logging

```
ManagerBase
├── MapHijackManager      (window.poiHijack)
├── MapDiscoveryManager   (window.poiDiscovery)
├── NetworkSnifferManager (window.poiSniff)
├── PortalManager         (window.poiPortal)
└── POIStateManager       (window.poiState)
```

### Overlay Classes

```
MapOverlayBase (Abstract)
├── GoogleMapsOverlayBase
│   ├── RedfinOverlay
│   └── HomesComOverlay
├── MapboxOverlayBase
│   ├── ZillowOverlay
│   └── OneKeyOverlay
├── RealtorOverlay (Hybrid - handles both)
└── GenericMapOverlay (Universal fallback)
```

## Key Components

### OverlayRegistry (Phase 6.5)

The `OverlayRegistry` solves the domain pollution problem:

**Problem**: When loading sites like Realtor.com, scripts would see domains from iframes/ads, causing wrong overlays to be instantiated.

**Solution**: 
1. Domain detection happens AT map discovery time
2. Each map gets a unique ID and locked domain
3. Network requests CANNOT change overlay assignments

```javascript
// Domain is detected and locked when map is registered
const entry = overlayRegistry.register(mapInstance, container);
// entry.domain is now immutable
```

### OverlayFactory

Creates appropriate overlay instances based on domain:

```javascript
// Get overlay for a domain
const overlay = overlayFactory.createOverlay('zillow.com');

// Or for a specific map (uses container context)
const overlay = overlayFactory.createOverlayForMap(mapInstance, container);
```

### MapHijackManager

Intercepts map constructors to capture instances:

```javascript
// Intercepts google.maps.Map constructor
// Intercepts mapboxgl.Map constructor
window.poiHijack.apply();
```

### MapDiscoveryManager

Discovers maps via multiple strategies:
- Mapbox global registry
- Web Components / Shadow DOM
- React Fiber scanning
- DOM selectors

### NetworkSnifferManager

Monitors network traffic for bounds data:
- Fetch API interception
- XHR interception
- History API monitoring

**Important**: Does NOT extract domain info (Phase 6.5.3 compliance)

## Data Flow

```
1. Page loads → bridge/main.js starts loop
2. MapHijackManager intercepts map constructors
3. MapDiscoveryManager finds existing maps
4. Maps are registered with OverlayRegistry (domain locked)
5. OverlayFactory creates site-specific overlay
6. NetworkSnifferManager extracts bounds
7. POI data flows from content world via postMessage
8. Overlay's renderMarkers() displays markers
```

## Configuration

Site configuration is in `overlays/overlayConfig.json`:

```json
{
  "sites": {
    "zillow.com": {
      "overlay": "ZillowOverlay",
      "mapType": "mapbox",
      "priority": 100
    }
  }
}
```

## Adding a New Site

1. Create `overlays/NewSiteOverlay.js` extending appropriate base
2. Implement `detect()`, `isCompatibleMap()`, `renderMarkers()`
3. Add configuration to `overlayConfig.json`
4. Register class in `overlayFactory.registerFromWindow()`

## Debug Mode

Enable debug logging:

```javascript
window.overlayRegistry.setDebug(true);
window.overlayFactory.setDebug(true);
```

## Version History

- **v1.2**: OOP refactor with site-specific overlays and OverlayRegistry
- **v1.1**: Initial release with basic map injection
