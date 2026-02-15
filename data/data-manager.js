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
    const data = await storage.get(['poiGroups', 'preferences']);
    const poiGroups = data.poiGroups || {};
    const preferences = data.preferences || {};
    
    const groupUuid = uuid || generateUUID();
    const isNewGroup = !poiGroups[groupUuid];
    
    if (isNewGroup) {
      poiGroups[groupUuid] = {
        name: groupName,
        pois: []
      };
      
      // Assign random color to new group
      if (!preferences.groupStyles) preferences.groupStyles = {};
      preferences.groupStyles[groupUuid] = {
        color: generateRandomColor(),
        secondaryColor: '#ffffff',
        logoData: null
      };
    }
    
    // Simple append logic
    poiGroups[groupUuid].pois = poiGroups[groupUuid].pois.concat(pois);
    poiGroups[groupUuid].name = groupName; // Update name in case it changed
    
    await storage.set({ poiGroups, preferences });
    console.log(`Saved ${pois.length} POIs to group: ${groupName} (${groupUuid})`);
    return groupUuid;
  } catch (error) {
    console.error('Error saving POIs:', error);
    return null;
  }
}

/**
 * Loads all POI groups.
 * @returns {Promise<Object>} Object with UUIDs as keys, {name, pois} as values
 */
export async function loadPOIGroups(useSyncStorage = false) {
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups']);
    return data.poiGroups || {};
  } catch (error) {
    console.error('Error loading POIs:', error);
    return {};
  }
}

/**
 * Renames a group.
 * @param {string} uuid - UUID of the group
 * @param {string} newName - New name for the group
 */
export async function renamePOIGroup(uuid, newName, useSyncStorage = false) {
  if (!uuid || !newName) return;
  
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups']);
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
 * Deletes a group.
 * @param {string} uuid - UUID of the group to delete
 */
export async function deletePOIGroup(uuid, useSyncStorage = false) {
  if (!uuid) return;
  
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups']);
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
 * Exports all groups with their data, icons, and color preferences.
 * Returns an array of group objects ready to be saved as JSON.
 */
export async function exportGroupsData(useSyncStorage = false) {
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups', 'preferences']);
    const poiGroups = data.poiGroups || {};
    const preferences = data.preferences || {};
    const groupStyles = preferences.groupStyles || {};
    
    const exportData = [];
    
    for (const [uuid, groupData] of Object.entries(poiGroups)) {
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
 * Imports groups from exported format.
 * Handles the special export format with uuid, icon, colors, and CSV data.
 */
export async function importGroupsData(exportedGroups, useSyncStorage = false) {
  await migrateToUUIDs(useSyncStorage);
  
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups', 'preferences']);
    const poiGroups = data.poiGroups || {};
    const preferences = data.preferences || {};
    if (!preferences.groupStyles) preferences.groupStyles = {};
    
    let importedCount = 0;
    
    for (const group of exportedGroups) {
      if (!group.name || !group.data) continue;
      
      // Parse the CSV data
      const pois = parseCSV(group.data);
      if (pois.length > 0) {
        // Use provided UUID or generate new one
        const uuid = group.uuid || generateUUID();
        
        // If UUID already exists, generate a new one to avoid collision
        const finalUuid = poiGroups[uuid] ? generateUUID() : uuid;
        
        poiGroups[finalUuid] = {
          name: group.name,
          pois: pois
        };
        
        // Import group styles
        preferences.groupStyles[finalUuid] = {
          color: group.colors?.primary || '#d1ff00',
          secondaryColor: group.colors?.secondary || '#ffffff',
          logoData: group.icon || null
        };
        
        importedCount++;
      }
    }
    
    await storage.set({ poiGroups, preferences });
    console.log(`Imported ${importedCount} groups with styles`);
    return importedCount;
  } catch (error) {
    console.error('Error importing groups:', error);
    return 0;
  }
}
