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
