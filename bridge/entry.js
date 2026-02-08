// bridge/entry.js
// Imports all bridge modules and overlays for bundling

import '../bridge/main.js';

// Bridge modules (base classes first)
import '../bridge/modules/ManagerBase.js';
import '../bridge/modules/mapUtilities.js';
import '../bridge/modules/hijack.js';
import '../bridge/modules/discovery.js';
// import '../bridge/modules/sniff.js'; // DISABLED: Network sniffing removed for security (bounds tracked via instance events)
import '../bridge/modules/portal.js';
import '../bridge/modules/renderer.js';

// Overlays (config and base classes first)
import '../overlays/siteConfig.js';
import '../overlays/MapOverlayBase.js';
import '../overlays/GoogleMapsOverlayBase.js';
import '../overlays/MapboxOverlayBase.js';
import '../overlays/ZillowOverlay.js';
import '../overlays/RedfinOverlay.js';
import '../overlays/HomesComOverlay.js';
import '../overlays/OneKeyOverlay.js';
import '../overlays/RealtorOverlay.js';
import '../overlays/GenericMapOverlay.js';
import '../overlays/OverlayRegistry.js';
import '../overlays/overlayFactory.js';
