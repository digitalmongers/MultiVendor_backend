import ExcelJS from 'exceljs';
import { z } from 'zod';
import AppError from './AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Logger from './logger.js';
import ProductCategoryRepository from '../repositories/productCategory.repository.js';
import ProductSubCategoryRepository from '../repositories/productSubCategory.repository.js';
import stream from 'stream';

/**
 * Zod schema for validating individual product row from Excel
 */
const productRowSchema = z.object({
    name: z.string()
        .min(3, 'Name must be at least 3 characters')
        .max(200, 'Name cannot exceed 200 characters')
        .trim(),

    description: z.string()
        .min(10, 'Description must be at least 10 characters')
        .max(5000, 'Description cannot exceed 5000 characters')
        .trim(),

    category: z.string()
        .min(1, 'Category is required')
        .trim(),

    subCategory: z.string()
        .trim()
        .optional()
        .nullable()
        .transform(val => val || undefined),

    brand: z.string()
        .max(100, 'Brand name too long')
        .trim()
        .optional()
        .nullable()
        .transform(val => val || undefined),

    productType: z.enum(['physical', 'digital'], {
        errorMap: () => ({ message: 'Product type must be either "physical" or "digital"' })
    }),

    unit: z.string()
        .min(1, 'Unit is required')
        .max(20, 'Unit name too long')
        .trim(),

    searchTags: z.string()
        .optional()
        .nullable()
        .transform(val => {
            if (!val) return [];
            return val.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        }),

    price: z.union([z.string(), z.number()])
        .transform(val => typeof val === 'string' ? parseFloat(val) : val)
        .refine(val => !isNaN(val) && val >= 0, 'Price must be a valid number >= 0'),

    purchasePrice: z.union([z.string(), z.number()])
        .optional()
        .nullable()
        .transform(val => {
            if (!val) return undefined;
            const num = typeof val === 'string' ? parseFloat(val) : val;
            return isNaN(num) ? undefined : num;
        }),

    tax: z.union([z.string(), z.number()])
        .optional()
        .nullable()
        .transform(val => {
            if (!val) return 0;
            const num = typeof val === 'string' ? parseFloat(val) : val;
            return isNaN(num) ? 0 : num;
        }),

    taxType: z.enum(['percent', 'flat'])
        .optional()
        .nullable()
        .transform(val => val || 'percent'),

    discount: z.union([z.string(), z.number()])
        .optional()
        .nullable()
        .transform(val => {
            if (!val) return 0;
            const num = typeof val === 'string' ? parseFloat(val) : val;
            return isNaN(num) ? 0 : num;
        }),

    discountType: z.enum(['percent', 'flat'])
        .optional()
        .nullable()
        .transform(val => val || 'percent'),

    shippingCost: z.union([z.string(), z.number()])
        .optional()
        .nullable()
        .transform(val => {
            if (!val) return 0;
            const num = typeof val === 'string' ? parseFloat(val) : val;
            return isNaN(num) ? 0 : num;
        }),

    multiplyShippingCost: z.union([z.string(), z.boolean()])
        .optional()
        .nullable()
        .transform(val => {
            if (typeof val === 'boolean') return val;
            if (typeof val === 'string') {
                const lower = val.toLowerCase().trim();
                return lower === 'true' || lower === 'yes' || lower === '1';
            }
            return false;
        }),

    quantity: z.union([z.string(), z.number()])
        .transform(val => typeof val === 'string' ? parseInt(val, 10) : val)
        .refine(val => !isNaN(val) && val >= 0 && Number.isInteger(val), 'Quantity must be a valid integer >= 0'),

    sku: z.string()
        .min(1, 'SKU is required')
        .max(100, 'SKU too long')
        .trim(),

    colors: z.string()
        .optional()
        .nullable()
        .transform(val => {
            if (!val) return [];
            return val.split(',').map(color => color.trim()).filter(color => color.length > 0);
        }),

    thumbnailUrl: z.string()
        .url('Invalid thumbnail URL')
        .optional()
        .nullable()
        .transform(val => val || undefined),

    imageUrls: z.string()
        .optional()
        .nullable()
        .transform(val => {
            if (!val) return [];
            return val.split(',').map(url => url.trim()).filter(url => url.length > 0);
        }),

    videoLink: z.string()
        .url('Invalid video URL')
        .optional()
        .nullable()
        .transform(val => val || undefined),

    metaTitle: z.string()
        .max(200, 'Meta title too long')
        .optional()
        .nullable()
        .transform(val => val || undefined),

    metaDescription: z.string()
        .max(500, 'Meta description too long')
        .optional()
        .nullable()
        .transform(val => val || undefined),

    metaImage: z.string()
        .url('Invalid meta image URL')
        .optional()
        .nullable()
        .transform(val => val || undefined),

    variations: z.string()
        .optional()
        .nullable()
        .transform(val => {
            if (!val || val.trim().length === 0) return [];
            try {
                const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                throw new Error('Invalid variations JSON format');
            }
        }),

    attributes: z.string()
        .optional()
        .nullable()
        .transform(val => {
            if (!val || val.trim().length === 0) return [];
            try {
                const parsed = typeof val === 'string' ? JSON.parse(val) : val;
                return Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                throw new Error('Invalid attributes JSON format');
            }
        })
});

/**
 * Parse Excel file and extract product data
 * 
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Promise<Array<Object>>} Array of product objects
 */
