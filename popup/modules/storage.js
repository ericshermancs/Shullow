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
  notifyContentScript(activeGroups, preferences) {
    // Debounce: only send message once per 100ms to avoid multiple frames all receiving duplicate messages
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
            preferences
          }, () => {
              if (chrome.runtime.lastError) console.log("Tab silent");
          });
        }
      });
    }, 100); // 100ms debounce - catches all frames from single toggle
  }
};
