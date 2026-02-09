# Shullow - Map POI Injector

A Chrome extension that injects Points of Interest (POI) markers onto real estate map websites. Features site-specific overlays optimized for Zillow, Redfin, Homes.com, OneKeyMLS, Realtor.com, and any generic Google Maps or Mapbox implementation.

## Supported Sites

- **Zillow.com** - Mapbox GL JS
- **Redfin.com** - Google Maps with Redux integration
- **Homes.com** - Google Maps with Shadow DOM/Web Components
- **OneKeyMLS.com** - Mapbox GL JS
- **Realtor.com** - Auto-detection (Google Maps or Mapbox)
- **Any site with Google Maps or Mapbox** - Generic fallback

## Features

- 🗺️ **Site-Specific Overlays** - Custom implementations optimized for each platform's map library
- 🔍 **Robust Map Detection** - Finds maps via constructor hijacking, React Fiber scanning, and DOM analysis
- 🎨 **Customizable Markers** - Color wheels, secondary colors, and custom logo support per POI group
- 📦 **Marker Pooling** - Efficient DOM reuse for performance optimization
- 🔒 **Domain Locking** - Prevents iframe/ad pollution in overlay assignment
- 📊 **CSV/JSON Import** - Load POI data from standard formats
- 🌙 **Dark Theme UI** - Sleek industrial-themed popup interface with theme customization

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/Shullow.git
   cd Shullow
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top right)

4. Click "Load unpacked" and select the project folder

5. The extension icon will appear in your toolbar - click it to open the popup

## Quick Start

1. Navigate to a supported real estate map website (Zillow, Redfin, etc.)
2. Open the extension popup by clicking the icon
3. Create a new POI group with a name
4. Upload CSV or JSON files containing your POI data
5. Toggle the overlay on/off for the current site
6. Customize colors and logos for your groups via the color wheel interface

## Gallery

### Map Overlay Examples

Experience Shullow across different real estate platforms:

#### Zillow - Columbus Area with GoDaven POI Data
![Zillow Markers - Columbus](docs/images/examples/ZillowColumbusGoDaven.png)
*Custom Shullow POI markers with custom pop-up information from your CSV files*

#### Homes.com - Flushing with Shullow Overlay
![Homes.com Overlay](docs/images/examples/HomesFlushingShullowOverlayExample.png)
*Shullow extension plugin menu. Control the plugin theme, add groups, rename them, customize them!*

#### Realtor.com - US Young Israel Listing
![Realtor.com Integration](docs/images/examples/RealtorScreenshotUSYoungIsrael.png)
*Custom icons for your Shullow POI groups so you can distinguish between them easily at any zoom level*

#### Airbnb - Cancun with GoDaven Data
![Airbnb Markers - Cancun](docs/images/examples/AirbnbCancunGoDaven.png)
*Demonstrating generic map support extending beyond real estate sites, like if you need to find an AirBNB in Cancun within walking distance to a minyan on Shabbat*

**To add more images:**
1. Capture screenshots showing the extension in action
2. Record GIFs of interactions (uploading data, toggling overlays, customizing colors)
3. Add PNG/GIF files to `docs/images/examples/`
4. Update this section with descriptive captions

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for comprehensive technical documentation.

### High-Level Overview

The extension operates across two security contexts:

```
CONTENT WORLD (Isolated)          MAIN WORLD (Page Context)
        ↓                                    ↓
   Content Scripts         ←Bridge Injection→    DOM/Map Access
   (Storage, Messaging)            ↓         (Constructor Hijacking)
        ↓                    Manager Classes     ↓
   Overlay Rendering  ←→  postMessage  ←→  Map Discovery & Data Routing
```

**Key Components:**
- **Bridge Managers** - Intercept map constructors and monitor network activity in the page context
- **Overlay System** - Site-specific classes that handle marker rendering for each platform
- **POI State** - Chrome storage integration for groups, preferences, and data persistence
- **Portal** - Cross-context communication via postMessage protocol

### Directory Structure

```
├── manifest.json              # Extension manifest (MV3)
├── background/
│   └── background.js          # Service worker
├── bridge/                     # MAIN world context (page access)
│   ├── main.js                # Initialization and loop
│   ├── entry.js               # Entry point
│   └── modules/
│       ├── ManagerBase.js     # Singleton pattern base
│       ├── mapUtilities.js    # MapUtils, MarkerPool, MapTypeDetector
│       ├── hijack.js          # MapHijackManager
│       ├── discovery.js       # MapDiscoveryManager
│       ├── sniff.js           # NetworkSnifferManager
│       ├── portal.js          # PortalManager
│       └── renderer.js        # Legacy renderer
├── content/                    # CONTENT world context (isolated)
│   ├── main.js                # Content script entry
│   ├── entry-gate.js          # Early initialization gate
│   ├── detector.js            # Map detection utilities
│   ├── content.css            # Overlay styles
│   └── modules/
│       ├── state.js           # POIStateManager
│       ├── overlay.js         # OverlayManager
│       └── events.js          # Event handlers
├── overlays/                   # Overlay registry & site configuration
│   ├── OverlayRegistry.js      # Multi-map registry (Phase 6.5)
│   ├── siteConfig.js           # Centralized site-specific config
│   ├── overlayFactory.js       # Overlay instance factory
│   └── overlayConfig.json      # Site configuration
├── popup/                      # Extension UI
│   ├── popup.html
│   ├── popup.js
│   ├── popup.css
│   └── modules/
│       ├── color-wheel.js
│       └── storage.js
└── data/                       # Data utilities
    ├── data-manager.js
    ├── csv-parser.js
    └── json-parser.js
```

