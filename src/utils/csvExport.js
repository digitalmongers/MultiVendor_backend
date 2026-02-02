/**
 * CSV Export Utility
 * Converts array of objects to CSV format
 */

export const convertToCSV = (data, headers) => {
  if (!data || data.length === 0) {
    return '';
  }

  // Create header row
  const headerRow = headers.map(h => `"${h.label}"`).join(',');

  // Create data rows
  const dataRows = data.map(item => {
    return headers.map(h => {
      let value = h.key.split('.').reduce((obj, key) => obj?.[key], item);

      // Handle different data types
      if (value === null || value === undefined) {
        value = '';
      } else if (typeof value === 'object') {
        value = JSON.stringify(value);
      } else {
        value = String(value);
      }

      // Escape quotes and wrap in quotes
      return `"${value.replace(/"/g, '""')}"`;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
};

export const productCSVHeaders = [
  { label: 'Product ID', key: '_id' },
  { label: 'Name', key: 'name' },
  { label: 'SKU', key: 'sku' },
  { label: 'Category', key: 'category.name' },
  { label: 'SubCategory', key: 'subCategory.name' },
  { label: 'Vendor', key: 'vendor.businessName' },
  { label: 'Price', key: 'price' },
  { label: 'Discount', key: 'discount' },
  { label: 'Discount Type', key: 'discountType' },
  { label: 'Tax', key: 'tax' },
  { label: 'Tax Type', key: 'taxType' },
  { label: 'Stock', key: 'quantity' },
  { label: 'Status', key: 'status' },
  { label: 'Active', key: 'isActive' },
  { label: 'Product Type', key: 'productType' },
  { label: 'Unit', key: 'unit' },
  { label: 'Brand', key: 'brand' },
  { label: 'Created At', key: 'createdAt' },
  { label: 'Updated At', key: 'updatedAt' },
];

export const couponCSVHeaders = [
  { label: 'Coupon ID', key: '_id' },
  { label: 'Title', key: 'title' },
  { label: 'Code', key: 'code' },
  { label: 'Type', key: 'type' },
  { label: 'Discount Type', key: 'discountType' },
  { label: 'Discount Amount', key: 'discountAmount' },
  { label: 'Min Purchase', key: 'minPurchase' },
  { label: 'Limit/User', key: 'limitForSameUser' },
  { label: 'Start Date', key: 'startDate' },
  { label: 'Expire Date', key: 'expireDate' },
  { label: 'Status', key: 'isActive' },
  { label: 'Bearer', key: 'bearer' },
  { label: 'Vendor', key: 'vendor.businessName' },
  { label: 'Total Used', key: 'totalUsed' },
  { label: 'Created At', key: 'createdAt' }
];
