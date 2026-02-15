/**
 * Parses JSON data into a structured format.
 * Handles flexible field names (case-insensitive, nested fields).
 * Validates required fields: latitude, longitude, name.
 */
export function parseJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    let items = [];
    
    if (Array.isArray(data)) {
      items = data;
    } else if (data.pois && Array.isArray(data.pois)) {
      items = data.pois;
    } else if (typeof data === 'object' && data !== null) {
      // Single object, treat as array with one item
      items = [data];
    } else {
      throw new Error('JSON data is not in a recognized POI format (expected array or object with pois array).');
    }

    // Field mapping similar to CSV parser
    const fieldMapping = {
      latitude: null,
      longitude: null,
      name: null,
      address: null,
      groupName: null
    };

    // Sample first item to detect field names
    if (items.length > 0) {
      const sampleItem = items[0];
      const sampleKeys = Object.keys(sampleItem);
      
      // Exact match first (case-insensitive)
      for (const key of sampleKeys) {
        const lowerKey = key.toLowerCase();
        if (['latitude', 'lat'].includes(lowerKey)) fieldMapping.latitude = key;
        if (['longitude', 'lng', 'long'].includes(lowerKey)) fieldMapping.longitude = key;
        if (['name', 'title', 'place_name'].includes(lowerKey)) fieldMapping.name = key;
        if (['address', 'addr', 'street'].includes(lowerKey)) fieldMapping.address = key;
        if (['shullow group', 'shullow_group', 'shullow group name', 'shullow_group_name'].includes(lowerKey)) fieldMapping.groupName = key;
      }

      // Substring matching fallback
      if (fieldMapping.latitude === null) {
        const latKey = sampleKeys.find(k => k.toLowerCase().includes('lat'));
        if (latKey) fieldMapping.latitude = latKey;
      }
      if (fieldMapping.longitude === null) {
        const lngKey = sampleKeys.find(k => {
          const lower = k.toLowerCase();
          return lower.includes('lng') || lower.includes('long') || lower.includes('lon');
        });
        if (lngKey) fieldMapping.longitude = lngKey;
      }
      if (fieldMapping.address === null) {
        const addrKey = sampleKeys.find(k => k.toLowerCase().includes('addr'));
        if (addrKey) fieldMapping.address = addrKey;
      }
      if (fieldMapping.groupName === null) {
        const groupKey = sampleKeys.find(k => {
          const lower = k.toLowerCase();
          return lower.includes('shullow') && lower.includes('group');
        });
        if (groupKey) fieldMapping.groupName = groupKey;
      }

      // First key as name fallback
      if (fieldMapping.name === null && sampleKeys.length > 0) {
        fieldMapping.name = sampleKeys[0];
      }

      // Validate required fields
      const missingFields = [];
      if (fieldMapping.latitude === null) missingFields.push('latitude');
      if (fieldMapping.longitude === null) missingFields.push('longitude');
      if (fieldMapping.name === null) missingFields.push('name');

      if (missingFields.length > 0) {
        throw new Error(
          `Missing required fields: ${missingFields.join(', ')}. ` +
          `Available fields: ${sampleKeys.join(', ')}`
        );
      }
    }

    return items
      .filter(item => item && typeof item === 'object')
      .map(item => normalizePoi(item, fieldMapping));
  } catch (error) {
    throw error;
  }
}

function normalizePoi(poi, fieldMapping) {
  const latitude = parseFloat(
    poi[fieldMapping.latitude] || 
    poi.position?.lat || 
    poi.location?.lat || 
    poi.coordinates?.[1]
  );
  
  const longitude = parseFloat(
    poi[fieldMapping.longitude] || 
    poi.position?.lon || 
    poi.position?.lng ||
    poi.location?.lon || 
    poi.location?.lng ||
    poi.coordinates?.[0]
  );

  // Validate numeric coordinates
  if (isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  const name = poi[fieldMapping.name] || 'Unnamed POI';
  const address = poi[fieldMapping.address] || poi.address || null;
  const groupName = fieldMapping.groupName && poi[fieldMapping.groupName] ? String(poi[fieldMapping.groupName]).trim() : null;

  // Collect other fields
  const otherFields = {};
  for (const [key, value] of Object.entries(poi)) {
    const lowerKey = key.toLowerCase();
    if (!['latitude', 'lat', 'longitude', 'lng', 'long', 'name', 'title', 'place_name', 'address', 'addr', 'street', 'id', 'position', 'location', 'coordinates'].includes(lowerKey) && !lowerKey.includes('shullow')) {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        otherFields[key] = value;
      }
    }
  }

  const result = {
    id: poi.id || `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: String(name).trim(),
    latitude,
    longitude,
    address: address ? String(address).trim() : null,
    ...otherFields
  };

  if (groupName) {
    result.groupName = groupName;
  }

  return result;
}
