import { loadPOIGroups, savePOIs, importData, deletePOIGroup, renamePOIGroup, exportGroupsData, importGroupsData } from '../data/data-manager.js';
import { ColorWheel } from './modules/color-wheel.js';
import { StorageManager } from './modules/storage.js';

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
    overlayEnabled: false,
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
  const saveData = async () => {
    await StorageManager.saveState(preferences, activeGroups);
    StorageManager.notifyContentScript(activeGroups, preferences);
  };
  const getSiteEnabled = () => {
    const sitePref = preferences.sitePreferences?.[currentHost];
    if (sitePref && typeof sitePref.siteEnabled === 'boolean') return sitePref.siteEnabled;
    if (sitePref && typeof sitePref.overlayEnabled === 'boolean') return sitePref.overlayEnabled;
    return false;
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
      const style = preferences.groupStyles[groupUuid] || { color: '#4a9eff', secondaryColor: '#ffffff', logoData: null };
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
      if (!preferences.groupStyles) preferences.groupStyles = {};
      preferences.groupStyles[currentEditingGroup] = { color: tempPriColor, secondaryColor: tempSecColor, logoData: currentLogoData };
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
      const uuids = Object.keys(groups);
      groupCountEl.textContent = uuids.length;
      if (uuids.length === 0) { groupsContainer.innerHTML = '<div class="empty-state">NO GROUPS FOUND</div>'; return; }
      groupsContainer.innerHTML = '';
      
      // Sort by group name
      const sortedEntries = uuids.map(uuid => ({ uuid, group: groups[uuid] }))
        .sort((a, b) => a.group.name.localeCompare(b.group.name));
      
      sortedEntries.forEach(({ uuid, group }) => {
        const style = preferences.groupStyles[uuid] || { color: '#4a9eff', secondaryColor: '#ffffff' };
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
    } catch (e) { console.error('Render error', e); }
  };

  // --- Initialize ---
  const state = await StorageManager.loadState();
  if (state.preferences) preferences = { ...preferences, ...state.preferences };
  if (state.activeGroups) activeGroups = state.activeGroups;
  
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
  nightModeToggle.addEventListener('click', () => {
    preferences.nightMode = !preferences.nightMode;
    if (preferences.nightMode) {
      document.body.classList.add('night-mode');
      nightModeIcon.textContent = '☀️';
    } else {
      document.body.classList.remove('night-mode');
      nightModeIcon.textContent = '🌙';
    }
    saveData();
  });

  overlayToggle.addEventListener('change', (e) => {
    if (!preferences.sitePreferences) preferences.sitePreferences = {};
    const enabled = e.target.checked;
    const existing = preferences.sitePreferences[currentHost] || {};
    preferences.sitePreferences[currentHost] = { ...existing, siteEnabled: enabled, overlayEnabled: enabled };
    saveData();
    StorageManager.notifyTabsForHost(currentHost, {
      action: 'toggle-site-enabled',
      enabled,
      host: currentHost
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
    }

    const del = e.target.closest('.delete-btn');
    if (del && confirm(`Delete "${del.dataset.name}"?`)) {
      const uuid = del.dataset.uuid;
      await deletePOIGroup(uuid);
      delete preferences.groupStyles[uuid];
      delete activeGroups[uuid];
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
      await saveData();
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
            const importedCount = await importGroupsData(jsonData);
            if (importedCount > 0) {
              // Mark all imported groups as active
              const groups = await loadPOIGroups();
              for (const uuid of Object.keys(groups)) {
                if (activeGroups[uuid] === undefined) {
                  activeGroups[uuid] = true;
                }
              }
              // Reload preferences to get the updated group styles
              const state = await StorageManager.loadState();
              if (state.preferences) {
                preferences = { ...preferences, ...state.preferences };
              }
              await saveData();
              newGroupNameInput.value = '';
              await renderGroups();
              updateStatus(`IMPORTED ${importedCount} GROUPS`);
              return;
            }
          }
        } catch (e) {
          // Not JSON or not export format, continue with regular import
        }
        
        // Regular CSV/JSON import
        if (!isExportFormat) {
          const defaultGroupName = newGroupNameInput.value.trim() || file.name.replace(/\.[^/.]+$/, "");
          try {
            const pois = importData(content, file.name.endsWith('.json') ? 'json' : 'csv');
            if (pois.length) {
              // Group POIs by groupName if specified, otherwise use default group
              const groupedPois = {};
              const ungroupedPois = [];
              
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
              
              // Save ungrouped POIs to default group if any
              if (ungroupedPois.length > 0) {
                const uuid = await savePOIs(ungroupedPois, defaultGroupName);
                if (uuid) {
                  activeGroups[uuid] = true;
                }
              }
              
              // Save grouped POIs to their named groups
              for (const [groupName, groupPois] of Object.entries(groupedPois)) {
                const uuid = await savePOIs(groupPois, groupName);
                if (uuid) {
                  activeGroups[uuid] = true;
                }
              }
              
              // Reload all groups to ensure metadata is current
              const loadedGroups = await loadPOIGroups();
              for (const uuid of Object.keys(loadedGroups)) {
                if (activeGroups[uuid] === undefined) {
                  activeGroups[uuid] = true;
                }
              }
              
              // Reload preferences to get the updated group styles
              const state = await StorageManager.loadState();
              if (state && state.preferences) {
                preferences = { ...preferences, ...state.preferences };
              }
              
              await saveData();
              newGroupNameInput.value = '';
              await renderGroups();
              const totalCount = Object.keys(groupedPois).length;
              updateStatus(`IMPORTED ${pois.length} POIs IN ${totalCount > 0 ? totalCount + ' GROUPS' : defaultGroupName}`);
            }
          } catch (importErr) {
            console.error('Import validation error:', importErr);
            alert(`Import Error:\n\n${importErr.message}`);
            updateStatus('IMPORT FAILED');
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

  // Disable all groups handler
  disableAllBtn.onclick = async () => {
    const groupCount = Object.keys(activeGroups).length;
    if (groupCount === 0) {
      updateStatus('NO GROUPS TO DISABLE');
      return;
    }
    
    if (confirm(`Disable all ${groupCount} group${groupCount !== 1 ? 's' : ''}?`)) {
      for (const uuid of Object.keys(activeGroups)) {
        activeGroups[uuid] = false;
      }
      await saveData();
      // Notify all tabs to redraw
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'reload-overlay' }).catch(() => {});
        });
      });
      await renderGroups();
      updateStatus(`DISABLED ${groupCount} GROUP${groupCount !== 1 ? 'S' : ''}`);
    }
  };

  // Clear all groups handler
  clearAllBtn.onclick = async () => {
    const groupCount = Object.keys(activeGroups).length;
    if (groupCount === 0) {
      updateStatus('NO GROUPS TO CLEAR');
      return;
    }
    
    if (confirm(`Are you sure? This will DELETE all ${groupCount} group${groupCount !== 1 ? 's' : ''} and cannot be undone.`)) {
      const groups = await loadPOIGroups();
      for (const uuid of Object.keys(groups)) {
        await deletePOIGroup(uuid);
        delete preferences.groupStyles[uuid];
        delete activeGroups[uuid];
      }
      await saveData();
      // Notify all tabs to redraw
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { action: 'reload-overlay' }).catch(() => {});
        });
      });
      await renderGroups();
      updateStatus(`CLEARED ALL GROUPS`);
    }
  };
});
