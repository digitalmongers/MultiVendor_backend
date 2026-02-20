import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = 'http://localhost:5000/api/v1';

async function getProduct() {
    try {
        const response = await axios.get(`${API_URL}/products?limit=1`);
        const products = response.data.data.products;
        if (!products || products.length === 0) {
            throw new Error('No products found');
        }
        return products[0]._id;
    } catch (error) {
        console.error('Error fetching product:', error.message);
        process.exit(1);
    }
}

async function addToCart(productId, guestId) {
    try {
        await axios.post(
            `${API_URL}/cart`,
            { productId, quantity: 1 },
            { headers: { 'x-guest-id': guestId } }
        );
        return { status: 200, guestId };
    } catch (error) {
        return {
            status: error.response?.status || 500,
            guestId,
            message: error.response?.data?.message
        };
    }
}

async function runTests() {
    const productId = await getProduct();
    console.log(`Using Product ID: ${productId}`);

    console.log('\n--- Test 1: Concurrent requests from SAME guest ---');
    const guestId1 = uuidv4();
    const promisesSameGuest = [];
    for (let i = 0; i < 5; i++) {
        promisesSameGuest.push(addToCart(productId, guestId1));
    }
    const resultsSameGuest = await Promise.all(promisesSameGuest);

    const successes1 = resultsSameGuest.filter(r => r.status === 200).length;
    const rateLimits1 = resultsSameGuest.filter(r => r.status === 429).length;

    console.log(`Sent 5 requests. Success: ${successes1}, Rate Limited: ${rateLimits1}`);
    if (successes1 === 1 && rateLimits1 === 4) {
        console.log('✅ PASS: Lock prevented double-hit for same guest');
    } else {
        console.log('❌ FAIL: Locking logic failed for same guest');
        console.log(resultsSameGuest);
    }

    console.log('\n--- Test 2: Concurrent requests from DIFFERENT guests ---');
    const guestId2 = uuidv4();
    const guestId3 = uuidv4();

    const promisesDiffGuest = [
        addToCart(productId, guestId2),
        addToCart(productId, guestId3)
    ];

    const resultsDiffGuest = await Promise.all(promisesDiffGuest);
    const successes2 = resultsDiffGuest.filter(r => r.status === 200).length;

    console.log(`Sent 2 requests. Success: ${successes2}`);
    if (successes2 === 2) {
        console.log('✅ PASS: Different guests were NOT blocked');
    } else {
        console.log('❌ FAIL: Different guests were blocked');
        console.log(resultsDiffGuest);
    }
}

runTests();
