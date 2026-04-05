// Data management module for Map POI Injector
// UUID-based group management

import { parseCSV } from './csv-parser.js';
import { parseJSON } from './json-parser.js'; 

/**
 * Generates a UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Migrates old name-based storage to UUID-based storage
 * @returns {Promise<boolean>} True if migration was performed
 */
export async function migrateToUUIDs(useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups', 'preferences', 'activeGroups', '_uuidMigrated']);
    
    // Skip if already migrated
    if (data._uuidMigrated) return false;
    
    const oldPoiGroups = data.poiGroups || {};
    const oldPreferences = data.preferences || {};
    const oldActiveGroups = data.activeGroups || {};
    const oldGroupStyles = oldPreferences.groupStyles || {};
    
    // Check if this is old format (keys are group names, not UUIDs)
    const keys = Object.keys(oldPoiGroups);
    if (keys.length === 0) {
      // Empty, just mark as migrated
      await storage.set({ _uuidMigrated: true });
      return false;
    }
    
    // Check if already in UUID format (UUIDs contain hyphens and are 36 chars)
    const isUUID = keys[0].length === 36 && keys[0].includes('-');
    if (isUUID) {
      await storage.set({ _uuidMigrated: true });
      return false;
    }
    
    // Perform migration
    const newPoiGroups = {};
    const newActiveGroups = {};
    const newGroupStyles = {};
    const nameToUuidMap = {};
    
    for (const [oldName, pois] of Object.entries(oldPoiGroups)) {
      const uuid = generateUUID();
      nameToUuidMap[oldName] = uuid;
      
      newPoiGroups[uuid] = {
        name: oldName,
        pois: Array.isArray(pois) ? pois : []
      };
      
      // Migrate active status
      newActiveGroups[uuid] = oldActiveGroups[oldName] !== false;
      
      // Migrate styles
      if (oldGroupStyles[oldName]) {
        newGroupStyles[uuid] = oldGroupStyles[oldName];
      }
    }
    
    // Update preferences with new groupStyles
    const newPreferences = {
      ...oldPreferences,
      groupStyles: newGroupStyles
    };
    
    await storage.set({
      poiGroups: newPoiGroups,
      preferences: newPreferences,
      activeGroups: newActiveGroups,
      _uuidMigrated: true
    });
    
    console.log(`Migrated ${keys.length} groups to UUID format`);
    return true;
  } catch (error) {
    console.error('Error during migration:', error);
    return false;
  }
}

/**
 * Imports data from various sources.
 */
export function importData(dataString, format) {
  switch (format) {
    case 'csv':
      return parseCSV(dataString);
    case 'json':
      return parseJSON(dataString);
    default:
      console.error(`Unsupported format: ${format}`);
      return [];
  }
}

/**
 * Saves POI data to Chrome storage.
 * @param {Array} pois - Array of POI objects
 * @param {string} groupName - Display name for the group
 * @param {boolean} useSyncStorage - Use sync storage instead of local
 * @param {string} uuid - Optional UUID for the group (generates new one if not provided)
 * @returns {Promise<string>} UUID of the created/updated group
 */
/**
 * Generates a random color for POI pins
 */
