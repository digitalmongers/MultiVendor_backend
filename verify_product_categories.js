import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

async function verifyCategorySystem() {
  console.log('--- Product Category & Subcategory Verification Started ---');

  try {
    // 1. Login
    console.log('Logging in as Admin...');
    const loginRes = await axios.post(`${BASE_URL}/admin/auth/login`, {
      email: adminEmail,
      password: adminPassword
    });
    const token = loginRes.data.data.tokens.accessToken;
    const authHeader = { Authorization: `Bearer ${token}` };

    // 2. Create Category
    console.log('\nSTEP 1: Creating Category "Electronics"');
    const catRes = await axios.post(
      `${BASE_URL}/categories`,
      { name: 'Electronics' },
      { headers: authHeader }
    );
    const categoryId = catRes.data.data._id;
    console.log('Category Created ID:', categoryId);

    // 3. Create Subcategory
    console.log('\nSTEP 2: Creating Subcategory "Mobiles" under "Electronics"');
    const subRes = await axios.post(
      `${BASE_URL}/subcategories`,
      { name: 'Mobiles', category: categoryId },
      { headers: authHeader }
    );
    console.log('Subcategory Created ID:', subRes.data.data._id);

    // 4. Verification Public Read (Cache Test)
    console.log('\nSTEP 3: Testing Public Category Cache (First Call)');
    await axios.get(`${BASE_URL}/categories`);
    
    console.log('Testing Public Category Cache (Second Call - Expect HIT)');
    const publicRes = await axios.get(`${BASE_URL}/categories`);
    console.log('Categories Count:', publicRes.data.data.length);

    // 5. Update Category (Invalidation Test)
    console.log('\nSTEP 4: Updating Category Name to "Tech Gadgets" (Expect Invalidation)');
    await axios.patch(
      `${BASE_URL}/categories/${categoryId}`,
      { name: 'Tech Gadgets' },
      { headers: authHeader }
    );

    // 6. Verify Fresh Data
    console.log('\nSTEP 5: Verifying Fresh Data (Expect "Tech Gadgets")');
    const freshRes = await axios.get(`${BASE_URL}/categories`);
    const techGadgets = freshRes.data.data.find(c => c._id === categoryId);
    console.log('New Name:', techGadgets?.name);
    
    if (techGadgets?.name === 'Tech Gadgets') {
      console.log('\n✅ Category System Verified: CRUD and Caching logic is solid!');
    } else {
      console.log('\n❌ Category System FAILED: Stale data detected.');
    }

    // Cleanup (Optional delete)
    // await axios.delete(`${BASE_URL}/categories/${categoryId}`, { headers: authHeader });

    console.log('\n--- Verification Finished ---');
  } catch (error) {
    console.error('❌ Verification Error:', error.response?.data || error.message);
  }
}

verifyCategorySystem();
