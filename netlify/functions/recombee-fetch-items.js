const recombee = require('recombee-api-client');
const rqs = recombee.requests;

const client = new recombee.ApiClient(
  'irondev-dev',
  'PDsRROOobUULxV4l3NT95L9tKxKZ2qMt9glC4qettpkqHyaQOr8glEuxuKcCn0iW',
  {
    region: 'eu-west'
  }
);

// Market-to-language mapping for Shopify Markets
const MARKET_CONFIG = {
  'da': { country: 'DK', language: 'da' },
  'de': { country: 'DE', language: 'de' },
  'en-us': { country: 'US', language: 'en' },
  'it-it': { country: 'IT', language: 'it' },
  'en': { country: 'US', language: 'en' } // default
};

// Function to fetch product data from Shopify Storefront API with proper market support
async function fetchShopifyProducts(handles, shopDomain, accessToken, market = 'en') {
  const marketConfig = MARKET_CONFIG[market] || MARKET_CONFIG['en'];
  
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
              maxVariantPrice {
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
            images(first: 5) {
              edges {
                node {
                  url
                  altText
                  width
                  height
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  availableForSale
                  quantityAvailable
                  selectedOptions {
                    name
                    value
                  }
                  price {
                    amount
                    currencyCode
                  }
                  compareAtPrice {
                    amount
                    currencyCode
                  }
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
            options {
              name
              values
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
    'X-Shopify-Storefront-Access-Token': accessToken,
    'Accept-Language': marketConfig.language
  };

  // Set proper buyer context for market-specific pricing and availability
  if (market && market !== 'en') {
    headers['Shopify-Storefront-Buyer-Context'] = JSON.stringify({
      country: marketConfig.country,
      language: marketConfig.language
    });
  }

  try {
    const response = await fetch(`https://${shopDomain}/api/2023-10/graphql.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      console.error(`Shopify API error: ${response.status} - ${response.statusText}`);
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('Shopify GraphQL errors:', data.errors);
      throw new Error('Shopify GraphQL errors');
    }

    return data.data.products.edges.map(edge => edge.node);
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    return [];
  }
}

// Enhanced market detection with better fallbacks
function detectMarket(event) {
  // Priority 1: URL path detection (most accurate)
  const referer = event.headers.referer || event.headers.Referer || '';
  const marketMatch = referer.match(/\/([a-z]{2}(?:-[a-z]{2})?)\//);
  if (marketMatch && MARKET_CONFIG[marketMatch[1]]) {
    return marketMatch[1];
  }
  
  // Priority 2: Query parameter
  if (event.queryStringParameters?.market && MARKET_CONFIG[event.queryStringParameters.market]) {
    return event.queryStringParameters.market;
  }
  
  // Priority 3: Accept-Language header
  const acceptLanguage = event.headers['accept-language'] || event.headers['Accept-Language'] || '';
  const langMatch = acceptLanguage.match(/^([a-z]{2})/);
  const detectedLang = langMatch ? langMatch[1] : 'en';
  
  // Map language to supported markets
  const languageToMarket = {
    'da': 'da',
    'de': 'de', 
    'it': 'it-it',
    'en': 'en'
  };
  
  return languageToMarket[detectedLang] || 'en';
}

// Generate proper user ID based on customer or session
function generateUserId(event) {
  // Check for customer ID first (logged in users)
  const customerId = event.queryStringParameters.customer_id;
  if (customerId && customerId !== 'null' && customerId !== 'undefined') {
    return `customer-${customerId}`;
  }
  
  // Check for session ID from cookies or headers
  const cookies = event.headers.cookie || '';
  const sessionMatch = cookies.match(/cart=([^;]+)/);
  if (sessionMatch) {
    return `session-${sessionMatch[1]}`;
  }
  
  // Generate consistent anonymous ID based on IP and User-Agent
  const userAgent = event.headers['user-agent'] || '';
  const clientIP = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
  const hash = require('crypto')
    .createHash('md5')
    .update(`${clientIP}-${userAgent}`)
    .digest('hex')
    .substring(0, 16);
    
  return `anon-${hash}`;
}

exports.handler = async (event) => {
  // Set CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, cache-control',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Extract and validate parameters
  const product_id = event.queryStringParameters?.product_id;
  const count = parseInt(event.queryStringParameters?.count) || 8;
  const shop_domain = event.queryStringParameters?.shop_domain;
  const storefront_token = event.queryStringParameters?.storefront_token;
  
  // Detect market and generate user ID
  const market = detectMarket(event);
  const user_id = null;
  
  // Validate required parameters
  if (!product_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'product_id is required',
        received: event.queryStringParameters 
      }),
      headers: corsHeaders
    };
  }

  if (!shop_domain || !storefront_token) {
    return {
      statusCode: 400,
      body: JSON.stringify({ 
        error: 'shop_domain and storefront_token are required',
        received: {
          shop_domain: !!shop_domain,
          storefront_token: !!storefront_token
        }
      }),
      headers: corsHeaders
    };
  }

  try {
    console.log(`Fetching recommendations for product ${product_id}, user ${user_id}, market ${market}`);
    
    // Get recommendations from Recombee with enhanced parameters
    const recombeeResponse = await client.send(
      new rqs.RecommendItemsToItem(product_id, user_id, count, {
        scenario: 'Look-a-likes',
        returnProperties: true,
        includedProperties: ['link', 'handle', 'title', 'price', 'available'],
        filter: 'available', // Only recommend available products
        booster: 'if price then price else 1', // Boost by price relevance
        cascadeCreate: true, // Create user profile if doesn't exist
        expertSettings: {
          'diversity': 0.1 // Add some diversity to recommendations
        }
      })
    );

    console.log(`Recombee returned ${recombeeResponse.recomms.length} recommendations`);

    // Extract handles from Recombee response, filtering out empty values
    const handles = recombeeResponse.recomms
      .map(item => item.values?.handle)
      .filter(handle => handle && typeof handle === 'string' && handle.trim().length > 0);

    if (handles.length === 0) {
      console.log('No valid handles found in Recombee response');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          products: [], 
          market,
          user_id,
          recommId: recombeeResponse.recommId,
          message: 'No recommendations available',
          debug: {
            recombeeCount: recombeeResponse.recomms.length,
            validHandles: 0
          }
        }),
        headers: corsHeaders
      };
    }

    console.log(`Fetching ${handles.length} products from Shopify:`, handles);

    // Fetch full product data from Shopify with market context
    const products = await fetchShopifyProducts(handles, shop_domain, storefront_token, market);
    
    console.log(`Shopify returned ${products.length} products`);

    // Filter and order products based on Recombee recommendations
    const orderedProducts = handles
      .map(handle => products.find(p => p.handle === handle))
      .filter(product => {
        if (!product) return false;
        
        // Check availability
        if (!product.availableForSale) return false;
        
        // Check if any variant is available
        const hasAvailableVariant = product.variants.edges.some(
          variant => variant.node.availableForSale && variant.node.quantityAvailable > 0
        );
        
        return hasAvailableVariant;
      })
      .slice(0, count); // Ensure we don't exceed requested count

    console.log(`Final filtered products: ${orderedProducts.length}`);

    // Build response with comprehensive data
    const response = {
      products: orderedProducts,
      market,
      user_id,
      recommId: recombeeResponse.recommId,
      metadata: {
        totalRecommended: recombeeResponse.recomms.length,
        validHandles: handles.length,
        productsFound: products.length,
        productsReturned: orderedProducts.length,
        marketConfig: MARKET_CONFIG[market]
      },
      success: true
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
      headers: corsHeaders
    };

  } catch (error) {
    console.error('Server error:', {
      message: error.message,
      stack: error.stack,
      product_id,
      user_id,
      market
    });

    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message,
        product_id,
        user_id,
        market,
        success: false
      }),
      headers: corsHeaders
    };
  }
};
