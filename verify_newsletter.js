import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5001/api/v1';

async function verifyNewsletter() {
  console.log('--- Newsletter Subscription Verification Started ---');

  try {
    const testEmail = `test_subscriber_${Date.now()}@example.com`;

    // 1. Subscribe
    console.log(`\nSTEP 1: Subscribing email: ${testEmail}`);
    const subRes = await axios.post(`${BASE_URL}/newsletter/subscribe`, {
      email: testEmail
    });
    
    console.log('Response Message:', subRes.data.message);
    if (subRes.data.success) {
      console.log('✅ Subscription successful!');
    } else {
      console.log('❌ Subscription failed.');
    }

    // 2. Try subscribing same email again (should be idempotent / update)
    console.log(`\nSTEP 2: Re-subscribing same email: ${testEmail}`);
    const subRes2 = await axios.post(`${BASE_URL}/newsletter/subscribe`, {
      email: testEmail
    });
    console.log('Response Message:', subRes2.data.message);
    if (subRes2.data.success) {
      console.log('✅ Re-subscription handled correctly!');
    }

    // 3. Verify Admin Access (Login first)
    console.log('\nSTEP 3: Checking Admin Access to Subscribers');
    const loginRes = await axios.post(`${BASE_URL}/admin/auth/login`, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    });
    const token = loginRes.data.data.tokens.accessToken;

    const listRes = await axios.get(`${BASE_URL}/newsletter/admin/subscribers`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Check if total and subscribers are present (Pagination format)
    if (listRes.data.data.subscribers && listRes.data.data.pagination) {
      console.log('✅ Admin list returned in pagination format!');
      console.log('Total Subscribers:', listRes.data.data.pagination.total);
    }

    // 4. Test Filtering (Search)
    console.log(`\nSTEP 4: Testing Search for ${testEmail}`);
    const searchRes = await axios.get(`${BASE_URL}/newsletter/admin/subscribers?search=${testEmail}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (searchRes.data.data.subscribers.length === 1) {
      console.log('✅ Search filter works!');
    }

    // 5. Test Sorting
    console.log('\nSTEP 5: Testing Sorting (Email A-Z)');
    const sortRes = await axios.get(`${BASE_URL}/newsletter/admin/subscribers?sortBy=emailAZ`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const emails = sortRes.data.data.subscribers.map(s => s.email);
    console.log('Sorted Emails (Sample):', emails.slice(0, 3));
    
    console.log('\n--- Verification Finished ---');
  } catch (error) {
    console.error('❌ Verification Error:', error.response?.data || error.message);
  }
}

verifyNewsletter();
