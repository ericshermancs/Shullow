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
  }
};
