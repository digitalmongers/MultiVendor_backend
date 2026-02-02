import XLSX from 'xlsx';

/**
 * Generate Excel Template for Bulk Product Import
 * Enterprise-grade template with instructions and validation hints
 */
export const generateProductImportTemplate = () => {
    // Main product data sheet
    const productHeaders = [
        'name',
        'description',
        'category',
        'subCategory',
        'brand',
        'productType',
        'unit',
        'searchTags',
        'price',
        'purchasePrice',
        'tax',
        'taxType',
        'discount',
        'discountType',
        'shippingCost',
        'multiplyShippingCost',
        'quantity',
        'sku',
        'colors',
        'thumbnailUrl',
        'imageUrls',
        'videoLink',
        'metaTitle',
        'metaDescription',
        'metaImage',
        'variations',
        'attributes'
    ];

    // Field descriptions for help
    const fieldDescriptions = [
        'Product name (3-200 characters) *REQUIRED',
        'Product description (10-5000 characters) *REQUIRED',
        'Category name (must exist in system) *REQUIRED',
        'Sub-category name (optional)',
        'Brand name (optional)',
        'Product type: physical or digital *REQUIRED',
        'Unit: kg, pc, ltr, etc. *REQUIRED',
        'Search tags (comma-separated, max 50 chars each)',
        'Selling price (must be >= 0) *REQUIRED',
        'Purchase price (optional, for tracking)',
        'Tax amount (default: 0)',
        'Tax type: percent or flat (default: percent)',
        'Discount amount (default: 0)',
        'Discount type: percent or flat (default: percent)',
        'Shipping cost (default: 0)',
        'Multiply shipping by quantity: true or false (default: false)',
        'Stock quantity (must be >= 0) *REQUIRED',
        'SKU - Stock Keeping Unit (must be unique) *REQUIRED',
        'Colors (comma-separated hex codes or names)',
        'Thumbnail image URL (publicly accessible)',
        'Product images URLs (comma-separated, publicly accessible)',
        'Video link URL (optional)',
        'SEO Meta Title (max 200 chars)',
        'SEO Meta Description (max 500 chars)',
        'SEO Meta Image URL',
        'Variations JSON (optional, see instructions)',
        'Attributes JSON (optional, see instructions)'
    ];

    // Sample data row
    const sampleData = [
        'Premium Cotton T-Shirt',
        'High-quality cotton t-shirt with comfortable fit. Perfect for casual wear. Available in multiple colors and sizes.',
        'Clothing',
        'T-Shirts',
        'BrandName',
        'physical',
        'pc',
        'tshirt, cotton, casual, comfortable',
        '599',
        '299',
        '18',
        'percent',
        '10',
        'percent',
        '50',
        'false',
        '100',
        'SKU-TSHIRT-001',
        '#FF0000, #0000FF, #000000',
        'https://example.com/images/tshirt-thumb.jpg',
        'https://example.com/images/tshirt-1.jpg, https://example.com/images/tshirt-2.jpg',
        'https://youtube.com/watch?v=example',
        'Premium Cotton T-Shirt - Comfortable Casual Wear',
        'Buy premium cotton t-shirts online. High quality, comfortable fit, multiple colors available.',
        'https://example.com/images/tshirt-meta.jpg',
        '',
        ''
    ];

    // Create product data sheet
    const productData = [
        productHeaders,
        fieldDescriptions,
        sampleData
    ];

    const productSheet = XLSX.utils.aoa_to_sheet(productData);

    // Set column widths for better readability
    productSheet['!cols'] = productHeaders.map(() => ({ wch: 20 }));

    // Instructions sheet
    const instructions = [
        ['BULK PRODUCT IMPORT - INSTRUCTIONS'],
        [''],
        ['REQUIRED FIELDS (marked with *)'],
        ['- name: Product name (3-200 characters)'],
        ['- description: Product description (10-5000 characters)'],
        ['- category: Category name (must exist in your system)'],
        ['- productType: Either "physical" or "digital"'],
        ['- unit: Unit of measurement (e.g., kg, pc, ltr, box, etc.)'],
        ['- price: Selling price (must be 0 or greater)'],
        ['- quantity: Stock quantity (must be 0 or greater)'],
        ['- sku: Unique stock keeping unit identifier'],
        [''],
        ['OPTIONAL FIELDS'],
        ['- subCategory: Sub-category name (if applicable)'],
        ['- brand: Brand name'],
        ['- searchTags: Comma-separated tags for search (e.g., "cotton, comfortable, casual")'],
        ['- purchasePrice: Your purchase/cost price'],
        ['- tax: Tax amount (default: 0)'],
        ['- taxType: "percent" or "flat" (default: percent)'],
        ['- discount: Discount amount (default: 0)'],
        ['- discountType: "percent" or "flat" (default: percent)'],
        ['- shippingCost: Shipping cost (default: 0)'],
        ['- multiplyShippingCost: "true" or "false" - multiply shipping by quantity'],
        ['- colors: Comma-separated color codes or names'],
        ['- thumbnailUrl: URL to thumbnail image (publicly accessible)'],
        ['- imageUrls: Comma-separated URLs to product images'],
        ['- videoLink: YouTube or video URL'],
        ['- metaTitle: SEO meta title (max 200 chars)'],
        ['- metaDescription: SEO meta description (max 500 chars)'],
        ['- metaImage: SEO meta image URL'],
        [''],
        ['IMAGE URLS'],
        ['- All image URLs must be publicly accessible (no authentication required)'],
        ['- Supported formats: JPEG, PNG, WebP, GIF'],
        ['- Images will be downloaded and uploaded to Cloudinary'],
        ['- Invalid URLs will be skipped (product will still be created)'],
        ['- Use comma to separate multiple image URLs'],
        [''],
        ['VARIATIONS (Advanced)'],
        ['- Leave empty if product has no variations'],
        ['- Format: JSON array of variation objects'],
        ['- Example: [{"attributeValues":{"Size":"L","Color":"Red"},"price":699,"sku":"SKU-L-RED","stock":50}]'],
        [''],
        ['ATTRIBUTES (Advanced)'],
        ['- Leave empty if product has no attributes'],
        ['- Format: JSON array with attribute IDs and values'],
        ['- You must know the attribute ObjectId from your database'],
        ['- Example: [{"attribute":"507f1f77bcf86cd799439011","values":["Small","Medium","Large"]}]'],
        [''],
        ['IMPORTANT NOTES'],
        ['- Maximum 500 products per upload'],
        ['- Maximum file size: 5MB'],
        ['- All products are created with status "pending" (requires admin approval)'],
        ['- Duplicate SKUs will cause errors'],
        ['- Category and subcategory names must match exactly (case-sensitive)'],
        ['- Delete the sample data row before uploading your products'],
        ['- Keep the header row (row 1) intact'],
        [''],
        ['VALIDATION'],
        ['- All data is validated before import'],
        ['- If any row has errors, the entire import will fail'],
        ['- You will receive detailed error messages with row numbers'],
        ['- Fix all errors and re-upload'],
        [''],
        ['PROCESS'],
        ['1. Download this template'],
        ['2. Fill in your product data (delete sample row)'],
        ['3. Save the file'],
        ['4. Upload via the bulk import endpoint'],
        ['5. Wait for processing (may take a few minutes for large files)'],
        ['6. Check response for success or error details']
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 80 }];

    // Valid values reference sheet
    const validValues = [
        ['VALID VALUES REFERENCE'],
        [''],
        ['PRODUCT TYPE'],
        ['physical'],
        ['digital'],
        [''],
        ['TAX TYPE'],
        ['percent'],
        ['flat'],
        [''],
        ['DISCOUNT TYPE'],
        ['percent'],
        ['flat'],
        [''],
        ['COMMON UNITS'],
        ['pc (piece)'],
        ['kg (kilogram)'],
        ['g (gram)'],
        ['ltr (liter)'],
        ['ml (milliliter)'],
        ['box'],
        ['pack'],
        ['set'],
        ['pair'],
        ['dozen'],
        ['meter'],
        ['cm (centimeter)'],
        ['sqft (square feet)'],
        ['sqm (square meter)'],
        [''],
        ['BOOLEAN VALUES'],
        ['true'],
        ['false'],
        [''],
        ['NOTE: Units can be any string, above are just common examples']
    ];

    const validValuesSheet = XLSX.utils.aoa_to_sheet(validValues);
    validValuesSheet['!cols'] = [{ wch: 40 }];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, productSheet, 'Products');
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');
    XLSX.utils.book_append_sheet(workbook, validValuesSheet, 'Valid Values');

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return excelBuffer;
};
