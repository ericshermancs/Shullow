import { loadPOIGroups, savePOIs, importData, deletePOIGroup, renamePOIGroup } from '../data/data-manager.js';
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
  const groupsContainer = document.getElementById('groups-container');
  const groupCountEl = document.getElementById('group-count');
  const statusText = document.getElementById('status-text');
  const hostnameDisplay = document.getElementById('current-hostname');
  const newGroupNameInput = document.getElementById('new-group-name');
  const csvUploadInput = document.getElementById('csv-upload');

  let preferences = {
    overlayEnabled: true,
    debugEnabled: false,
    sitePreferences: {},
    groupStyles: {},
    accentColor: '#d1ff00'
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

  const primaryWheel = new ColorWheel('primary-wheel-container', '#d1ff00', (hex) => { tempPriColor = hex; });
  const secondaryWheel = new ColorWheel('secondary-wheel-container', '#ffffff', (hex) => { tempSecColor = hex; });
  const themeWheel = new ColorWheel('theme-wheel-container', '#d1ff00', (hex) => { tempThemeColor = hex; });

  const showModal = (groupName) => {
    currentEditingGroup = groupName;
    themeFields.style.display = 'none';
    groupFields.style.display = 'block';
    
    if (groupName === '__theme__') {
      modalTitle.textContent = 'CUSTOMIZE THEME';
      themeFields.style.display = 'block';
      groupFields.style.display = 'none';
      tempThemeColor = preferences.accentColor;
      themeWheel.setColor(tempThemeColor);
    } else {
      modalTitle.textContent = `CUSTOMIZE: ${groupName.toUpperCase()}`;
      const style = preferences.groupStyles[groupName] || { color: '#d1ff00', secondaryColor: '#ffffff', logoData: null };
      tempPriColor = style.color || '#d1ff00';
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
      const names = Object.keys(groups);
      groupCountEl.textContent = names.length;
      if (names.length === 0) { groupsContainer.innerHTML = '<div class="empty-state">NO GROUPS FOUND</div>'; return; }
      groupsContainer.innerHTML = '';
      names.sort().forEach(name => {
        const style = preferences.groupStyles[name] || { color: '#d1ff00', secondaryColor: '#ffffff' };
        const isActive = activeGroups[name] !== false;
        const icon = style.logoData ? `<img src="${style.logoData}" class="pin-icon">` : PIN_SVG(style.color, style.secondaryColor || '#ffffff');
        const item = document.createElement('div');
        item.className = 'group-item';
        item.innerHTML = `
          <div class="pin-preview" data-group="${name}">${icon}</div>
          <span class="group-name" data-group="${name}">${name}</span>
          <div class="group-actions">
            <button class="delete-btn" data-group="${name}">&times;</button>
            <label class="switch">
              <input type="checkbox" class="group-toggle" data-group="${name}" ${isActive ? 'checked' : ''}>
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
  await renderGroups();
  updateStatus('SYSTEM READY');

  // --- Listeners ---
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

  document.getElementById('theme-color-trigger').onclick = () => showModal('__theme__');

  groupsContainer.addEventListener('click', async (e) => {
    const preview = e.target.closest('.pin-preview');
    if (preview) return showModal(preview.dataset.group);

    const nameSpan = e.target.closest('.group-name');
    if (nameSpan && !nameSpan.querySelector('input')) {
      const oldName = nameSpan.dataset.group;
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
          await renamePOIGroup(oldName, val);
          if (preferences.groupStyles[oldName]) {
            preferences.groupStyles[val] = preferences.groupStyles[oldName];
            delete preferences.groupStyles[oldName];
          }
          if (activeGroups[oldName] !== undefined) {
            activeGroups[val] = activeGroups[oldName];
            delete activeGroups[oldName];
          }
          await saveData();
          await renderGroups();
        } else { nameSpan.textContent = oldName; }
      };
      input.onblur = () => done(true);
      input.onkeydown = (ev) => { if (ev.key === 'Enter') done(true); if (ev.key === 'Escape') done(false); };
    }

    const del = e.target.closest('.delete-btn');
    if (del && confirm(`Delete "${del.dataset.group}"?`)) {
      await deletePOIGroup(del.dataset.group);
      delete preferences.groupStyles[del.dataset.group];
      delete activeGroups[del.dataset.group];
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
      activeGroups[e.target.dataset.group] = e.target.checked;
      await saveData();
    }
  });

  csvUploadInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const groupName = newGroupNameInput.value.trim() || file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const pois = importData(ev.target.result, file.name.endsWith('.json') ? 'json' : 'csv');
      if (pois.length) {
        await savePOIs(pois, groupName);
        // Add new group to activeGroups as active and notify content script
        activeGroups[groupName] = true;
        await saveData();
        newGroupNameInput.value = '';
        await renderGroups();
        updateStatus('IMPORTED ' + pois.length);
      }
    };
    reader.readAsText(file);
  };
});
