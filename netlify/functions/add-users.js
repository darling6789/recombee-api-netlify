const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const fetch = require('node-fetch');
const recombee = require('recombee-api-client');
const rqs = recombee.requests;

// Debug: Check environment variables
console.log('Environment variables loaded:');
console.log('SHOPIFY_STORE:', process.env.SHOPIFY_STORE);
console.log('RECOMBEE_DATABASE_ID:', process.env.RECOMBEE_DATABASE_ID);
console.log('SHOPIFY_ACCESS_TOKEN:', process.env.SHOPIFY_ACCESS_TOKEN ? '***' : 'undefined');

// Try without region specification first
const client = new recombee.ApiClient(
  process.env.RECOMBEE_DATABASE_ID,
  process.env.RECOMBEE_PRIVATE_TOKEN
);

console.log('Recombee client created with database:', process.env.RECOMBEE_DATABASE_ID);

(async () => {
  try {
    const shop = process.env.SHOPIFY_STORE;
    const apiUrl = `https://${shop}/admin/api/2023-01/customers.json?limit=250`;
    
    console.log('Fetching customers from:', apiUrl);

    const res = await fetch(apiUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
      }
    });

    console.log('Response status:', res.status);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('API Error:', errorText);
      return;
    }

    const json = await res.json();
    const customers = json.customers;

    if (!customers || customers.length === 0) {
      console.log('No customers found.');
      return;
    }

    console.log(`Found ${customers.length} customers`);

    // Try adding users one by one instead of batch
    for (const customer of customers) {
      try {
        console.log(`Adding user ${customer.id} to Recombee...`);
        const result = await client.send(new rqs.AddUser(customer.id.toString()));
        console.log(`Successfully added user ${customer.id}:`, result);
      } catch (error) {
        console.error(`Failed to add user ${customer.id}:`, error.message);
      }
    }
    
    console.log('Finished processing all customers');
  } catch (error) {
    console.error('Error:', error);
  }
})();