function generateRandomColor() {
  const colors = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Salmon
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Sky Blue
    '#F8B739', // Orange
    '#52C4B1', // Turquoise
    '#FF8A80', // Light Red
    '#81C784', // Green
    '#64B5F6', // Light Blue
    '#FFB74D', // Light Orange
    '#E91E63'  // Pink
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export async function savePOIs(pois, groupName, useSyncStorage = false, uuid = null) {
  if (!groupName) return null;
  
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['profiles', 'activeProfile', 'poiGroups', 'preferences']);
    const profiles = data.profiles || {};
    const activeProfileUuid = data.activeProfile;
    const activeProfile = profiles[activeProfileUuid];
    
    if (!activeProfile) {
      console.error('No active profile found');
      return null;
    }
    
    // Initialize profile groups storage if needed
    if (!activeProfile.groups) {
      activeProfile.groups = {};
    }
    
    const groupUuid = uuid || generateUUID();
    const isNewGroup = !activeProfile.groups[groupUuid];
    
    if (isNewGroup) {
      activeProfile.groups[groupUuid] = {
        uuid: groupUuid,
        name: groupName,
        pois: []
      };
      
      // Assign random color to new group and store in profile's groupStyles
      if (!activeProfile.groupStyles) activeProfile.groupStyles = {};
      activeProfile.groupStyles[groupUuid] = {
        color: generateRandomColor(),
        secondaryColor: '#ffffff',
        logoData: null
      };
    }
    
    // Simple append logic
    activeProfile.groups[groupUuid].pois = activeProfile.groups[groupUuid].pois.concat(pois);
    activeProfile.groups[groupUuid].name = groupName; // Update name in case it changed
    
    // Update profiles in storage
    profiles[activeProfileUuid] = activeProfile;
    await storage.set({ profiles });
    
    console.log(`Saved ${pois.length} POIs to group: ${groupName} (${groupUuid}) in profile: ${activeProfile.name}`);
    return groupUuid;
  } catch (error) {
    console.error('Error saving POIs:', error);
    return null;
  }
}

/**
 * Loads all POI groups for the active profile.
 * Groups are now stored per-profile, not globally.
 * @returns {Promise<Object>} Object with UUIDs as keys, {name, pois, uuid} as values
 */
export async function loadPOIGroups(useSyncStorage = false) {
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['profiles', 'activeProfile', 'poiGroups']);
    const profiles = data.profiles || {};
    const activeProfileUuid = data.activeProfile;
    const activeProfile = profiles[activeProfileUuid];
    
    // Return groups from active profile
    if (activeProfile && activeProfile.groups) {
      return activeProfile.groups;
    }
    
    // Fallback to legacy global poiGroups for backwards compatibility
    return data.poiGroups || {};
  } catch (error) {
    console.error('Error loading POIs:', error);
    return {};
  }
}

/**
 * Renames a group in the active profile.
 * @param {string} uuid - UUID of the group
 * @param {string} newName - New name for the group
 */
export async function renamePOIGroup(uuid, newName, useSyncStorage = false) {
  if (!uuid || !newName) return;
  
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['profiles', 'activeProfile', 'poiGroups']);
    const profiles = data.profiles || {};
    const activeProfileUuid = data.activeProfile;
    const activeProfile = profiles[activeProfileUuid];
    
    // Try to rename in active profile first
    if (activeProfile && activeProfile.groups && activeProfile.groups[uuid]) {
      activeProfile.groups[uuid].name = newName;
      profiles[activeProfileUuid] = activeProfile;
      await storage.set({ profiles });
      return;
    }
    
    // Fallback to legacy global poiGroups for backwards compatibility
    const poiGroups = data.poiGroups || {};
    if (poiGroups[uuid]) {
      poiGroups[uuid].name = newName;
      await storage.set({ poiGroups });
    }
  } catch (error) {
    console.error('Error renaming group:', error);
  }
}

/**
 * Deletes a group from the active profile.
 * Each profile keeps its own copy of groups, so deleting from one profile
 * doesn't affect the same group in another profile.
 * @param {string} uuid - UUID of the group to delete
 */
export async function deletePOIGroup(uuid, useSyncStorage = false) {
  if (!uuid) return;
  
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['profiles', 'activeProfile', 'poiGroups']);
    const profiles = data.profiles || {};
    const activeProfileUuid = data.activeProfile;
    const activeProfile = profiles[activeProfileUuid];
    
    // Delete from active profile
    if (activeProfile && activeProfile.groups && activeProfile.groups[uuid]) {
      delete activeProfile.groups[uuid];
      
      // Also remove from profile's groupStyles if present
      if (activeProfile.groupStyles && uuid in activeProfile.groupStyles) {
        delete activeProfile.groupStyles[uuid];
      }
      
      profiles[activeProfileUuid] = activeProfile;
      await storage.set({ profiles });
      
      // Remove from profile's groupUuids array if it exists
      const groupUuidsIndex = activeProfile.groupUuids?.indexOf(uuid);
      if (groupUuidsIndex !== undefined && groupUuidsIndex >= 0) {
        activeProfile.groupUuids.splice(groupUuidsIndex, 1);
        profiles[activeProfileUuid] = activeProfile;
        await storage.set({ profiles });
      }
      return;
    }
    
    // Fallback to legacy global poiGroups for backwards compatibility
    const poiGroups = data.poiGroups || {};
    if (poiGroups[uuid]) {
      delete poiGroups[uuid];
      await storage.set({ poiGroups });
    }
  } catch (error) {
    console.error('Error deleting group:', error);
  }
}

