// Background script for Map POI Injector

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get-data-sources") {
    // In a real extension, you'd fetch this from storage or an API
    const dataSources = [
      { id: 'synagogue-data', name: 'Synagogue Data (CSV)', type: 'csv' },
      { id: 'custom-json', name: 'Custom JSON', type: 'json' }
    ];
    sendResponse({ dataSources });
  }
  // Handle other messages as needed
  return true; // Indicates asynchronous response
});

console.log('Background script loaded.');