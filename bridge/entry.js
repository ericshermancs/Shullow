// bridge/entry.js
// Imports all bridge modules for bundling

import '../bridge/main.js';

// Bridge modules (base classes first)
import '../bridge/modules/ManagerBase.js';
import '../bridge/modules/mapUtilities.js';
import '../bridge/modules/hijack.js';
import '../bridge/modules/discovery.js';
// import '../bridge/modules/sniff.js'; // DISABLED: Network sniffing removed for security (bounds tracked via instance events)
import '../bridge/modules/portal.js';
import '../bridge/modules/renderer.js';

// Site configuration and registry
import '../overlays/siteConfig.js';
import '../overlays/OverlayRegistry.js';