/**
 * Exports groups for the active profile with their data, icons, and color preferences.
 * Each profile's groups are independent, so exporting one profile won't include groups from other profiles.
 * Returns an array of group objects ready to be saved as JSON.
 */
export async function exportGroupsData(useSyncStorage = false) {
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['profiles', 'activeProfile']);
    const profiles = data.profiles || {};
    const activeProfileUuid = data.activeProfile;
    const activeProfile = profiles[activeProfileUuid];
    
    if (!activeProfile || !activeProfile.groups) {
      return [];
    }
    
    const groupStyles = activeProfile.groupStyles || {};
    const exportData = [];
    
    for (const [uuid, groupData] of Object.entries(activeProfile.groups)) {
      const style = groupStyles[uuid] || {};
      const pois = groupData.pois || [];
      
      // Convert POI data to CSV string
      if (pois.length > 0) {
        const headers = Object.keys(pois[0]);
        const csvLines = [headers.join(',')];
        
        pois.forEach(poi => {
          const values = headers.map(h => {
            const val = poi[h];
            // Quote strings that contain commas
            if (typeof val === 'string' && val.includes(',')) {
              return `"${val}"`;
            }
            return val;
          });
          csvLines.push(values.join(','));
        });
        
        exportData.push({
          uuid: uuid,
          name: groupData.name,
          icon: style.logoData || null,
          colors: {
            primary: style.color || '#d1ff00',
            secondary: style.secondaryColor || '#ffffff'
          },
          data: csvLines.join('\n')
        });
      }
    }
    
    return exportData;
  } catch (error) {
    console.error('Error exporting groups:', error);
    return [];
  }
}

/**
 * Imports groups from exported format into the active profile.
 * Always generates new UUIDs for imported groups to avoid collisions.
 * Parses all groups and saves everything in a single storage write to avoid
 * triggering multiple content script refreshes.
 * @param {Array} exportedGroups - Array of exported group objects
 * @returns {Promise<Array>} Array of { groupUuid, groupName } for imported groups
 */
export async function importGroupsData(exportedGroups, useSyncStorage = false) {
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['profiles', 'activeProfile']);
    const profiles = data.profiles || {};
    const activeProfileUuid = data.activeProfile;
    const activeProfile = profiles[activeProfileUuid];
    
    if (!activeProfile) {
      console.error('No active profile found');
      return [];
    }
    
    if (!activeProfile.groups) activeProfile.groups = {};
    if (!activeProfile.groupStyles) activeProfile.groupStyles = {};
    if (!activeProfile.groupUuids) activeProfile.groupUuids = [];
    
    const imported = [];
    const existingUuids = new Set(activeProfile.groupUuids);
    
    for (const group of exportedGroups) {
      if (!group.name || !group.data) continue;
      
      try {
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
          
          if (!existingUuids.has(newUuid)) {
            activeProfile.groupUuids.push(newUuid);
            existingUuids.add(newUuid);
          }
          
          imported.push({ groupUuid: newUuid, groupName: group.name });
        }
      } catch (groupError) {
        console.error(`Failed to import group "${group.name}":`, groupError);
      }
    }
    
    // Single storage write for all groups
    if (imported.length > 0) {
      profiles[activeProfileUuid] = activeProfile;
      await storage.set({ profiles });
    }
    
    console.log(`Imported ${imported.length} groups into profile: ${activeProfile.name}`);
    return imported;
  } catch (error) {
    console.error('Error importing groups:', error);
    return [];
  }
}