## Data Flow

```
1. Page loads → bridge/main.js starts manager loop
2. MapHijackManager intercepts google.maps.Map & mapboxgl.Map constructors
3. MapDiscoveryManager finds existing maps (Fiber scanning, Shadow DOM, globals)
4. Maps are registered with OverlayRegistry (domain is locked at this point)
5. OverlayFactory creates site-specific overlay based on domain
6. NetworkSnifferManager monitors fetch/XHR for bounds data
7. POI groups flow from content world via postMessage (Chrome storage)
8. Overlay's renderMarkers() displays markers based on current bounds
```

## Contributing

We welcome contributions! Whether you're adding support for new sites, improving performance, or fixing bugs, please follow these guidelines.

### Getting Started

1. **Fork and Clone**
   ```bash
   git clone https://github.com/yourusername/Shullow.git
   cd Shullow
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/description-of-feature
   # or for bug fixes:
   git checkout -b fix/description-of-bug
   # or for documentation:
   git checkout -b docs/description
   ```

3. **Make Your Changes**
   - Write clear, descriptive commit messages
   - Follow the code style established in the project
   - Test thoroughly on target sites
   - Update documentation if needed

4. **Testing**
   - Load the extension via `chrome://extensions/` → "Load unpacked"
   - Test on actual websites, not just in isolation
   - Enable debug mode: `window.overlayRegistry.setDebug(true)` in console
   - Check browser console for errors

5. **Submit a Pull Request**
   - Push your branch to your fork
   - Create a pull request with a clear description
   - Reference any related issues
   - Wait for review and address feedback

### Adding Support for a New Site

**Example: Adding support for Trulia.com**

1. Create `overlays/TruliaOverlay.js`:
```javascript
class TruliaOverlay extends GoogleMapsOverlayBase {
  constructor(debug = false) {
    super(debug);
    this.siteId = 'trulia';
  }

  detect() {
    // Return map container element or null
    const mapEl = document.querySelector('[data-testid="map-container"]');
    return mapEl ? mapEl : null;
  }

  isCompatibleMap(mapInstance) {
    // Verify this map instance is compatible with this overlay
    return MapTypeDetector.isGoogleMap(mapInstance);
  }

  async renderMarkers(bounds, markers) {
    // Custom rendering logic for Trulia's specific structure
    for (const marker of markers) {
      const markerEl = this.markerPool.get();
      // ... customize for Trulia's needs
    }
  }
}
```

2. Register in `overlayFactory.js`:
```javascript
overlayFactory.register('TruliaOverlay', TruliaOverlay);
```

3. Add configuration to `overlays/overlayConfig.json`:
```json
{
  "sites": {
    "trulia.com": {
      "overlay": "TruliaOverlay",
      "mapType": "google",
      "priority": 100
    }
  }
}
```

4. Test thoroughly on Trulia.com with debug mode enabled

### Code Style Guidelines

- **Variable Naming**: Use camelCase for variables and methods, PascalCase for classes
- **Comments**: Add comments explaining _why_, not just _what_
- **Async/Await**: Prefer async/await over callbacks
- **Error Handling**: Use try/catch and provide meaningful error messages
- **Performance**: Consider marker pooling and DOM updates - avoid unnecessary reflows
- **Debugging**: Use `this.debug()` method in manager classes for conditional logging

Example:
```javascript
class MyManager extends ManagerBase {
  async initialize() {
    try {
      await this.setupSomething();
      this.debug('MyManager initialized');
    } catch (err) {
      console.error('MyManager initialization failed:', err);
    }
  }
}
```

### Commit Message Convention

- `feat: add support for new site`
- `fix: prevent infinite loop in discovery`
- `docs: update architecture guide`
- `perf: optimize marker pooling`
- `refactor: simplify overlay hierarchy`
- `test: add detection tests`

### Issue Reports

When reporting issues, please include:
- URL of the affected website
- Browser version (Chrome version)
- Steps to reproduce
- Screenshots/error logs from console
- Expected vs. actual behavior

### Questions?

- Check [ARCHITECTURE.md](ARCHITECTURE.md) for technical deep-dives
- Look at existing overlays for examples
- Enable debug mode to understand the data flow
- Search existing issues/discussions

## Version History

- **v0.2** - Enhanced popup with donation link, improved architecture documentation
- **v0.1** - Initial release with core site detection and marker rendering

## License

MIT
