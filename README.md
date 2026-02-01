# POI TITAN - Map POI Injector

A Chrome extension that injects Points of Interest (POI) markers onto real estate map websites.

## Supported Sites

- **Zillow.com** - Mapbox GL JS
- **Redfin.com** - Google Maps with Redux integration
- **Homes.com** - Google Maps with Shadow DOM/Web Components
- **OneKeyMLS.com** - Mapbox GL JS
- **Realtor.com** - Auto-detection (Google Maps or Mapbox)
- **Any site with Google Maps or Mapbox** - Generic fallback

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project folder

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed documentation.

### Key Features

- **Site-Specific Overlays**: Each supported site has a custom overlay class optimized for that site's map implementation
- **Multi-Map Isolation**: Domain detection happens at map discovery time, preventing interference from ads/iframes
- **OOP Design**: All managers use singleton pattern with async initialization
- **Marker Pooling**: Reusable marker elements to reduce DOM operations
- **Batched Rendering**: Google Maps uses OverlayView batching for performance

### Directory Structure

```
shullow/
├── background/          # Service worker
├── bridge/              # MAIN world scripts
│   └── modules/         # Manager classes
├── content/             # Content world scripts
│   └── modules/         # State and overlay managers
├── overlays/            # Site-specific overlay classes
├── popup/               # Extension popup UI
└── manifest.json
```

## Development

### Adding a New Site

1. Create `overlays/NewSiteOverlay.js`:

```javascript
class NewSiteOverlay extends GoogleMapsOverlayBase { // or MapboxOverlayBase
  constructor(debug = false) {
    super(debug);
    this.siteId = 'newsite';
  }

  detect() {
    // Return map container element or null
    return document.querySelector('.map-container');
  }

  isCompatibleMap(mapInstance) {
    // Return true if this overlay can handle the map
    return MapTypeDetector.isGoogleMap(mapInstance);
  }
}
```

2. Add to `overlays/overlayConfig.json`:

```json
{
  "sites": {
    "newsite.com": {
      "overlay": "NewSiteOverlay",
      "mapType": "google",
      "priority": 100
    }
  }
}
```

### Debug Mode

```javascript
// In browser console on target site
window.overlayRegistry.setDebug(true);
window.overlayFactory.setDebug(true);
```

## Version History

- **v1.2**: OOP refactor with site-specific overlays
- **v1.1**: Initial release

## License

MIT