/**
 * Saves multiple groups of POIs to Chrome storage in a single write.
 * Much faster than calling savePOIs in a loop for multiple groups.
 * @param {Array<{pois: Array, groupName: string}>} groups - Array of { pois, groupName }
 * @returns {Promise<Array<string>>} Array of created group UUIDs
 */
export async function savePOIsBatch(groups, useSyncStorage = false) {
  if (!groups.length) return [];
  
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['profiles', 'activeProfile']);
    const profiles = data.profiles || {};
    const activeProfileUuid = data.activeProfile;
    const activeProfile = profiles[activeProfileUuid];
    
    if (!activeProfile) {
      console.error('No active profile found');
      return [];
    }
    
    if (!activeProfile.groups) activeProfile.groups = {};
    if (!activeProfile.groupStyles) activeProfile.groupStyles = {};
    if (!activeProfile.groupUuids) activeProfile.groupUuids = [];
    
    const createdUuids = [];
    const existingUuids = new Set(activeProfile.groupUuids);
    
    for (const { pois, groupName } of groups) {
      if (!groupName || !pois.length) continue;
      
      const groupUuid = generateUUID();
      
      activeProfile.groups[groupUuid] = {
        uuid: groupUuid,
        name: groupName,
        pois: pois
      };
      
      activeProfile.groupStyles[groupUuid] = {
        color: generateRandomColor(),
        secondaryColor: '#ffffff',
        logoData: null
      };
      
      if (!existingUuids.has(groupUuid)) {
        activeProfile.groupUuids.push(groupUuid);
        existingUuids.add(groupUuid);
      }
      
      createdUuids.push(groupUuid);
    }
    
    // Single storage write
    if (createdUuids.length > 0) {
      profiles[activeProfileUuid] = activeProfile;
      await storage.set({ profiles });
    }
    
    console.log(`Batch saved ${createdUuids.length} groups to profile: ${activeProfile.name}`);
    return createdUuids;
  } catch (error) {
    console.error('Error batch saving POIs:', error);
    return [];
  }
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * Initializes profiles if they don't exist.
 * Migrates existing groups from legacy global storage to "Default" profile's per-profile storage.
 */
export async function initializeProfiles(useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['profiles', 'activeProfile', 'poiGroups', 'preferences', '_profilesInitialized']);
    
    if (data._profilesInitialized) return true;
    
    const poiGroups = data.poiGroups || {};
    const preferences = data.preferences || {};
    const groupUuids = Object.keys(poiGroups);
    const groupStyles = preferences.groupStyles || {};
    
    let profiles = {};
    
    // If there are existing groups, migrate them to "Default" profile
    if (groupUuids.length > 0) {
      const defaultProfileUuid = generateUUID();
      const groups = {};
      
      // Migrate groups to per-profile storage format
      for (const uuid of groupUuids) {
        groups[uuid] = {
          uuid: uuid,
          ...poiGroups[uuid]
        };
      }
      
      profiles[defaultProfileUuid] = {
        uuid: defaultProfileUuid,
        name: 'Default',
        createdDate: Date.now(),
        groups: groups, // Now stored per-profile
        groupStyles: groupStyles
      };
      
      await storage.set({
        profiles,
        activeProfile: defaultProfileUuid,
        _profilesInitialized: true
      });
      
      console.log(`Initialized profiles, migrated ${groupUuids.length} groups to Default profile's per-profile storage`);
      return true;
    } else {
      // No groups exist, create empty Default profile
      const defaultProfileUuid = generateUUID();
      profiles[defaultProfileUuid] = {
        uuid: defaultProfileUuid,
        name: 'Default',
        createdDate: Date.now(),
        groups: {}, // Per-profile group storage
        groupStyles: {}
      };
      
      await storage.set({
        profiles,
        activeProfile: defaultProfileUuid,
        _profilesInitialized: true
      });
      
      return true;
    }
  } catch (error) {
    console.error('Error initializing profiles:', error);
    return false;
  }
}

