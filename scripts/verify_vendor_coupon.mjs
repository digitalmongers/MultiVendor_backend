import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import CartService from '../src/services/cart.service.js';
import CartRepository from '../src/repositories/cart.repository.js';
import Coupon from '../src/models/coupon.model.js';
import Product from '../src/models/product.model.js';
import Vendor from '../src/models/vendor.model.js';
import Cart from '../src/models/cart.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/multivendor';

const setup = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};

const runVerification = async () => {
    await setup();

    try {
        console.log('\n--- Starting Vendor Coupon Verification ---\n');

        // 1. Get or Create Vendors
        let vendorA = await Vendor.findOne({ email: 'vendorA@test.com' });
        if (!vendorA) {
            vendorA = await Vendor.create({
                email: 'vendorA@test.com',
                password: 'password123',
                phoneNumber: '9876543210',
                firstName: 'Vendor',
                lastName: 'A',
                role: 'vendor',
                status: 'active'
            });
        }
        console.log(`Vendor A ID: ${vendorA._id}`);

        let vendorB = await Vendor.findOne({ email: 'vendorB@test.com' });
        if (!vendorB) {
            vendorB = await Vendor.create({
                email: 'vendorB@test.com',
                password: 'password123',
                phoneNumber: '9876543211',
                firstName: 'Vendor',
                lastName: 'B',
                role: 'vendor',
                status: 'active'
            });
        }
        console.log(`Vendor B ID: ${vendorB._id}`);

        // 2. Create Products for each Vendor
        // Product A (Vendor A) - Price 100
        let productA = await Product.findOne({ sku: 'TEST-PROD-A' });
        if (!productA) {
            productA = await Product.create({
                name: 'Test Product A',
                slug: 'test-product-a',
                description: 'Description A',
                category: new mongoose.Types.ObjectId(), // Fake ID
                productType: 'physical',
                unit: 'pc',
                price: 100,
                quantity: 100,
                sku: 'TEST-PROD-A',
                vendor: vendorA._id,
                status: 'approved',
                isActive: true,
                images: [{ url: 'http://example.com/a.jpg', publicId: 'a' }],
                thumbnail: { url: 'http://example.com/a_thumb.jpg', publicId: 'a_thumb' }
            });
        }
        console.log(`Product A (Vendor A) created. Price: ${productA.price}`);

        // Product B (Vendor B) - Price 200
        let productB = await Product.findOne({ sku: 'TEST-PROD-B' });
        if (!productB) {
            productB = await Product.create({
                name: 'Test Product B',
                slug: 'test-product-b',
                description: 'Description B',
                category: new mongoose.Types.ObjectId(), // Fake ID
                productType: 'physical',
                unit: 'pc',
                price: 200,
                quantity: 100,
                sku: 'TEST-PROD-B',
                vendor: vendorB._id, // DIFFERENT VENDOR
                status: 'approved',
                isActive: true,
                images: [{ url: 'http://example.com/b.jpg', publicId: 'b' }],
                thumbnail: { url: 'http://example.com/b_thumb.jpg', publicId: 'b_thumb' }
            });
        }
        console.log(`Product B (Vendor B) created. Price: ${productB.price}`);

        // 3. Create Coupon for Vendor A
        // 10% Off, Min Purchase 50
        const couponCode = 'VENDOR-A-10';
        await Coupon.deleteOne({ code: couponCode }); // Cleanup prev run
        const coupon = await Coupon.create({
            vendor: vendorA._id, // LINKED TO VENDOR A
            title: 'Vendor A 10% Off',
            code: couponCode,
            type: 'discount_on_purchase',
            discountType: 'percent',
            discountAmount: 10, // 10%
            minPurchase: 50,
            startDate: new Date(),
            expireDate: new Date(Date.now() + 86400000), // Tomorrow
            isActive: true
        });
        console.log(`Coupon ${couponCode} created for Vendor A. 10% discount.`);

        // 4. Setup Cart
        const guestId = 'verify-guest-' + Date.now();
        console.log(`Using Cart Guest ID: ${guestId}`);

        // Add Product A (Should be eligible)
        await CartService.addToCart({ guestId }, {
            productId: productA._id,
            quantity: 1
        });
        console.log('Added Product A to Cart');

        // Add Product B (Should NOT be eligible)
        await CartService.addToCart({ guestId }, {
            productId: productB._id,
            quantity: 1
        });
        console.log('Added Product B to Cart');

        const cartBefore = await CartService.getCart({ guestId });
        console.log(`Cart Subtotal Before Coupon: ${cartBefore.summary.subtotal}`);

        // 5. Apply Coupon
        console.log(`Applying coupon ${couponCode}...`);
        const cartAfter = await CartService.applyCoupon({ guestId }, couponCode);

        console.log('\n--- Verification Results ---');
        console.log(`Subtotal: ${cartAfter.summary.subtotal}`);
        console.log(`Coupon Discount: ${cartAfter.summary.couponDiscount}`);
        console.log(`Total: ${cartAfter.summary.total}`);

        // EXPECTED CALCULATION:
        // Product A: 100 -> Eligible for 10% -> Discount = 10
        // Product B: 200 -> NOT Eligible -> Discount = 0
        // Total Discount Should be 10.

        if (cartAfter.summary.couponDiscount === 10) {
            console.log('SUCCESS: Coupon discount is 10 (Correctly applied only to Product A)');
        } else {
            console.log(`FAILURE: Expected discount 10, got ${cartAfter.summary.couponDiscount}`);
            // Check if it applied to all (10% of 300 = 30)
            if (cartAfter.summary.couponDiscount === 30) {
                console.log('DIAGNOSIS: Coupon applied to ALL items (Vendor check failed)');
            }
        }

    } catch (error) {
        console.error('Verification Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

runVerification();
