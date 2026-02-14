import FlashDeal from '../models/flashDeal.model.js';
import BaseRepository from './base.repository.js';

class FlashDealRepository extends BaseRepository {
    constructor() {
        super(FlashDeal);
    }

    async findAllWithStats(filter = {}, sort = { createdAt: -1 }, page = 1, limit = 10) {
        const skip = (page - 1) * limit;

        // Fetch deals and populate product count
        const deals = await this.model.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean({ virtuals: true });

        const total = await this.model.countDocuments(filter);

        return {
            data: deals,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async findByIdPopulated(id) {
        return await this.model.findById(id).populate('products.product').lean();
    }

    async addProducts(dealId, productData) {
        // productData is array of { product: id, discount: X, discountType: Y }
        const deal = await this.model.findById(dealId);
        if (!deal) return null;

        productData.forEach(item => {
            const exists = deal.products.find(p => p.product.toString() === item.product.toString());
            if (!exists) {
                deal.products.push(item);
            }
        });

        return await deal.save();
    }

    async removeProduct(dealId, productId) {
        return await this.model.findByIdAndUpdate(
            dealId,
            { $pull: { products: { product: productId } } },
            { new: true }
        );
    }

    async togglePublish(dealId, isPublished) {
        return await this.model.findByIdAndUpdate(
            dealId,
            { isPublished },
            { new: true }
        );
    }

    async toggleProductStatus(dealId, productId, isActive) {
        return await this.model.findOneAndUpdate(
            { _id: dealId, 'products.product': productId },
            { $set: { 'products.$.isActive': isActive } },
            { new: true }
        );
    }
}

export default new FlashDealRepository();
