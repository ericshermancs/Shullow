/**
 * POI Popup: Marketplace / Dataset Library Module
 * Handles loading, caching, filtering, and click-to-install for curated community datasets.
 */

import { saveGroupFromUrl } from '../../data/data-manager.js';
import { StorageManager } from './storage.js';

export const DEFAULT_INDEX_URL = 'https://raw.githubusercontent.com/ericshermancs/Shullow-Datasets/master/index.json';
export const CACHE_KEY = 'marketplaceCache';
export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches the marketplace index.
 * Uses storage cache if fresh, otherwise fetches remote index with fallback to bundled index.
 *
 * @param {boolean} forceRefresh - If true, bypasses TTL and fetches remote
 * @returns {Promise<{datasets: Array, lastUpdated: string, version: string}>}
 */
export async function fetchMarketplaceIndex(forceRefresh = false) {
  const storage = await chrome.storage.local.get([CACHE_KEY, 'preferences']);
  const cached = storage[CACHE_KEY];
  const preferences = storage.preferences || {};
  const targetUrl = preferences.marketplaceUrl || DEFAULT_INDEX_URL;

  // 1. Check valid cache if not forcing refresh
  if (!forceRefresh && cached?.data?.datasets?.length > 0) {
    const age = Date.now() - (cached.lastFetched || 0);
    if (age < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 2. Attempt remote fetch
  try {
    const resp = await fetch(targetUrl, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data && Array.isArray(data.datasets)) {
      await chrome.storage.local.set({
        [CACHE_KEY]: { data, lastFetched: Date.now() }
      });
      return data;
    }
    throw new Error('Invalid index structure');
  } catch (err) {
    console.warn(`[Marketplace] Remote fetch failed (${err.message}). Using fallback.`);
    
    // 3. Fallback to cached data even if stale
    if (cached?.data?.datasets?.length > 0) {
      return cached.data;
    }

    // 4. Fallback to bundled local index
    try {
      const bundledUrl = chrome.runtime.getURL('data/marketplace-index.json');
      const localResp = await fetch(bundledUrl);
      const localData = await localResp.json();
      await chrome.storage.local.set({
        [CACHE_KEY]: { data: localData, lastFetched: Date.now() }
      });
      return localData;
    } catch (bundleErr) {
      console.error('[Marketplace] Failed to load bundled index:', bundleErr);
      return { datasets: [], lastUpdated: new Date().toISOString() };
    }
  }
}

/**
 * Checks whether a given marketplace dataset is already installed in the active profile.
 *
 * @param {object} dataset - Marketplace dataset item
 * @param {object} activeProfile - Currently active profile object
 * @returns {boolean}
 */
export function isDatasetInstalled(dataset, activeProfile) {
  if (!activeProfile?.groups) return false;
  for (const group of Object.values(activeProfile.groups)) {
    if (group.sourceUrl && group.sourceUrl === dataset.url) {
      return true;
    }
    if (group.name && group.name.toLowerCase() === dataset.name.toLowerCase() && group.sourceUrl) {
      return true;
    }
  }
  return false;
}

/**
 * Finds the UUID of an installed dataset group in the active profile if present.
 *
 * @param {object} dataset
 * @param {object} activeProfile
 * @returns {string|null}
 */
export function getInstalledGroupUuid(dataset, activeProfile) {
  if (!activeProfile?.groups) return null;
  for (const [uuid, group] of Object.entries(activeProfile.groups)) {
    if (group.sourceUrl && group.sourceUrl === dataset.url) {
      return uuid;
    }
    if (group.name && group.name.toLowerCase() === dataset.name.toLowerCase() && group.sourceUrl) {
      return uuid;
    }
  }
  return null;
}

/**
 * Installs a dataset into the active profile.
 * Fetches the data, creates or updates the group, assigns custom colors, enables it, and notifies content script.
 *
 * @param {object} dataset - Marketplace dataset object
 * @param {object} profileManager - Active profile manager instance
 * @param {object} preferences - Mutable preferences object
 * @param {object} activeGroups - Mutable activeGroups map
 * @returns {Promise<{success: boolean, imported: number}>}
 */
export async function installDataset(dataset, profileManager, preferences, activeGroups) {
  const urlToFetch = dataset.url;

  // Ingest using core data manager
  const { imported } = await saveGroupFromUrl(urlToFetch, dataset.name);

  // Update storage & active profile
  const allProfiles = await chrome.storage.local.get(['profiles', 'activeProfile']);
  const freshActiveProfile = (allProfiles.profiles || {})[allProfiles.activeProfile];

  if (freshActiveProfile) {
    if (freshActiveProfile.groups) {
      for (const [uuid, group] of Object.entries(freshActiveProfile.groups)) {
        if (group.sourceUrl === urlToFetch || group.name === dataset.name) {
          group.sourceUrl = dataset.url;
          activeGroups[uuid] = true;

          // Apply custom colors and preserve logoData from freshActiveProfile.groupStyles
          if (!freshActiveProfile.groupStyles) freshActiveProfile.groupStyles = {};
          const currentStyle = freshActiveProfile.groupStyles[uuid] || {};

          freshActiveProfile.groupStyles[uuid] = {
            color: dataset.colors?.primary || currentStyle.color || '#4a9eff',
            secondaryColor: dataset.colors?.secondary || currentStyle.secondaryColor || '#ffffff',
            logoData: currentStyle.logoData || null
          };
          if (!preferences.groupStyles) preferences.groupStyles = {};
          preferences.groupStyles[uuid] = freshActiveProfile.groupStyles[uuid];
        }
      }
    }

    freshActiveProfile.activeGroups = { ...activeGroups };
    allProfiles.profiles[allProfiles.activeProfile] = freshActiveProfile;
    await chrome.storage.local.set({ profiles: allProfiles.profiles });
  }

  await profileManager.reload();
  await StorageManager.saveState(preferences, activeGroups);
  StorageManager.notifyContentScript(activeGroups, preferences);

  return { success: true, imported };
}
