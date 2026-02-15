import { loadPOIGroups, savePOIs, savePOIsBatch, importData, deletePOIGroup, renamePOIGroup, exportGroupsData, importGroupsData, deleteAllGroupsFromProfile } from '../data/data-manager.js';
import { ColorWheel } from './modules/color-wheel.js';
import { StorageManager } from './modules/storage.js';
import { profileManager } from './modules/profile-manager.js';

const PIN_SVG = (color, secondary) => `
<svg class="pin-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 21C16 17.5 19 14.4183 19 11C19 7.13401 15.866 4 12 4C8.13401 4 5 7.13401 5 11C5 14.4183 8 17.5 12 21Z" stroke="${secondary}" fill="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12" cy="11" r="2" stroke="${secondary}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

document.addEventListener('DOMContentLoaded', async () => {
  const overlayToggle = document.getElementById('overlay-toggle');
  const debugToggle = document.getElementById('debug-toggle');
  const nightModeToggle = document.getElementById('night-mode-toggle');
  const nightModeIcon = document.getElementById('night-mode-icon');
  const groupsContainer = document.getElementById('groups-container');
  const groupCountEl = document.getElementById('group-count');
  const statusText = document.getElementById('status-text');
  const hostnameDisplay = document.getElementById('current-hostname');
  const newGroupNameInput = document.getElementById('new-group-name');
  const csvUploadInput = document.getElementById('csv-upload');
  const exportBtn = document.getElementById('export-btn');
  const disableAllBtn = document.getElementById('disable-all-btn');
  const clearAllBtn = document.getElementById('clear-all-btn');

  let preferences = {
    overlayEnabled: true,
    debugEnabled: false,
    nightMode: false,
    sitePreferences: {},
    groupStyles: {},
    accentColor: '#4a9eff'
  };
  let activeGroups = {};
  let currentHost = '';

  // --- Helpers ---
  const updateStatus = (text) => { statusText.textContent = text; };
  const applyTheme = (color) => {
    document.documentElement.style.setProperty('--accent-color', color);
    const previews = document.querySelectorAll('.theme-color-preview');
    previews.forEach(p => p.style.background = color);
  };
  const updateDisableAllButton = () => {
    if (!disableAllBtn) return;
    const groupCount = Object.keys(activeGroups).length;
    const allDisabled = groupCount > 0 && Object.values(activeGroups).every(v => v === false);
    if (allDisabled) {
      disableAllBtn.textContent = 'ENABLE ALL';
      disableAllBtn.classList.add('enable-all-btn');
    } else {
      disableAllBtn.textContent = 'DISABLE ALL';
      disableAllBtn.classList.remove('enable-all-btn');
    }
  };
  const saveData = async () => {
    // Save both to top level (for backwards compat) and to active profile
    const activeProfile = profileManager.getActive();
    if (activeProfile) {
      activeProfile.activeGroups = { ...activeGroups };
      const allProfiles = await chrome.storage.local.get(['profiles']);
      const profiles = allProfiles.profiles || {};
      profiles[activeProfile.uuid] = activeProfile;
      await chrome.storage.local.set({ profiles });
    }
    
    await StorageManager.saveState(preferences, activeGroups);
    StorageManager.notifyContentScript(activeGroups, preferences);
  };
  const getSiteEnabled = () => {
    const sitePref = preferences.sitePreferences?.[currentHost];
    if (sitePref && typeof sitePref.siteEnabled === 'boolean') return sitePref.siteEnabled;
    if (sitePref && typeof sitePref.overlayEnabled === 'boolean') return sitePref.overlayEnabled;
    return true;
  };
  const updateSiteToggle = () => {
    overlayToggle.checked = getSiteEnabled();
  };

  // --- Modal Logic ---
  const modal = document.getElementById('customization-modal');
  const modalTitle = document.getElementById('modal-title');
  const groupFields = document.getElementById('group-customization-fields');
  const themeFields = document.getElementById('theme-customization-fields');
  const logoInput = document.getElementById('group-logo-input');
  const logoPreview = document.getElementById('logo-preview-container');
  const modalSave = document.getElementById('modal-save');
  const modalCancel = document.getElementById('modal-cancel');
  const modalClose = document.getElementById('modal-close');

  let currentEditingGroup = null;
  let currentLogoData = null;
  let tempPriColor = '';
  let tempSecColor = '';
  let tempThemeColor = '';

  const primaryWheel = new ColorWheel('primary-wheel-container', '#4a9eff', (hex) => { tempPriColor = hex; });
  const secondaryWheel = new ColorWheel('secondary-wheel-container', '#ffffff', (hex) => { tempSecColor = hex; });
  const themeWheel = new ColorWheel('theme-wheel-container', '#4a9eff', (hex) => { tempThemeColor = hex; });

  const showModal = (groupUuid, groupName) => {
    currentEditingGroup = groupUuid;
    themeFields.style.display = 'none';
    groupFields.style.display = 'block';
    
    if (groupUuid === '__theme__') {
      modalTitle.textContent = 'CUSTOMIZE THEME';
      themeFields.style.display = 'block';
      groupFields.style.display = 'none';
      tempThemeColor = preferences.accentColor;
      themeWheel.setColor(tempThemeColor);
    } else {
      modalTitle.textContent = `CUSTOMIZE: ${groupName.toUpperCase()}`;
      // Get style from active profile's groupStyles, fallback to global preferences
      const activeProfile = profileManager.getActive();
      const profileGroupStyles = activeProfile?.groupStyles || {};
      const style = profileGroupStyles[groupUuid] || preferences.groupStyles[groupUuid] || { color: '#4a9eff', secondaryColor: '#ffffff', logoData: null };
      tempPriColor = style.color || '#4a9eff';
      tempSecColor = style.secondaryColor || '#ffffff';
      currentLogoData = style.logoData;
      primaryWheel.setColor(tempPriColor);
      secondaryWheel.setColor(tempSecColor);
      updateLogoPreview(currentLogoData);
    }
    modal.style.display = 'flex';
  };

  const hideModal = () => {
    modal.style.display = 'none';
    currentEditingGroup = null;
    currentLogoData = null;
    logoInput.value = '';
  };

  // --- Profile Modal Logic ---
  const profileModal = document.getElementById('profile-modal');
  const profileMenuBtn = document.getElementById('profile-menu-btn');
  const profileModalClose = document.getElementById('profile-modal-close');
  const profilesList = document.getElementById('profiles-list');
  const newProfileNameInput = document.getElementById('new-profile-name');
  const createProfileBtn = document.getElementById('create-profile-btn');

  const showProfileModal = async () => {
    await renderProfiles();
    profileModal.style.display = 'flex';
  };

  const hideProfileModal = () => {
    profileModal.style.display = 'none';
  };

  const renderProfiles = async () => {
    try {
      const allProfiles = profileManager.getAll();
      const activeUuid = profileManager.getActiveUuid();
      
      // Also read fresh storage data to get actual group counts
      const storageData = await chrome.storage.local.get(['profiles']);
      const storageProfiles = storageData.profiles || {};

      profilesList.innerHTML = '';

      const sortedProfiles = Object.values(allProfiles)
        .sort((a, b) => a.name.localeCompare(b.name));

      sortedProfiles.forEach(profile => {
        const isActive = profile.uuid === activeUuid;
        // Get actual group count from storage, not from cached groupUuids
        const storageProfile = storageProfiles[profile.uuid];
        const groupCount = Object.keys(storageProfile?.groups || {}).length;
        const item = document.createElement('div');
        item.className = `profile-item ${isActive ? 'active' : ''}`;
        item.innerHTML = `
          <span class="profile-item-name" data-uuid="${profile.uuid}">${profile.name}</span>
          <button class="profile-edit-btn" data-uuid="${profile.uuid}" title="Rename profile">✎</button>
          <span class="profile-item-count">${groupCount} group${groupCount !== 1 ? 's' : ''}</span>
          ${!isActive ? `<button class="profile-delete-btn" data-uuid="${profile.uuid}" title="Delete profile">&times;</button>` : ''}
        `;

        // Click to switch profile
        item.onclick = async (e) => {
          if (e.target.closest('.profile-edit-btn')) {
            // Handle rename
            const uuid = e.target.dataset.uuid;
            const profileToRename = allProfiles[uuid];
            const oldName = profileToRename.name;
            const nameSpan = item.querySelector('.profile-item-name');
            const input = document.createElement('input');
            input.className = 'profile-name-input';
            input.value = oldName;
            nameSpan.innerHTML = '';
            nameSpan.appendChild(input);
            input.focus();
            input.select();
            const done = async (save) => {
              const val = input.value.trim();
              if (save && val && val !== oldName) {
                profileToRename.name = val;
                const allProfiles = await chrome.storage.local.get(['profiles']);
                const profiles = allProfiles.profiles || {};
                profiles[uuid] = profileToRename;
                await chrome.storage.local.set({ profiles });
                await profileManager.reload();
                await renderProfiles();
                updateStatus(`RENAMED PROFILE: ${val.toUpperCase()}`);
              } else { nameSpan.textContent = oldName; }
            };
            input.onblur = () => done(true);
            input.onkeydown = (ev) => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); };
            return;
          }
          
          if (e.target.closest('.profile-delete-btn')) {
            // Handle delete
            const uuid = e.target.dataset.uuid;
            const profileToDelete = allProfiles[uuid];
            if (confirm(`Delete profile "${profileToDelete.name}"?`)) {
              await profileManager.delete(uuid);
              await renderProfiles();
              updateStatus(`DELETED PROFILE: ${profileToDelete.name}`);
            }
          } else if (!isActive) {
            // Handle switch
            await switchProfiles(profile.uuid);
            hideProfileModal();
          }
        };

        profilesList.appendChild(item);
      });
    } catch (e) {
      console.error('Render profiles error', e);
    }
  };

  const switchProfiles = async (newProfileUuid) => {
    try {
      const newProfile = profileManager.getById(newProfileUuid);

      if (!newProfile) {
        console.error('Profile not found');
        return;
      }

      // Save the current profile's active groups state before switching
      const oldProfile = profileManager.getActive();
      if (oldProfile) {
        oldProfile.activeGroups = { ...activeGroups };
        // Save the old profile with updated active groups
        const allProfiles = await chrome.storage.local.get(['profiles']);
        const profiles = allProfiles.profiles || {};
        profiles[oldProfile.uuid] = oldProfile;
        await chrome.storage.local.set({ profiles });
      }

      // Switch to new profile
      const result = await profileManager.switch(newProfileUuid, activeGroups);

      if (result) {
        // Restore active groups state for this profile
        // Only include groups that actually belong to this profile
        const profileGroupUuids = new Set(result.groups ? Object.keys(result.groups) : []);
        activeGroups = {};
        
        if (result.activeGroups) {
          // Restore saved state, but only for groups that exist in this profile
          for (const [uuid, isActive] of Object.entries(result.activeGroups)) {
            if (profileGroupUuids.has(uuid)) {
              activeGroups[uuid] = isActive;
            }
          }
        }
        
        // For any groups in the profile that don't have a saved state, default to active
        for (const groupUuid of profileGroupUuids) {
          if (!(groupUuid in activeGroups)) {
            activeGroups[groupUuid] = true;
          }
        }

        // Restore group styles for this profile
        if (result.groupStyles) {
          preferences.groupStyles = { ...result.groupStyles };
        }

        await saveData();

        // Trigger redraw on all tabs - await to ensure they get the message
        await new Promise((resolve) => {
          chrome.tabs.query({}, (tabs) => {
            const promises = [];
            tabs.forEach(tab => {
              if (tab.url) {
                promises.push(
                  new Promise((res) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'reload-overlay' }, () => res());
                  })
                );
              }
            });
            Promise.all(promises).then(resolve);
          });
        });

        await renderGroups();
        updateStatus(`SWITCHED TO: ${result.name.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Error switching profiles:', error);
      updateStatus('PROFILE SWITCH FAILED');
    }
  };

  profileMenuBtn.onclick = showProfileModal;
  profileModalClose.onclick = hideProfileModal;

  createProfileBtn.onclick = async () => {
    const name = newProfileNameInput.value.trim();
    if (!name) {
      updateStatus('ENTER PROFILE NAME');
      return;
    }

    try {
      const newProfileUuid = await profileManager.create(name);
      if (newProfileUuid) {
        newProfileNameInput.value = '';
        await renderProfiles();
        updateStatus(`CREATED: ${name.toUpperCase()}`);
      }
    } catch (error) {
      console.error('Error creating profile:', error);
      updateStatus('PROFILE CREATION FAILED');
    }
  };

  // Close profile modal when clicking outside
  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) {
      hideProfileModal();
    }
  });

  const updateLogoPreview = (data) => {
    if (data) {
      logoPreview.innerHTML = `<img src="${data}" alt="Logo"><button class="logo-delete-btn" title="Remove logo">&times;</button>`;
      logoPreview.querySelector('.logo-delete-btn').onclick = (e) => {
        e.stopPropagation();
        currentLogoData = null;
        logoInput.value = '';
        updateLogoPreview(null);
      };
    } else {
      logoPreview.innerHTML = '<span style="font-size: 0.5rem; color: #444;">NO LOGO</span>';
    }
  };

  const handleImageUpload = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 128;
          let w = img.width, h = img.height;
          if (w > h) { if (w > maxSize) { h *= maxSize / w; w = maxSize; } }
          else { if (h > maxSize) { w *= maxSize / h; h = maxSize; } }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const saveConfig = async () => {
    if (currentEditingGroup === '__theme__') {
      preferences.accentColor = tempThemeColor;
      applyTheme(tempThemeColor);
      await saveData();
    } else if (currentEditingGroup) {
      // Save group styles to the active profile, not globally
      const activeProfile = profileManager.getActive();
      if (activeProfile) {
        if (!activeProfile.groupStyles) activeProfile.groupStyles = {};
        activeProfile.groupStyles[currentEditingGroup] = { 
          color: tempPriColor, 
          secondaryColor: tempSecColor, 
          logoData: currentLogoData 
        };
        
        // Also keep in preferences for backward compatibility
        if (!preferences.groupStyles) preferences.groupStyles = {};
        preferences.groupStyles[currentEditingGroup] = { 
          color: tempPriColor, 
          secondaryColor: tempSecColor, 
          logoData: currentLogoData 
        };
        
        // Save the profile with updated groupStyles
        const allProfiles = await chrome.storage.local.get(['profiles']);
        const profiles = allProfiles.profiles || {};
        profiles[activeProfile.uuid] = activeProfile;
        await chrome.storage.local.set({ profiles });
      }
      
      await saveData();
      console.log(`[POPUP] saveConfig: group=${currentEditingGroup}, newColor=${tempPriColor}`);
      StorageManager.notifyContentScript(activeGroups, preferences, currentEditingGroup);
    } else {
      await saveData();
    }
    await renderGroups();
    hideModal();
    updateStatus('CONFIG SAVED');
  };

  // --- Rendering ---
  const renderGroups = async () => {
    try {
      const groups = await loadPOIGroups();
      
      // Get only groups that belong to the current profile
      // This ensures groups are not shared across profiles
      const profileGroupUuids = profileManager.getActiveGroupUuids();
      const profileGroups = profileGroupUuids.filter(uuid => groups[uuid]);
      
      // Get the current profile's groupStyles
      const activeProfile = profileManager.getActive();
      const profileGroupStyles = activeProfile?.groupStyles || {};
      
      groupCountEl.textContent = profileGroups.length;
      if (profileGroups.length === 0) { groupsContainer.innerHTML = '<div class="empty-state">NO GROUPS FOUND</div>'; return; }
      groupsContainer.innerHTML = '';
      
      // Sort by group name
      const sortedEntries = profileGroups.map(uuid => ({ uuid, group: groups[uuid] }))
        .sort((a, b) => a.group.name.localeCompare(b.group.name));
      
      sortedEntries.forEach(({ uuid, group }) => {
        const style = profileGroupStyles[uuid] || preferences.groupStyles[uuid] || { color: '#4a9eff', secondaryColor: '#ffffff' };
        const isActive = activeGroups[uuid] !== false;
        const icon = style.logoData ? `<img src="${style.logoData}" class="pin-icon">` : PIN_SVG(style.color, style.secondaryColor || '#ffffff');
        const item = document.createElement('div');
        item.className = 'group-item';
        item.innerHTML = `
          <div class="pin-preview" data-uuid="${uuid}" data-name="${group.name}">${icon}</div>
          <span class="group-name" data-uuid="${uuid}">${group.name}</span>
          <div class="group-actions">
            <button class="delete-btn" data-uuid="${uuid}" data-name="${group.name}">&times;</button>
            <label class="switch">
              <input type="checkbox" class="group-toggle" data-uuid="${uuid}" ${isActive ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
          </div>
        `;
        groupsContainer.appendChild(item);
      });
      updateDisableAllButton();
    } catch (e) { console.error('Render error', e); }
  };

  // --- Initialize ---
  // Initialize ProfileManager (handles profile initialization and migration)
  await profileManager.init();

  const state = await StorageManager.loadState();
  if (state.preferences) preferences = { ...preferences, ...state.preferences };
  if (state.activeGroups) activeGroups = state.activeGroups;
  
  // Load active groups state from the active profile
  const activeProfile = profileManager.getActive();
  if (activeProfile && activeProfile.activeGroups) {
    activeGroups = { ...activeProfile.activeGroups };
  } else if (activeProfile && activeProfile.groups) {
    // First time or migration: activate all groups in the profile by default
    activeGroups = {};
    for (const groupUuid of Object.keys(activeProfile.groups)) {
      activeGroups[groupUuid] = true;
    }
  }
  
  // Load groupStyles from the active profile
  if (activeProfile && activeProfile.groupStyles) {
    preferences.groupStyles = { ...activeProfile.groupStyles };
  }
  
  // Migrate old yellow theme to new blue theme
  if (preferences.accentColor === '#d1ff00') {
    preferences.accentColor = '#4a9eff';
  }
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.url) {
      try {
        currentHost = new URL(tabs[0].url).hostname;
        hostnameDisplay.textContent = currentHost;
        updateSiteToggle();
      } catch(e) { hostnameDisplay.textContent = 'unknown site'; }
    }
  });

  applyTheme(preferences.accentColor);
    // Apply night mode if enabled
    if (preferences.nightMode) {
      document.body.classList.add('night-mode');
      nightModeIcon.textContent = '☀️';
    } else {
      document.body.classList.remove('night-mode');
      nightModeIcon.textContent = '🌙';
    }
  await renderGroups();
  updateStatus('SYSTEM READY');

  // --- Listeners ---
  nightModeToggle.addEventListener('click', async () => {
    preferences.nightMode = !preferences.nightMode;
    
    // Prevent double-clicking during animation
    nightModeToggle.disabled = true;
    
    const overlay = document.getElementById('theme-transition-overlay');
    
    // Fade in overlay (100ms)
    overlay.style.display = 'block';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    overlay.style.transition = 'background-color 0.1s cubic-bezier(0.4, 0, 0.2, 1)';
    overlay.offsetHeight;
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
    await new Promise(resolve => setTimeout(resolve, 80));
    // Swap theme at 80ms
    if (preferences.nightMode) {
      document.body.classList.add('night-mode');
      nightModeIcon.textContent = '☀️';
    } else {
      document.body.classList.remove('night-mode');
      nightModeIcon.textContent = '🌙';
    }
    // Fade out overlay (100ms)
    overlay.style.transition = 'background-color 0.1s cubic-bezier(0.4, 0, 0.2, 1)';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    await new Promise(resolve => setTimeout(resolve, 80));
    overlay.style.display = 'none';
    nightModeToggle.disabled = false;
    saveData();
  });

  overlayToggle.addEventListener('change', (e) => {
    if (!preferences.sitePreferences) preferences.sitePreferences = {};
    const enabled = e.target.checked;
    const existing = preferences.sitePreferences[currentHost] || {};
    preferences.sitePreferences[currentHost] = { ...existing, siteEnabled: enabled, overlayEnabled: enabled };
    saveData();
    
    // Also notify tabs with full state including activeGroups
    StorageManager.notifyTabsForHost(currentHost, {
      action: 'toggle-site-enabled',
      enabled,
      host: currentHost,
      activeGroups,
      preferences
    });
    updateStatus(enabled ? 'SITE ON' : 'SITE OFF');
  });

  debugToggle.addEventListener('change', (e) => {
    preferences.debugEnabled = e.target.checked;
    saveData();
  });

  groupsContainer.addEventListener('click', async (e) => {
    const preview = e.target.closest('.pin-preview');
    if (preview) return showModal(preview.dataset.uuid, preview.dataset.name);

    const nameSpan = e.target.closest('.group-name');
    if (nameSpan && !nameSpan.querySelector('input')) {
      const uuid = nameSpan.dataset.uuid;
      const groups = await loadPOIGroups();
      const oldName = groups[uuid]?.name || '';
      const input = document.createElement('input');
      input.className = 'group-name-input';
      input.value = oldName;
      nameSpan.innerHTML = '';
      nameSpan.appendChild(input);
      input.focus();
      input.select();
      const done = async (save) => {
        const val = input.value.trim();
        if (save && val && val !== oldName) {
          await renamePOIGroup(uuid, val);
          await saveData();
          await renderGroups();
        } else { nameSpan.textContent = oldName; }
      };
      input.onblur = () => done(true);
      input.onkeydown = (ev) => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); };
      return;
    }

    const del = e.target.closest('.delete-btn');
    if (del && confirm(`Delete "${del.dataset.name}"?`)) {
      const uuid = del.dataset.uuid;
      await deletePOIGroup(uuid);
      delete activeGroups[uuid];
      // Remove from current profile (handles profile-specific style cleanup)
      await profileManager.removeGroup(uuid);
      await saveData();
      await renderGroups();
    }
  });

  modalSave.onclick = saveConfig;
  modalCancel.onclick = modalClose.onclick = hideModal;
  logoInput.onchange = async (e) => {
    if (e.target.files?.[0]) {
      currentLogoData = await handleImageUpload(e.target.files[0]);
      updateLogoPreview(currentLogoData);
    }
  };

  groupsContainer.addEventListener('change', async (e) => {
    if (e.target.classList.contains('group-toggle')) {
      activeGroups[e.target.dataset.uuid] = e.target.checked;
      
      // Ensure preferences.groupStyles reflects the active profile's groupStyles
      const activeProfile = profileManager.getActive();
      if (activeProfile && activeProfile.groupStyles) {
        preferences.groupStyles = { ...activeProfile.groupStyles };
      }
      
      await saveData();
      updateDisableAllButton();
    }
  });

  csvUploadInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target.result;
        
        // Try to parse as JSON first to check if it's an export file
        let isExportFormat = false;
        try {
          const jsonData = JSON.parse(content);
          // Check if it's our export format (array with name, icon, colors, data)
          if (Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].data && jsonData[0].name) {
            isExportFormat = true;
            updateStatus('IMPORTING... (0 GROUPS)');
            
            // Ensure the current profile is set as active in storage before importing
            const importProfile = profileManager.getActive();
            if (importProfile) {
              await chrome.storage.local.set({ activeProfile: importProfile.uuid });
            }
            
            // Import in background to keep UI responsive
            (async () => {
              try {
                // Single batch: parses all groups, saves once to storage
                const imported = await importGroupsData(jsonData, false);
                
                if (imported.length > 0) {
                  // Set all imported groups as active
                  for (const { groupUuid } of imported) {
                    activeGroups[groupUuid] = true;
                  }
                  
                  // Reload profile manager cache (groupUuids were updated by importGroupsData)
                  await profileManager.reload();
                  
                  // Reload group styles from the active profile fresh from storage
                  const allProfiles = await chrome.storage.local.get(['profiles', 'activeProfile']);
                  const activeProfileUuid = allProfiles.activeProfile;
                  const profiles = allProfiles.profiles || {};
                  const freshActiveProfile = profiles[activeProfileUuid];
                  if (freshActiveProfile && freshActiveProfile.groupStyles) {
                    preferences.groupStyles = { ...freshActiveProfile.groupStyles };
                  }
                  
                  await saveData();
                  newGroupNameInput.value = '';
                  await renderGroups();
                  updateStatus(`IMPORTED ${imported.length} GROUPS`);
                }
              } catch (importError) {
                console.error('[IMPORT] Error during import:', importError);
                updateStatus('IMPORT FAILED');
              }
            })();
            
            return;
          }
        } catch (e) {
          // Not JSON or not export format, continue with regular import
        }
        
        // Regular CSV/JSON import
        if (!isExportFormat) {
          const defaultGroupName = newGroupNameInput.value.trim() || file.name.replace(/\.[^/.]+$/, "");
          updateStatus('IMPORTING... (0 POIs)');
          
          // Parse data synchronously (one-time parse is OK, storage ops run async)
          let pois;
          let groupedPois = {};
          let ungroupedPois = [];
          
          try {
            pois = importData(content, file.name.endsWith('.json') ? 'json' : 'csv');
            if (pois.length) {
              // Group POIs by groupName if specified
              for (const poi of pois) {
                if (poi.groupName) {
                  if (!groupedPois[poi.groupName]) {
                    groupedPois[poi.groupName] = [];
                  }
                  groupedPois[poi.groupName].push(poi);
                } else {
                  ungroupedPois.push(poi);
                }
              }
            }
          } catch (importErr) {
            console.error('Import validation error:', importErr);
            alert(`Import Error:\n\n${importErr.message}`);
            updateStatus('IMPORT FAILED');
            return;
          }
          
          // Now run storage operations in background (don't await, let UI stay responsive)
          if (pois.length) {
            (async () => {
              try {
                // Build batch of groups to save
                const groupsToSave = [];
                
                if (ungroupedPois.length > 0) {
                  groupsToSave.push({ pois: ungroupedPois, groupName: defaultGroupName });
                }
                for (const [groupName, groupPois] of Object.entries(groupedPois)) {
                  groupsToSave.push({ pois: groupPois, groupName });
                }
                
                // Single batch save: one storage read + one storage write for all groups
                const createdUuids = await savePOIsBatch(groupsToSave);
                
                // Set all created groups as active
                for (const uuid of createdUuids) {
                  activeGroups[uuid] = true;
                }
                
                // Reload profile manager cache (groupUuids were updated by savePOIsBatch)
                await profileManager.reload();
                
                // Reload group styles from the active profile fresh from storage
                const allProfiles = await chrome.storage.local.get(['profiles', 'activeProfile']);
                const activeProfileUuid = allProfiles.activeProfile;
                const profiles = allProfiles.profiles || {};
                const freshActiveProfile = profiles[activeProfileUuid];
                if (freshActiveProfile && freshActiveProfile.groupStyles) {
                  preferences.groupStyles = { ...freshActiveProfile.groupStyles };
                }
                
                await saveData();
                newGroupNameInput.value = '';
                await renderGroups();
                const totalCount = Object.keys(groupedPois).length;
                updateStatus(`IMPORTED ${pois.length} POIs IN ${totalCount > 0 ? totalCount + ' GROUPS' : defaultGroupName}`);
              } catch (importErr) {
                console.error('Import error during storage operations:', importErr);
                updateStatus('IMPORT FAILED');
              }
            })();
          }
        }
      } catch (err) {
        console.error('Import error:', err);
        updateStatus('IMPORT FAILED');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Export button handler
  exportBtn.onclick = async () => {
    try {
      const exportData = await exportGroupsData();
      if (exportData.length === 0) {
        updateStatus('NO GROUPS TO EXPORT');
        return;
      }
      
      // Create blob and download
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      a.download = `shullow-export-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      updateStatus(`EXPORTED ${exportData.length} GROUPS`);
    } catch (err) {
      console.error('Export error:', err);
      updateStatus('EXPORT FAILED');
    }
  };

  // Disable/Enable all groups handler
  disableAllBtn.onclick = async () => {
    const groupCount = Object.keys(activeGroups).length;
    if (groupCount === 0) {
      updateStatus('NO GROUPS TO TOGGLE');
      return;
    }
    
    const allDisabled = Object.values(activeGroups).every(v => v === false);
    const actionText = allDisabled ? 'Enable' : 'Disable';
    
    if (confirm(`${actionText} all ${groupCount} group${groupCount !== 1 ? 's' : ''}?`)) {
      console.log('[DISABLE-ALL] Starting, allDisabled=', allDisabled);
      for (const uuid of Object.keys(activeGroups)) {
        activeGroups[uuid] = allDisabled;
      }
      console.log('[DISABLE-ALL] Updated activeGroups:', activeGroups);
      await saveData();
      console.log('[DISABLE-ALL] Data saved to storage');
      
      // Notify all tabs with the updated activeGroups
      const groupsToSend = { ...activeGroups };
      await new Promise((resolve) => {
        chrome.tabs.query({}, (tabs) => {
          console.log('[DISABLE-ALL] Queried tabs, count=', tabs.length);
          const promises = [];
          tabs.forEach(tab => {
            if (tab.url) {
              console.log('[DISABLE-ALL] Sending update-active-groups to tab:', tab.url);
              promises.push(
                new Promise((res) => {
                  chrome.tabs.sendMessage(tab.id, {
                    action: 'update-active-groups',
                    activeGroups: groupsToSend,
                    preferences
                  }, () => {
                    console.log('[DISABLE-ALL] Got response from tab');
                    res();
                  });
                })
              );
            }
          });
          Promise.all(promises).then(() => {
            console.log('[DISABLE-ALL] All tabs notified');
            resolve();
          });
        });
      });
      await renderGroups();
      const statusText = allDisabled ? `ENABLED ${groupCount} GROUP${groupCount !== 1 ? 'S' : ''}` : `DISABLED ${groupCount} GROUP${groupCount !== 1 ? 'S' : ''}`;
      updateStatus(statusText);
      console.log('[DISABLE-ALL] Complete:', statusText);
    }
  };

  // Clear all groups handler
  if (clearAllBtn) {
    console.log('[SETUP] Attaching clearAllBtn handler');
    clearAllBtn.onclick = async () => {
      console.log('[CLEAR] Clear button clicked');
      const activeProfile = profileManager.getActive();
      console.log('[CLEAR] Active profile:', activeProfile);
      const profileGroupCount = activeProfile?.groupUuids?.length || 0;
      console.log('[CLEAR] Group count:', profileGroupCount);
      if (profileGroupCount === 0) {
        updateStatus('NO GROUPS TO CLEAR');
        return;
      }
      
      if (confirm(`Are you sure? This will DELETE all ${profileGroupCount} group${profileGroupCount !== 1 ? 's' : ''} in this profile and cannot be undone.`)) {
        console.log('[CLEAR] User confirmed, starting clear...');
        updateStatus('CLEARING... (0 GROUPS)');
        
        // Start clear in background - don't await, let it run while UI remains responsive
        (async () => {
          console.log('[CLEAR] IIFE started');
          try {
            // Single batch delete: clears all groups, removes from activeGroups, writes once to storage
            const deletedGroups = await deleteAllGroupsFromProfile(activeProfile.uuid, false);
            console.log('[CLEAR] deleteAllGroupsFromProfile completed, deleted:', deletedGroups.length);
            
            let deletedCount = 0;
            
            // Remove from local activeGroups state
            for (const { groupUuid, groupName } of deletedGroups) {
              console.log(`[CLEAR] Cleared group: ${groupName} (${groupUuid})`);
              delete activeGroups[groupUuid];
              deletedCount++;
              updateStatus(`CLEARING... (${deletedCount}/${profileGroupCount})`);
            }
            
            // Notify all tabs to update their state
            const groupsToSend = { ...activeGroups };
            console.log(`[CLEAR] Notifying tabs with activeGroups:`, groupsToSend);
            await new Promise((resolve) => {
              chrome.tabs.query({}, (tabs) => {
                const promises = [];
                tabs.forEach(tab => {
                  if (tab.url) {
                    promises.push(
                      new Promise((res) => {
                        chrome.tabs.sendMessage(tab.id, {
                          action: 'update-active-groups',
                          activeGroups: groupsToSend,
                          preferences
                        }, () => res());
                      })
                    );
                  }
                });
                Promise.all(promises).then(resolve);
              });
            });
            
            // Save activeGroups state to storage
            await StorageManager.saveState(preferences, activeGroups);
            
            // Reload profile manager cache and render UI
            console.log(`[CLEAR] All groups cleared, reloading profile and rendering UI...`);
            await profileManager.reload();
            await renderGroups();
            
            // Re-render profile menu to update group counts
            await renderProfiles();
            
            updateStatus(`CLEARED ${deletedCount} GROUPS`);
          } catch (err) {
            console.error('Clear all error:', err);
            updateStatus('CLEAR FAILED');
          }
        })(); // End of background clear IIFE
      }
    };
  } else {
    console.error('[SETUP] clearAllBtn not found in DOM');
  }
});
