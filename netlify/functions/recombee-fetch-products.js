const recombee = require('recombee-api-client');
const rqs = recombee.requests;

const client = new recombee.ApiClient(
  'irondev-dev', // Your Recombee DB
  'PDsRROOobUULxV4l3NT95L9tKxKZ2qMt9glC4qettpkqHyaQOr8glEuxuKcCn0iW', // PRIVATE token
  {
    region: 'eu-west'
  }
);

// Function to fetch product data from Shopify Storefront API
async function fetchShopifyProducts(handles, shopDomain, accessToken, market = null) {
  const query = `
    query getProducts($query: String!) {
      products(first: 20, query: $query) {
        edges {
          node {
            id
            handle
            title
            vendor
            description
            tags
            availableForSale
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            compareAtPriceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            images(first: 3) {
              edges {
                node {
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  availableForSale
                  quantityAvailable
                }
              }
            }
            collections(first: 5) {
              edges {
                node {
                  handle
                  title
                }
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    query: handles.map(handle => `handle:${handle}`).join(' OR ')
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Storefront-Access-Token': accessToken
  };

  // Add market context if provided
  if (market) {
    headers['Shopify-Storefront-Buyer-Context'] = JSON.stringify({
      country: market.toUpperCase(),
      language: market.toLowerCase()
    });
  }

  try {
    const response = await fetch(`https://${shopDomain}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.products.edges.map(edge => edge.node);
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    return [];
  }
}

// Function to determine market from URL or headers
function detectMarket(event) {
  const referer = event.headers.referer || '';
  const acceptLanguage = event.headers['accept-language'] || '';
  
  // Extract market from URL path (e.g., /da, /de, /en-us, /it-it)
  const marketMatch = referer.match(/\/([a-z]{2}(?:-[a-z]{2})?)\//);
  if (marketMatch) {
    return marketMatch[1];
  }
  
  // Fallback to accept-language header
  const langMatch = acceptLanguage.match(/^([a-z]{2})/);
  return langMatch ? langMatch[1] : 'en';
}

exports.handler = async (event) => {
  const product_id = event.queryStringParameters.product_id;
  const count = parseInt(event.queryStringParameters.count) || 8;
  const user_id = event.queryStringParameters.user_id || 'anonymous-user';
  const shop_domain = event.queryStringParameters.shop_domain;
  const storefront_token = event.queryStringParameters.storefront_token;
  
  // Detect market for localization
  const market = detectMarket(event);

  // Validate required parameters
  if (!product_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: '"product_id" is required.' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    };
  }

  if (!shop_domain || !storefront_token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: '"shop_domain" and "storefront_token" are required.' }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    };
  }

  try {
    // Get recommendations from Recombee
    const response = await client.send(
      new rqs.RecommendItemsToItem(product_id, user_id, count, {
        scenario: 'Look-a-likes',
        returnProperties: true,
        includedProperties: ['link', 'handle']
      })
    );

    const handles = response.recomms
      .map(item => item.values.handle)
      .filter(Boolean);

    if (handles.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({ products: [], market, recommId: response.recommId }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      };
    }

    // Fetch full product data from Shopify
    const products = await fetchShopifyProducts(handles, shop_domain, storefront_token, market);
    
    // Filter out unavailable products and maintain order from Recombee
    const orderedProducts = handles
      .map(handle => products.find(p => p.handle === handle))
      .filter(product => product && product.availableForSale);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        handles: handles,
        products: orderedProducts, 
        market,
        recommId: response.recommId,
        totalFound: products.length,
        totalAvailable: orderedProducts.length
      }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    };
  } catch (err) {
    console.error('Recombee or Shopify error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    };
  }
};