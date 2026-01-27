// SELF-CONTAINED POPUP JS FOR TESTING
console.log('Self-contained popup script execution started');

// 1. Define mocks
if (typeof chrome === 'undefined') {
  globalThis.chrome = {};
}
if (!chrome.storage) {
  chrome.storage = {
    local: {
      get: (keys) => Promise.resolve({}),
      set: (data) => Promise.resolve()
    },
    sync: {
      get: (keys) => Promise.resolve({}),
      set: (data) => Promise.resolve()
    }
  };
  chrome.tabs = {
    query: (info) => Promise.resolve([{ id: 1 }]),
    sendMessage: (id, msg) => Promise.resolve()
  };
  chrome.runtime = {
    onMessage: { addListener: () => {} },
    getURL: (path) => path
  };
}

// 2. Mock data manager functions
const importData = (data, format) => {
    console.log('Mock importData called');
    return [{ name: 'Test POI', latitude: 40, longitude: -70 }];
};
const savePOIs = (pois, group, sync) => {
    console.log('Mock savePOIs called');
    return Promise.resolve();
};
const loadPOIGroups = (sync) => {
    console.log('Mock loadPOIGroups called');
    return Promise.resolve({ 'Test Group': [] });
};
const deletePOIGroup = (name, sync) => {
    console.log('Mock deletePOIGroup called');
    return Promise.resolve();
};

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded fired');
  const importDataBtn = document.getElementById('import-data-btn');
  const fileInput = document.getElementById('file-input');
  const createGroupBtn = document.getElementById('create-group-btn');
  const groupsContainer = document.getElementById('groups-container');

  loadGroups(false);

  if (importDataBtn) {
    importDataBtn.addEventListener('click', () => {
      console.log('Import button clicked');
      alert('Import button clicked');
    });
  }

  if (createGroupBtn) {
    createGroupBtn.addEventListener('click', () => {
      console.log('Create group button clicked');
      alert('Create group button clicked');
    });
  }
});

async function loadGroups(useSyncStorage) {
  console.log('loadGroups called');
  const groupsContainer = document.getElementById('groups-container');
  if (!groupsContainer) return;
  groupsContainer.innerHTML = '';

  try {
    const poiGroups = await loadPOIGroups(useSyncStorage);
    const groupNames = Object.keys(poiGroups);
    console.log('Groups found:', groupNames);

    if (groupNames.length === 0) {
      groupsContainer.innerHTML = '<p>No groups found.</p>';
      return;
    }

    groupNames.sort().forEach(groupName => {
      const groupElement = document.createElement('div');
      groupElement.className = 'group-item';
      groupElement.innerHTML = `
        <label>
          <input type='checkbox' data-group-name='${groupName}' checked> ${groupName}
        </label>
        <button data-group-name='${groupName}' class='delete-group-btn'>X</button>
      `;
      groupsContainer.appendChild(groupElement);
    });
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}