/**
 * Gets all profiles
 * @returns {Promise<Object>} Object with UUIDs as keys, profile objects as values
 */
export async function getProfiles(useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  await initializeProfiles(useSyncStorage);
  try {
    const data = await storage.get(['profiles']);
    return data.profiles || {};
  } catch (error) {
    console.error('Error getting profiles:', error);
    return {};
  }
}

/**
 * Gets the currently active profile
 * @returns {Promise<Object|null>} The active profile object or null
 */
export async function getActiveProfile(useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  await initializeProfiles(useSyncStorage);
  try {
    const data = await storage.get(['profiles', 'activeProfile']);
    const activeProfileUuid = data.activeProfile;
    const profiles = data.profiles || {};
    return profiles[activeProfileUuid] || null;
  } catch (error) {
    console.error('Error getting active profile:', error);
    return null;
  }
}

/**
 * Creates a new profile
 * @param {string} name - Profile name
 * @returns {Promise<string>} UUID of the created profile
 */
export async function createProfile(name, useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  await initializeProfiles(useSyncStorage);
  try {
    const data = await storage.get(['profiles']);
    const profiles = data.profiles || {};
    
    const profileUuid = generateUUID();
    profiles[profileUuid] = {
      uuid: profileUuid,
      name: name,
      createdDate: Date.now(),
      groupUuids: [],
      groupStyles: {}
    };
    
    await storage.set({ profiles });
    console.log(`Created profile: ${name} (${profileUuid})`);
    return profileUuid;
  } catch (error) {
    console.error('Error creating profile:', error);
    return null;
  }
}

/**
 * Switches to a different profile
 * Stores the active groups state for current profile before switching
 * @param {string} profileUuid - UUID of the profile to switch to
 * @param {Object} currentActiveGroups - Current active groups state before switch
 * @returns {Promise<Object>} The new active profile
 */
export async function switchProfile(profileUuid, currentActiveGroups = {}, useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  await initializeProfiles(useSyncStorage);
  try {
    const data = await storage.get(['profiles', 'activeProfile']);
    const profiles = data.profiles || {};
    const oldActiveProfile = data.activeProfile;
    
    if (!profiles[profileUuid]) {
      console.error(`Profile ${profileUuid} not found`);
      return null;
    }
    
    // Save active groups state for the old profile before switching
    if (oldActiveProfile && profiles[oldActiveProfile]) {
      profiles[oldActiveProfile].activeGroups = currentActiveGroups;
    }
    
    const newProfile = profiles[profileUuid];
    
    await storage.set({
      profiles,
      activeProfile: profileUuid
    });
    
    console.log(`Switched to profile: ${newProfile.name}`);
    return newProfile;
  } catch (error) {
    console.error('Error switching profile:', error);
    return null;
  }
}

/**
 * Adds a group to a profile's groupUuids list.
 * DEPRECATED: Groups are now stored per-profile, so this is only needed for backwards compatibility
 * with code that still uses the groupUuids array.
 * @param {string} groupUuid - UUID of the group
 * @param {string} profileUuid - UUID of the profile
 */
export async function addGroupToProfile(groupUuid, profileUuid, useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  await initializeProfiles(useSyncStorage);
  try {
    const data = await storage.get(['profiles']);
    const profiles = data.profiles || {};
    
    if (profiles[profileUuid]) {
      // Initialize groupUuids if it doesn't exist (for backwards compatibility)
      if (!profiles[profileUuid].groupUuids) {
        profiles[profileUuid].groupUuids = [];
      }
      if (!profiles[profileUuid].groupUuids.includes(groupUuid)) {
        profiles[profileUuid].groupUuids.push(groupUuid);
        await storage.set({ profiles });
      }
    }
  } catch (error) {
    console.error('Error adding group to profile:', error);
  }
}

