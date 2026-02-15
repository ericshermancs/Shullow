/**
 * Profile Manager Module
 * Centralizes all profile-related logic and state management
 */

import { 
  getProfiles as getProfilesFromStorage,
  getActiveProfile as getActiveProfileFromStorage,
  createProfile as createProfileInStorage,
  switchProfile as switchProfileInStorage,
  deleteProfile as deleteProfileFromStorage,
  addGroupToProfile as addGroupToProfileInStorage,
  removeGroupFromProfile as removeGroupFromProfileInStorage
} from '../../data/data-manager.js';

class ProfileManager {
  constructor() {
    this.activeProfileUuid = null;
    this.profiles = {};
  }

  /**
   * Initialize profile manager - loads cached state
   */
  async init() {
    await this.reload();
  }

  /**
   * Reload profiles from storage and update cache
   */
  async reload() {
    this.profiles = await getProfilesFromStorage();
    const activeProfile = await getActiveProfileFromStorage();
    this.activeProfileUuid = activeProfile?.uuid || null;
  }

  /**
   * Get the active profile UUID
   */
  getActiveUuid() {
    return this.activeProfileUuid;
  }

  /**
   * Get the active profile object
   */
  getActive() {
    return this.profiles[this.activeProfileUuid] || null;
  }

  /**
   * Get all profiles
   */
  getAll() {
    return this.profiles;
  }

  /**
   * Get a specific profile by UUID
   */
  getById(uuid) {
    return this.profiles[uuid] || null;
  }

  /**
   * Create a new profile
   * @param {string} name - Profile name
   * @returns {Promise<string>} UUID of created profile
   */
  async create(name) {
    const uuid = await createProfileInStorage(name);
    if (uuid) {
      await this.reload();
    }
    return uuid;
  }

  /**
   * Switch to a different profile
   * @param {string} newProfileUuid - UUID of profile to switch to
   * @param {Object} currentActiveGroups - Current activeGroups state to save
   * @returns {Promise<Object>} The new active profile
   */
  async switch(newProfileUuid, currentActiveGroups = {}) {
    const result = await switchProfileInStorage(newProfileUuid, currentActiveGroups);
    if (result) {
      await this.reload();
    }
    return result;
  }

  /**
   * Delete a profile
   * @param {string} profileUuid - UUID of profile to delete
   * @returns {Promise<boolean>} True if deleted successfully
   */
  async delete(profileUuid) {
    const success = await deleteProfileFromStorage(profileUuid);
    if (success) {
      await this.reload();
    }
    return success;
  }

  /**
   * Add a group to a profile
   * @param {string} groupUuid - UUID of group
   * @param {string} profileUuid - UUID of profile (uses active if not provided)
   */
  async addGroup(groupUuid, profileUuid = null) {
    const targetProfile = profileUuid || this.activeProfileUuid;
    if (!targetProfile) return;
    
    await addGroupToProfileInStorage(groupUuid, targetProfile);
    await this.reload();
  }

  /**
   * Remove a group from a profile - removes from both groupUuids and groupStyles
   * @param {string} groupUuid - UUID of group
   * @param {string} profileUuid - UUID of profile (uses active if not provided)
   */
  async removeGroup(groupUuid, profileUuid = null) {
    const targetProfile = profileUuid || this.activeProfileUuid;
    if (!targetProfile) return;
    
    try {
      // Remove from profile's groupUuids array
      await removeGroupFromProfileInStorage(groupUuid, targetProfile);
      
      // Reload to get fresh data
      await this.reload();
      
      // Also ensure groupStyles is cleaned up for this profile
      const profile = this.profiles[targetProfile];
      if (profile && profile.groupStyles && groupUuid in profile.groupStyles) {
        delete profile.groupStyles[groupUuid];
        
        // Save the updated profile back to storage
        const allProfiles = await getProfilesFromStorage();
        if (allProfiles[targetProfile]) {
          allProfiles[targetProfile].groupStyles = profile.groupStyles;
          await chrome.storage.local.set({ 'profiles': allProfiles });
        }
      }
    } catch (error) {
      console.error('Error removing group from profile:', error);
    }
  }

  /**
   * Get group UUIDs for active profile
   */
  getActiveGroupUuids() {
    const active = this.getActive();
    return active?.groupUuids || [];
  }

  /**
   * Get group UUIDs for a specific profile
   */
  getGroupUuids(profileUuid) {
    const profile = this.getById(profileUuid);
    return profile?.groupUuids || [];
  }

  /**
   * Check if a group exists in the active profile
   */
  hasGroup(groupUuid) {
    return this.getActiveGroupUuids().includes(groupUuid);
  }
}

export const profileManager = new ProfileManager();
