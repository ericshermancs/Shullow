/**
 * POI Extension: Background Service Worker
 * Handles long-running operations: import/clear, remote URL syncing, daily alarm.
 */

import { parseCSV } from '../data/csv-parser.js';
import { parseJSON } from '../data/json-parser.js';
import { updateGroupPOIs } from '../data/data-manager.js';

// ============================================
// ALARM REGISTRATION
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('shullow-daily-sync', { periodInMinutes: 1440 });
});

chrome.runtime.onStartup.addListener(() => {
  // Idempotent: Chrome deduplicates alarms by name
  chrome.alarms.create('shullow-daily-sync', { periodInMinutes: 1440 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'shullow-daily-sync') {
    runAutoSync();
  }
});

// ============================================
// MESSAGE HANDLER
// ============================================

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

  if (msg.action === 'manual-sync-group') {
    syncGroup(msg.profileUuid, msg.groupUuid)
      .then((result) => sendResponse({ status: 'ok', ...result }))
      .catch(err => sendResponse({ status: 'error', error: err.message }));
    return true;
  }
});

// ============================================
// SYNC LOGIC
// ============================================

/**
 * Runs auto-sync for all groups with sourceUrl + syncEnabled across all profiles.
 */
async function runAutoSync() {
  const data = await chrome.storage.local.get(['profiles']);
  const profiles = data.profiles || {};

  for (const [profileUuid, profile] of Object.entries(profiles)) {
    for (const [groupUuid, group] of Object.entries(profile.groups || {})) {
      if (group.sourceUrl && group.syncEnabled) {
        try {
          await syncGroup(profileUuid, groupUuid);
        } catch (e) {
          console.error(`[AutoSync] Failed for group ${groupUuid}:`, e);
        }
      }
    }
  }
}

/**
 * Fast non-cryptographic djb2 hash for change detection.
 * @param {string} text
 * @returns {string}
 */
function computeHash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Fetches a group's sourceUrl, checks for content changes, and updates POIs if changed.
 * @param {string} profileUuid
 * @param {string} groupUuid
 * @returns {Promise<object>}
 */
async function syncGroup(profileUuid, groupUuid) {
  const data = await chrome.storage.local.get(['profiles']);
  const profiles = data.profiles || {};
  const profile = profiles[profileUuid];
  if (!profile) throw new Error('Profile not found');
  const group = profile.groups?.[groupUuid];
  if (!group) throw new Error('Group not found');
  if (!group.sourceUrl) throw new Error('No sourceUrl on group');

  const now = Date.now();
  let text;

  try {
    const response = await fetch(group.sourceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    text = await response.text();
  } catch (fetchErr) {
    await updateGroupPOIs(profileUuid, groupUuid, null, {
      lastSynced: now,
      lastSyncStatus: 'error',
      lastSyncError: fetchErr.message,
      contentHash: group.contentHash ?? null
    });
    return { lastSynced: now, lastSyncStatus: 'error', lastSyncError: fetchErr.message };
  }

  const newHash = computeHash(text);

  if (newHash === group.contentHash) {
    await updateGroupPOIs(profileUuid, groupUuid, null, {
      lastSynced: now,
      lastSyncStatus: 'success',
      lastSyncError: null,
      contentHash: newHash
    });
    return { lastSynced: now, lastSyncStatus: 'success', changed: false };
  }

  let pois;
  try {
    const trimmed = text.trimStart();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      pois = parseJSON(text);
    } else {
      pois = parseCSV(text);
    }
  } catch (parseErr) {
    await updateGroupPOIs(profileUuid, groupUuid, null, {
      lastSynced: now,
      lastSyncStatus: 'error',
      lastSyncError: `Parse error: ${parseErr.message}`,
      contentHash: group.contentHash ?? null
    });
    return { lastSynced: now, lastSyncStatus: 'error', lastSyncError: parseErr.message };
  }

  await updateGroupPOIs(profileUuid, groupUuid, pois, {
    lastSynced: now,
    lastSyncStatus: 'success',
    lastSyncError: null,
    contentHash: newHash
  });

  // Also stamp lastSynced on all other groups in this profile sharing the same sourceUrl
  const refreshedData = await chrome.storage.local.get(['profiles']);
  const refreshedProfile = (refreshedData.profiles || {})[profileUuid];
  if (refreshedProfile) {
    let patched = false;
    for (const [sibUuid, sibGroup] of Object.entries(refreshedProfile.groups || {})) {
      if (sibUuid !== groupUuid && sibGroup.sourceUrl === group.sourceUrl) {
        sibGroup.lastSynced = now;
        sibGroup.lastSyncStatus = 'success';
        sibGroup.lastSyncError = null;
        sibGroup.contentHash = newHash;
        patched = true;
      }
    }
    if (patched) {
      const allProfiles = refreshedData.profiles;
      allProfiles[profileUuid] = refreshedProfile;
      await chrome.storage.local.set({ profiles: allProfiles });
    }
  }

  return { lastSynced: now, lastSyncStatus: 'success', changed: true, poiCount: pois.length };
}

// ============================================
// EXISTING HANDLERS (now using robust parsers)
// ============================================
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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