/**
 * Adds multiple groups to a profile's groupUuids list in a single storage operation.
 * Much faster than calling addGroupToProfile in a loop.
 * @param {Array<string>} groupUuids - Array of group UUIDs to add
 * @param {string} profileUuid - UUID of the profile
 */
export async function addGroupsToProfile(groupUuids, profileUuid, useSyncStorage = false) {
  if (!groupUuids.length) return;
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  await initializeProfiles(useSyncStorage);
  try {
    const data = await storage.get(['profiles']);
    const profiles = data.profiles || {};
    
    if (profiles[profileUuid]) {
      if (!profiles[profileUuid].groupUuids) {
        profiles[profileUuid].groupUuids = [];
      }
      const existing = new Set(profiles[profileUuid].groupUuids);
      let added = false;
      for (const uuid of groupUuids) {
        if (!existing.has(uuid)) {
          profiles[profileUuid].groupUuids.push(uuid);
          existing.add(uuid);
          added = true;
        }
      }
      if (added) {
        await storage.set({ profiles });
      }
    }
  } catch (error) {
    console.error('Error batch-adding groups to profile:', error);
  }
}

/**
 * Removes a group from a profile's groupUuids list.
 * DEPRECATED: Groups are now stored per-profile, so this mainly removes from the groupUuids array.
 * The group data is automatically deleted when savePOIs is called without it.
 * @param {string} groupUuid - UUID of the group
 * @param {string} profileUuid - UUID of the profile
 */
export async function removeGroupFromProfile(groupUuid, profileUuid, useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  await initializeProfiles(useSyncStorage);
  try {
    const data = await storage.get(['profiles']);
    const profiles = data.profiles || {};
    
    if (profiles[profileUuid]) {
      // Remove from groupUuids array (for backwards compatibility)
      if (profiles[profileUuid].groupUuids) {
        profiles[profileUuid].groupUuids = profiles[profileUuid].groupUuids.filter(u => u !== groupUuid);
      }
      
      // Remove from profile's groupStyles if present
      if (profiles[profileUuid].groupStyles && groupUuid in profiles[profileUuid].groupStyles) {
        delete profiles[profileUuid].groupStyles[groupUuid];
      }
      
      await storage.set({ profiles });
    }
  } catch (error) {
    console.error('Error removing group from profile:', error);
  }
}

/**
 * Deletes a profile
 * Cannot delete the profile if it's the active one
 * @param {string} profileUuid - UUID of the profile to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
export async function deleteProfile(profileUuid, useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  await initializeProfiles(useSyncStorage);
  try {
    const data = await storage.get(['profiles', 'activeProfile']);
    const profiles = data.profiles || {};
    
    if (data.activeProfile === profileUuid) {
      console.error('Cannot delete the active profile');
      return false;
    }
    
    if (profiles[profileUuid]) {
      delete profiles[profileUuid];
      await storage.set({ profiles });
      console.log(`Deleted profile: ${profileUuid}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting profile:', error);
    return false;
  }
}

/**
 * Renames a profile
 * @param {string} profileUuid - UUID of the profile
 * @param {string} newName - New name for the profile
 */
export async function renameProfile(profileUuid, newName, useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  await initializeProfiles(useSyncStorage);
  try {
    const data = await storage.get(['profiles']);
    const profiles = data.profiles || {};
    
    if (profiles[profileUuid]) {
      profiles[profileUuid].name = newName;
      await storage.set({ profiles });
      console.log(`Renamed profile to: ${newName}`);
    }
  } catch (error) {
    console.error('Error renaming profile:', error);
  }
}
/**
 * Deletes all groups from a profile
 * @param {string} profileUuid - Profile UUID
 * @param {boolean} useSyncStorage - Whether to use chrome.storage.sync
 * @returns {Promise<number>} Number of groups deleted
 */
