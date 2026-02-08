/**
 * POI Entry Gate (document_start)
 * Decides whether to inject bridge bundle for this subdomain.
 */
(function() {
  const getEffectiveHost = () => {
    if (window.top === window) return window.location.hostname;
    try {
      if (document.referrer) return new URL(document.referrer).hostname;
    } catch (e) {}
    return window.location.hostname;
  };
  const host = getEffectiveHost();

  const getSiteEnabled = (preferences) => {
    const sitePref = preferences?.sitePreferences?.[host];
    if (sitePref && typeof sitePref.siteEnabled === 'boolean') return sitePref.siteEnabled;
    if (sitePref && typeof sitePref.overlayEnabled === 'boolean') return sitePref.overlayEnabled;
    return true;
  };

  const injectBridgeBundle = () => {
    if (document.getElementById('poi-bridge-bundle')) return;
    const status = document.documentElement.getAttribute('data-poi-bridge-status');
    if (status === 'ONLINE') return;

    const script = document.createElement('script');
    script.id = 'poi-bridge-bundle';
    script.src = chrome.runtime.getURL('bridge/bridge-bundle.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  };

  chrome.storage.local.get(['preferences']).then(({ preferences }) => {
    if (getSiteEnabled(preferences)) {
      injectBridgeBundle();
    }
  }).catch(() => {
    // Fail open to avoid breaking existing behavior if storage fails
    injectBridgeBundle();
  });
})();
