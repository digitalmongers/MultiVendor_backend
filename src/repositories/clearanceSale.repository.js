import ClearanceSale from '../models/clearanceSale.model.js';
import BaseRepository from './base.repository.js';

class ClearanceSaleRepository extends BaseRepository {
    constructor() {
        super(ClearanceSale);
    }

    async findByVendor(vendorId) {
        return await this.model.findOne({ vendor: vendorId, isAdmin: false }).populate('products.product').lean();
    }

    async findAdminSale() {
        return await this.model.findOne({ isAdmin: true }).populate('products.product').lean();
    }

    async findAllActive(limit = 10) {
        const now = new Date();
        return await this.model.find({
            isActive: true,
            startDate: { $lte: now },
            expireDate: { $gte: now }
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('products.product')
            .lean();
    }

    async addProducts(vendorId, productIds, isAdmin = false) {
        const query = isAdmin ? { isAdmin: true } : { vendor: vendorId, isAdmin: false };
        const sale = await this.model.findOne(query);
        if (!sale) return null;

        productIds.forEach(id => {
            const exists = sale.products.find(p => p.product.toString() === id.toString());
            if (!exists) {
                sale.products.push({ product: id, isActive: true });
            }
        });

        return await sale.save();
    }

    async removeProduct(vendorId, productId, isAdmin = false) {
        const query = isAdmin ? { isAdmin: true } : { vendor: vendorId, isAdmin: false };
        return await this.model.findOneAndUpdate(
            query,
            { $pull: { products: { product: productId } } },
            { new: true }
        );
    }

    async toggleProductStatus(vendorId, productId, isActive, isAdmin = false) {
        const query = isAdmin ? { isAdmin: true, 'products.product': productId } : { vendor: vendorId, isAdmin: false, 'products.product': productId };
        return await this.model.findOneAndUpdate(
            query,
            { $set: { 'products.$.isActive': isActive } },
            { new: true }
        );
    }
}

export default new ClearanceSaleRepository();
