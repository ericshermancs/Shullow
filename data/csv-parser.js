/**
 * Robustly parses CSV data, handling quoted fields with commas.
 * Case-insensitive field matching for latitude, longitude, name, and address.
 * If required fields are not found, throws an error listing missing fields.
 */
export function parseCSV(csvString) {
  const data = [];
  const lines = csvString.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV file is empty or contains no data rows');

  const rawHeaders = parseLine(lines[0]);
  
  // Normalize headers to lowercase for matching
  const normalizedHeaders = rawHeaders.map(h => h.toLowerCase().trim());
  
  // Find field indices with case-insensitive matching
  const fieldMapping = {
    latitude: null,
    longitude: null,
    name: null,
    address: null,
    groupName: null
  };
  
  // Try exact matches first
  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    if (header === 'latitude' || header === 'lat') fieldMapping.latitude = i;
    if (header === 'longitude' || header === 'lng' || header === 'long') fieldMapping.longitude = i;
    if (header === 'name' || header === 'title') fieldMapping.name = i;
    if (header === 'address' || header === 'addr') fieldMapping.address = i;
    if (header === 'shullow group' || header === 'shullow_group' || header === 'shullow group name' || header === 'shullow_group_name') fieldMapping.groupName = i;
  }
  
  // Try substring matching if exact matches didn't work
  if (fieldMapping.latitude === null) {
    const latIdx = normalizedHeaders.findIndex(h => h.includes('lat'));
    if (latIdx !== -1) fieldMapping.latitude = latIdx;
  }
  if (fieldMapping.longitude === null) {
    const lngIdx = normalizedHeaders.findIndex(h => h.includes('lng') || h.includes('long'));
    if (lngIdx !== -1) fieldMapping.longitude = lngIdx;
  }
  if (fieldMapping.name === null) {
    const nameIdx = normalizedHeaders.findIndex(h => h.includes('name') || h.includes('title'));
    if (nameIdx !== -1) fieldMapping.name = nameIdx;
  }
  if (fieldMapping.address === null) {
    const addrIdx = normalizedHeaders.findIndex(h => h.includes('address') || h.includes('addr'));
    if (addrIdx !== -1) fieldMapping.address = addrIdx;
  }
  if (fieldMapping.groupName === null) {
    const groupIdx = normalizedHeaders.findIndex(h => h.includes('shullow') && h.includes('group'));
    if (groupIdx !== -1) fieldMapping.groupName = groupIdx;
  }
  
  // If still no name field found, use first column as fallback
  if (fieldMapping.name === null) {
    fieldMapping.name = 0;
  }
  
  // Check for required fields and collect missing ones
  const missingFields = [];
  if (fieldMapping.latitude === null) missingFields.push('latitude');
  if (fieldMapping.longitude === null) missingFields.push('longitude');
  if (fieldMapping.name === null) missingFields.push('name');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}. Available columns: ${rawHeaders.join(', ')}`);
  }

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length > 0 && values.some(v => v.trim())) {
      // Pad values if necessary
      while (values.length < rawHeaders.length) {
        values.push('');
      }
      
      const row = {};
      rawHeaders.forEach((h, j) => {
        const normalizedKey = h.toLowerCase().trim();
        let val = values[j] || '';
        
        if (normalizedKey === 'latitude' || normalizedKey === 'lat') {
          val = parseFloat(val);
        } else if (normalizedKey === 'longitude' || normalizedKey === 'lng' || normalizedKey === 'long') {
          val = parseFloat(val);
        }
        
        row[h] = val;
      });
      
      // Normalize the row to standard field names
      const normalizedRow = {
        name: values[fieldMapping.name]?.trim() || `POI ${i}`,
        latitude: parseFloat(values[fieldMapping.latitude]),
        longitude: parseFloat(values[fieldMapping.longitude]),
        address: fieldMapping.address !== null ? values[fieldMapping.address]?.trim() || '' : ''
      };
      
      // Add group name if present
      if (fieldMapping.groupName !== null && values[fieldMapping.groupName]?.trim()) {
        normalizedRow.groupName = values[fieldMapping.groupName].trim();
      }
      
      // Add any other columns as extra fields
      for (let j = 0; j < rawHeaders.length; j++) {
        const key = rawHeaders[j].toLowerCase().trim();
        if (!['latitude', 'longitude', 'name', 'address', 'lat', 'lng', 'long', 'title', 'addr', 'shullow group', 'shullow_group', 'shullow group name', 'shullow_group_name'].includes(key) && !key.includes('shullow')) {
          normalizedRow[rawHeaders[j]] = values[j] || '';
        }
      }
      
      // Validate lat/lng are numbers
      if (!isNaN(normalizedRow.latitude) && !isNaN(normalizedRow.longitude)) {
        data.push(normalizedRow);
      }
    }
  }
  
  if (data.length === 0) {
    throw new Error('No valid POI records found in CSV file');
  }
  
  return data;
}

function parseLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}