const parseExcelToJson = async (buffer) => {
    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const worksheet = workbook.worksheets[0];
        const jsonData = [];

        // header row is row 1
        const headerRow = worksheet.getRow(1);
        const headers = [];
        headerRow.eachCell((cell, colNumber) => {
            headers[colNumber] = cell.value?.toString();
        });

        // Iterate through rows starting from row 3 (after headers and descriptions)
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber <= 2) return;

            const rowData = {};
            row.eachCell((cell, colNumber) => {
                const header = headers[colNumber];
                if (header) {
                    // Extract value from cell, handle possible objects (especially for hyperlinked or formatted cells)
                    let value = cell.value;
                    if (value && typeof value === 'object' && value.result !== undefined) {
                        value = value.result;
                    } else if (value && typeof value === 'object' && value.text !== undefined) {
                        value = value.text;
                    }
                    rowData[header] = value;
                }
            });

            // Only add if row has data
            if (Object.keys(rowData).length > 0) {
                jsonData.push(rowData);
            }
        });

        return jsonData;
    } catch (error) {
        Logger.error('Excel parsing failed', { error: error.message });
        throw new AppError('Failed to parse Excel file. Please ensure it is a valid .xlsx file.', HTTP_STATUS.BAD_REQUEST);
    }
};

/**
 * Validate and resolve category/subcategory names to IDs
 */
const resolveCategoryIds = async (categoryName, subCategoryName) => {
    const category = await ProductCategoryRepository.findOne({ name: categoryName });

    if (!category) {
        throw new Error(`Category "${categoryName}" not found. Please ensure the category exists in the system.`);
    }

    let subCategoryId;

    if (subCategoryName) {
        const subCategory = await ProductSubCategoryRepository.findOne({
            name: subCategoryName,
            category: category._id
        });

        if (!subCategory) {
            throw new Error(`Subcategory "${subCategoryName}" not found under category "${categoryName}".`);
        }

        subCategoryId = subCategory._id.toString();
    }

    return {
        categoryId: category._id.toString(),
        subCategoryId
    };
};

/**
 * Validate single product row
 */
const validateProductRow = async (row, rowIndex) => {
    try {
        const validatedData = productRowSchema.parse(row);

        const { categoryId, subCategoryId } = await resolveCategoryIds(
            validatedData.category,
            validatedData.subCategory
        );

        const productData = {
            name: validatedData.name,
            description: validatedData.description,
            category: categoryId,
            subCategory: subCategoryId,
            brand: validatedData.brand,
            productType: validatedData.productType,
            unit: validatedData.unit,
            searchTags: validatedData.searchTags,
            price: validatedData.price,
            purchasePrice: validatedData.purchasePrice,
            tax: validatedData.tax,
            taxType: validatedData.taxType,
            discount: validatedData.discount,
            discountType: validatedData.discountType,
            shippingCost: validatedData.shippingCost,
            multiplyShippingCost: validatedData.multiplyShippingCost,
            quantity: validatedData.quantity,
            sku: validatedData.sku,
            colors: validatedData.colors,
            videoLink: validatedData.videoLink,
            variations: validatedData.variations,
            attributes: validatedData.attributes,

            _thumbnailUrl: validatedData.thumbnailUrl,
            _imageUrls: validatedData.imageUrls,

            seo: {
                metaTitle: validatedData.metaTitle,
                metaDescription: validatedData.metaDescription,
                metaImage: validatedData.metaImage
            }
        };

        return { success: true, data: productData, rowIndex };

    } catch (error) {
        if (error instanceof z.ZodError) {
            const fieldErrors = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
            }));

            return {
                success: false,
                rowIndex,
                errors: fieldErrors
            };
        }

        return {
            success: false,
            rowIndex,
            errors: [{ field: 'general', message: error.message }]
        };
    }
};

/**
 * Parse and validate Excel file for bulk product import
 */
export const parseProductExcel = async (buffer, vendorId) => {
    try {
        const rawData = await parseExcelToJson(buffer);

        if (rawData.length === 0) {
            throw new AppError('Excel file is empty. Please add at least one product.', HTTP_STATUS.BAD_REQUEST);
        }

        if (rawData.length > 500) {
            throw new AppError(`Too many products. Maximum 500 products per upload. Found: ${rawData.length}`, HTTP_STATUS.BAD_REQUEST);
        }

        Logger.info('Parsing Excel file for bulk import', {
            vendorId,
            rowCount: rawData.length
        });

        const validationResults = await Promise.all(
            rawData.map((row, index) => validateProductRow(row, index + 3)) // +3 because row 1 is headers, row 2 is descriptions
        );

        const successfulProducts = validationResults
            .filter(result => result.success)
            .map(result => ({ ...result.data, vendor: vendorId }));

        const failedValidations = validationResults.filter(result => !result.success);

        if (failedValidations.length > 0) {
            const errorReport = failedValidations.map(failure => ({
                row: failure.rowIndex,
                errors: failure.errors
            }));

            Logger.warn('Bulk import validation failed', {
                vendorId,
                totalRows: rawData.length,
                failedRows: failedValidations.length,
                errors: errorReport
            });

            return {
                success: false,
                errors: errorReport,
                message: `Validation failed for ${failedValidations.length} out of ${rawData.length} products. Please fix the errors and try again.`
            };
        }

        const skus = successfulProducts.map(p => p.sku);
        const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index);

        if (duplicateSkus.length > 0) {
            throw new AppError(
                `Duplicate SKUs found in Excel file: ${[...new Set(duplicateSkus)].join(', ')}. Each SKU must be unique.`,
                HTTP_STATUS.BAD_REQUEST
            );
        }

        Logger.info('Excel validation successful', {
            vendorId,
            productCount: successfulProducts.length
        });

        return {
            success: true,
            products: successfulProducts
        };

    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        Logger.error('Excel parsing failed', {
            vendorId,
            error: error.message,
            stack: error.stack
        });

        throw new AppError(
            `Failed to process Excel file: ${error.message}`,
            HTTP_STATUS.BAD_REQUEST
        );
    }
};
