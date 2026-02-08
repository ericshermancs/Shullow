/**
 * POI Popup: Storage Module
 * Centralizes storage interaction and synchronization.
 */
export const StorageManager = {
  async loadState() {
    return await chrome.storage.local.get(['preferences', 'activeGroups']);
  },
  async saveState(preferences, activeGroups) {
    await chrome.storage.local.set({ preferences, activeGroups });
  },
  notifyTabsForHost(hostname, message) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (!tab.url) return;
        try {
          const tabHost = new URL(tab.url).hostname;
          if (tabHost === hostname) {
            chrome.tabs.sendMessage(tab.id, message, () => {
              if (chrome.runtime.lastError) console.log("Tab silent");
            });
          }
        } catch (e) {
          // ignore invalid URLs
        }
      });
    });
  },
  notifyContentScript(activeGroups, preferences, styleChangedGroup) {
    // Debounce: only send message once per 100ms to avoid multiple frames all receiving duplicate messages
    console.log(`[STORAGE] notifyContentScript: styleChangedGroup=${styleChangedGroup}, has groupStyles=${!!preferences.groupStyles}`);
    if (this._notifyTimeout) {
      clearTimeout(this._notifyTimeout);
    }
    this._notifyTimeout = setTimeout(() => {
      this._notifyTimeout = null;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'update-active-groups',
            activeGroups,
            preferences,
            styleChangedGroup
          }, () => {
              if (chrome.runtime.lastError) console.log("Tab silent");
          });
        }
      });
    }, 100); // 100ms debounce - catches all frames from single toggle
  }
};
