/**
 * Parses JSON data into a structured format.
 */
export function parseJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data)) {
      return data.map(item => normalizePoi(item));
    } else if (data.pois && Array.isArray(data.pois)) {
      return data.pois.map(item => normalizePoi(item));
    } else {
      console.warn('JSON data is not in a recognized POI format.');
      return [];
    }
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return [];
  }
}

function normalizePoi(poi) {
  return {
    id: poi.id || `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: poi.name || poi.place_name || 'Unnamed POI',
    latitude: parseFloat(poi.latitude || poi.lat || poi.position?.lat),
    longitude: parseFloat(poi.longitude || poi.lng || poi.position?.lon),
    category: poi.category || poi.type || 'unknown',
    address: poi.address || null,
    city: poi.city || null,
    state: poi.state || null
  };
}
