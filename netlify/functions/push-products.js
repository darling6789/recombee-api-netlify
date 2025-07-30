const fetch = require('node-fetch');
const recombee = require('recombee-api-client');
const rqs = recombee.requests;

const client = new recombee.ApiClient(
  'irondev-dev',
  'PDsRROOobUULxV4l3NT95L9tKxKZ2qMt9glC4qettpkqHyaQOr8glEuxuKcCn0iW',
  { region: 'eu-west' }
);

(async () => {
  try {
    const shop = 'well-doe.myshopify.com';

    const res = await fetch(`https://${shop}/admin/api/2023-01/products.json?limit=250`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const json = await res.json();
    const products = json.products;

    if (!products || products.length === 0) {
      console.log('No products found.');
      return;
    }

    const requests = products.map(product => {
      return new rqs.SetItemValues(product.id.toString(), {
        handle: product.handle,
        link: `https://${shop}/products/${product.handle}`
      }, { cascadeCreate: true });
    });

    const result = await client.send(new rqs.Batch(requests));
    console.log('Successfully added:', products.length);
  } catch (error) {
    console.error('Error pushing products:', error);
  }
})();
