// Data management module for Map POI Injector
// Simplified version (~9:22 PM ET)

import { parseCSV } from './csv-parser.js';
import { parseJSON } from './json-parser.js'; 

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
 */
export async function savePOIs(pois, groupName, useSyncStorage = false) {
  if (!groupName) return;
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups']);
    const poiGroups = data.poiGroups || {};
    
    if (!poiGroups[groupName]) {
      poiGroups[groupName] = [];
    }
    
    // Simple append logic
    poiGroups[groupName] = poiGroups[groupName].concat(pois);
    
    await storage.set({ poiGroups });
    console.log(`Saved ${pois.length} POIs to group: ${groupName}`);
  } catch (error) {
    console.error('Error saving POIs:', error);
  }
}

/**
 * Loads all POI groups.
 */
export async function loadPOIGroups(useSyncStorage = false) {
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
 */
export async function renamePOIGroup(oldName, newName, useSyncStorage = false) {
  if (!oldName || !newName) return;
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups']);
    const poiGroups = data.poiGroups || {};
    if (poiGroups[oldName]) {
      poiGroups[newName] = poiGroups[oldName];
      delete poiGroups[oldName];
      await storage.set({ poiGroups });
    }
  } catch (error) {
    console.error('Error renaming group:', error);
  }
}

/**
 * Deletes a group.
 */
export async function deletePOIGroup(groupName, useSyncStorage = false) {
  if (!groupName) return;
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups']);
    const poiGroups = data.poiGroups || {};
    if (poiGroups[groupName]) {
      delete poiGroups[groupName];
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
  const storage = useSyncStorage ? chrome.storage.sync : chrome.storage.local;
  try {
    const data = await storage.get(['poiGroups', 'preferences']);
    const poiGroups = data.poiGroups || {};
    const preferences = data.preferences || {};
    const groupStyles = preferences.groupStyles || {};
    
    const exportData = [];
    
    for (const [groupName, pois] of Object.entries(poiGroups)) {
      const style = groupStyles[groupName] || {};
      
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
          name: groupName,
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
 * Handles the special export format with icon, colors, and CSV data.
 */
export async function importGroupsData(exportedGroups, useSyncStorage = false) {
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
        poiGroups[group.name] = pois;
        
        // Import group styles
        preferences.groupStyles[group.name] = {
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
