/**
 * Converts JSON data to CSV string
 * @param {Array} data - Array of objects
 * @param {Array} headers - Array of header names
 * @param {Array} fields - Array of object field names corresponding to headers
 * @returns {string} - CSV string
 */
export const jsonToCsv = (data, headers, fields) => {
  const csvRows = [headers.join(',')];

  for (const item of data) {
    const values = fields.map(field => {
      // Handle nested fields (e.g., 'customer.name')
      let value = field.split('.').reduce((obj, key) => (obj ? obj[key] : ''), item);
      
      // Escape commas and quotes
      const stringValue = String(value || '');
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
};

export default {
  jsonToCsv,
};