export async function deleteAllGroupsFromProfile(profileUuid, useSyncStorage = false) {
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['profiles']);
    const profiles = data.profiles || {};
    const profile = profiles[profileUuid];

    if (!profile) {
      console.error('[DELETE] Profile not found:', profileUuid);
      return [];
    }

    const groupUuids = Object.keys(profile.groups || {});
    console.log(`[DELETE] Starting deletion of ${groupUuids.length} groups from profile: ${profile.name}`);
    
    const deletedGroups = [];
    
    // Delete all groups in memory
    for (const uuid of groupUuids) {
      const groupName = profile.groups[uuid]?.name || 'Unknown';
      console.log(`[DELETE] Deleting group: ${groupName} (${uuid})`);
      
      // Remove this group
      delete profile.groups[uuid];
      delete profile.groupStyles[uuid];
      delete profile.activeGroups[uuid];
      
      deletedGroups.push({
        groupUuid: uuid,
        groupName
      });
    }
    
    // Single batch write: save all deletions at once
    // Update groupUuids to reflect remaining groups
    profile.groupUuids = Object.keys(profile.groups || {});
    profiles[profileUuid] = profile;
    await storage.set({ profiles });
    
    console.log(`[DELETE] Completed deletion of ${deletedGroups.length} groups from profile: ${profile.name}`);
    return deletedGroups;
  } catch (error) {
    console.error('[DELETE] Error deleting all groups:', error);
    return [];
  }
}

// ============================================
// REMOTE URL SYNC
// ============================================

/**
 * Fast non-cryptographic djb2 hash for content change detection.
 * @param {string} text
 * @returns {string}
 */
