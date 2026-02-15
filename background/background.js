/**
 * POI Extension: Background Script
 * Handles long-running operations like import/clear that should persist
 * even if the popup is dismissed.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Handle import operation (can run even if popup is closed)
  if (msg.action === 'background-import-groups') {
    handleBackgroundImport(msg.groups)
      .then(() => sendResponse({ status: 'ok' }))
      .catch(err => sendResponse({ status: 'error', error: err.message }));
    return true; // Keep channel open for async response
  }

  // Handle clear all groups from profile (can run even if popup is closed)
  if (msg.action === 'background-clear-all-groups') {
    handleClearAllGroups(msg.profileUuid)
      .then(() => sendResponse({ status: 'ok' }))
      .catch(err => sendResponse({ status: 'error', error: err.message }));
    return true;
  }
});

/**
 * Import groups in background (doesn't require popup)
 */
async function handleBackgroundImport(exportedGroups) {
  const storage = chrome.storage.local;
  const data = await storage.get(['profiles', 'activeProfile']);
  const profiles = data.profiles || {};
  const activeProfileUuid = data.activeProfile;
  const activeProfile = profiles[activeProfileUuid];

  if (!activeProfile) {
    throw new Error('No active profile found');
  }

  if (!activeProfile.groups) activeProfile.groups = {};
  if (!activeProfile.groupStyles) activeProfile.groupStyles = {};

  let importedCount = 0;

  for (const group of exportedGroups) {
    if (!group.name || !group.data) continue;

    try {
      // Parse the CSV data
      const pois = parseCSV(group.data);
      if (pois.length > 0) {
        const newUuid = generateUUID();

        activeProfile.groups[newUuid] = {
          uuid: newUuid,
          name: group.name,
          pois: pois
        };

        activeProfile.groupStyles[newUuid] = {
          color: group.colors?.primary || '#d1ff00',
          secondaryColor: group.colors?.secondary || '#ffffff',
          logoData: group.icon && group.icon.length < 50000 ? group.icon : null
        };

        importedCount++;
      }
    } catch (groupError) {
      console.error(`Failed to import group "${group.name}":`, groupError);
    }
  }

  if (importedCount > 0) {
    profiles[activeProfileUuid] = activeProfile;
    await storage.set({ profiles });
    console.log(`Background: Imported ${importedCount} groups`);
  }

  return { imported: importedCount };
}

/**
 * Clear all groups from a profile
 */
async function handleClearAllGroups(profileUuid) {
  const storage = chrome.storage.local;
  const data = await storage.get(['profiles']);
  const profiles = data.profiles || {};
  const profile = profiles[profileUuid];

  if (!profile) {
    throw new Error('Profile not found');
  }

  const deletedCount = Object.keys(profile.groups || {}).length;
  profile.groups = {};
  profile.groupStyles = {};
  profile.activeGroups = {};

  profiles[profileUuid] = profile;
  await storage.set({ profiles });
  console.log(`Background: Cleared ${deletedCount} groups from profile`);

  return { cleared: deletedCount };
}

/**
 * Parse CSV data (copied from data-manager for background context)
 */
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const latIdx = headers.indexOf('latitude');
  const lonIdx = headers.indexOf('longitude');
  const idIdx = headers.indexOf('id');
  const nameIdx = headers.indexOf('name');
  const groupNameIdx = headers.indexOf('groupname');

  const pois = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length <= Math.max(latIdx, lonIdx)) continue;

    const lat = parseFloat(values[latIdx]);
    const lon = parseFloat(values[lonIdx]);
    if (isNaN(lat) || isNaN(lon)) continue;

    pois.push({
      id: values[idIdx] || `poi-${i}`,
      name: values[nameIdx] || `POI ${i}`,
      latitude: lat,
      longitude: lon,
      groupName: values[groupNameIdx] || null
    });
  }
  return pois;
}

/**
 * Generate UUID (copied from data-manager for background context)
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
