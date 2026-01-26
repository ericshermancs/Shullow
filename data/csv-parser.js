/**
 * Robustly parses CSV data, handling quoted fields with commas.
 */
export function parseCSV(csvString) {
  const data = [];
  const lines = csvString.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, j) => {
        let val = values[j];
        if (h === 'latitude' || h === 'longitude') val = parseFloat(val);
        row[h] = val;
      });
      data.push(row);
    } else {
      console.warn(`Mismatch on line ${i+1}: expected ${headers.length}, got ${values.length}`);
    }
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