function computeSimpleHash(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Updates a group's POIs and/or sync metadata in storage (single read+write).
 * Called by the background service worker after a successful or failed sync.
 *
 * @param {string} profileUuid
 * @param {string} groupUuid
 * @param {Array|null} newPois - New POIs array. Pass null to leave pois untouched.
 * @param {object} syncMeta  - Fields to merge onto the group: lastSynced, lastSyncStatus,
 *                             lastSyncError, contentHash
 */
export async function updateGroupPOIs(profileUuid, groupUuid, newPois, syncMeta = {}) {
  const storage = chrome.storage.local;
  const data = await storage.get(['profiles']);
  const profiles = data.profiles || {};
  const profile = profiles[profileUuid];

  if (!profile || !profile.groups?.[groupUuid]) {
    throw new Error(`Group ${groupUuid} not found in profile ${profileUuid}`);
  }

  const group = profile.groups[groupUuid];
  if (newPois !== null) {
    group.pois = newPois;
  }
  Object.assign(group, syncMeta);

  profiles[profileUuid] = profile;
  await storage.set({ profiles });
}

/**
 * Fetches a remote CSV/JSON URL, parses it, and imports it.
 * For export format, updates existing groups from this URL and creates new ones as needed (no duplicates).
 * For raw POI data, creates a single new group.
 *
 * @param {string} url        - The remote URL to fetch
 * @param {string} groupName  - Display name for the new group (used only if not export format)
 * @returns {Promise<{imported: number, urls: string[]}>}  count of imported/updated groups
 */
export async function saveGroupFromUrl(url, groupName) {
  // Fetch
  let text;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    text = await response.text();
  } catch (err) {
    throw new Error(`Failed to fetch URL: ${err.message}`);
  }

  const contentHash = computeSimpleHash(text);

  // Try to parse as JSON first to detect export format
  let jsonData;
  let isExportFormat = false;
  try {
    jsonData = JSON.parse(text);
    // Check if it's our export format (array with name, icon, colors, data)
    if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].data && jsonData[0].name) {
      isExportFormat = true;
    }
  } catch (e) {
    jsonData = null;
  }

  if (isExportFormat) {
    // Handle export format: intelligently merge/update groups to avoid duplicates
    const now = Date.now();
    const storageData = await chrome.storage.local.get(['profiles', 'activeProfile']);
    const profiles = storageData.profiles || {};
    const activeProfileUuid = storageData.activeProfile;
    const activeProfile = profiles[activeProfileUuid];

    if (!activeProfile?.groups) {
      throw new Error('No active profile found');
    }

    // Build map of groups from this URL by name for deduplication
    const existingFromUrl = {};
    for (const [uuid, group] of Object.entries(activeProfile.groups)) {
      if (group.sourceUrl === url) {
        existingFromUrl[group.name] = uuid;
      }
    }

    let processedCount = 0;

    // Process each group in the export file
    for (const fileGroup of jsonData) {
      if (!fileGroup.name || !fileGroup.data) continue;

      try {
        const pois = parseCSV(fileGroup.data);
        if (pois.length === 0) continue;

        const groupName = fileGroup.name;

        // Check if a group from this URL with this name already exists
        if (existingFromUrl[groupName]) {
          // Update existing group's POIs and metadata
          const existingUuid = existingFromUrl[groupName];
          activeProfile.groups[existingUuid].pois = pois;
          activeProfile.groups[existingUuid].lastSynced = now;
          activeProfile.groups[existingUuid].lastSyncStatus = 'success';
          activeProfile.groups[existingUuid].lastSyncError = null;
          activeProfile.groups[existingUuid].contentHash = contentHash;
          // Preserve other fields like syncEnabled
          processedCount++;
        } else {
          // Create new group
          const newUuid = generateUUID();
          activeProfile.groups[newUuid] = {
            uuid: newUuid,
            name: groupName,
            pois: pois,
            sourceUrl: url,
            syncEnabled: false,
            lastSynced: now,
            lastSyncStatus: 'success',
            lastSyncError: null,
            contentHash: contentHash
          };

          // Add styles
          if (!activeProfile.groupStyles) activeProfile.groupStyles = {};
          activeProfile.groupStyles[newUuid] = {
            color: fileGroup.colors?.primary || '#d1ff00',
            secondaryColor: fileGroup.colors?.secondary || '#ffffff',
            logoData: fileGroup.icon && fileGroup.icon.length < 50000 ? fileGroup.icon : null
          };

          // Track in UUIDs list
          if (!activeProfile.groupUuids) activeProfile.groupUuids = [];
          if (!activeProfile.groupUuids.includes(newUuid)) {
            activeProfile.groupUuids.push(newUuid);
          }

          existingFromUrl[groupName] = newUuid;
          processedCount++;
        }
      } catch (groupError) {
        console.error(`Failed to process group "${fileGroup.name}":`, groupError);
      }
    }

    // Single storage write for all changes
    if (processedCount > 0) {
      profiles[activeProfileUuid] = activeProfile;
      await chrome.storage.local.set({ profiles });
    }

    return { imported: processedCount, urls: [url] };
  } else {
    // Handle raw POI data (CSV or JSON)
    let pois;
    try {
      const trimmed = text.trimStart();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        pois = parseJSON(text);
      } else {
        pois = parseCSV(text);
      }
    } catch (parseErr) {
      throw new Error(`Failed to parse response: ${parseErr.message}`);
    }

    if (!pois || pois.length === 0) {
      throw new Error('No POIs found in the response');
    }

    // Save as a new group (single read+write via savePOIsBatch)
    const createdUuids = await savePOIsBatch([{ pois, groupName }]);
    const uuid = createdUuids[0];
    if (!uuid) throw new Error('Failed to create group');

    // Patch the group to add URL metadata (single read+write)
    const now = Date.now();
    const storageData = await chrome.storage.local.get(['profiles', 'activeProfile']);
    const profiles = storageData.profiles || {};
    const activeProfileUuid = storageData.activeProfile;
    const activeProfile = profiles[activeProfileUuid];

    if (activeProfile?.groups?.[uuid]) {
      activeProfile.groups[uuid].sourceUrl = url;
      activeProfile.groups[uuid].syncEnabled = false;
      activeProfile.groups[uuid].lastSynced = now;
      activeProfile.groups[uuid].lastSyncStatus = 'success';
      activeProfile.groups[uuid].lastSyncError = null;
      activeProfile.groups[uuid].contentHash = contentHash;
      profiles[activeProfileUuid] = activeProfile;
      await chrome.storage.local.set({ profiles });
    }

    return { imported: 1, urls: [url] };
  }
}
