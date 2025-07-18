const fetch = require('node-fetch');

exports.handler = async (event) => {
  const params = event.queryStringParameters;
  const productId = params?.product_id;
  const userId = params?.user_id || 'anon-guest-123';

  if (!productId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing product_id' }),
    };
  }

  const API_URL = `https://rapi.recombee.com/recomms/users/${userId}/items/${productId}/recommendations`;
  const PRIVATE_TOKEN = 'HBazspyHEEpo9jcv6mugz9DI49HXAEQXNn4h8mRbVQs46ikWC8xNjHTZpn9iImLa';

  try {
    const response = await fetch(`${API_URL}?count=12`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${PRIVATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scenario: 'Look-a-likes',
        returnProperties: true,
        includedProperties: ['link', 'itemId'],
      }),
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to fetch from Recombee' }),
      };
    }

    const data = await response.json();

    // Extract product handles (or IDs) from Recombee response
    const recommended_handles = data.recomms
      .map(item => {
        // Try extracting Shopify handle from Recombee "link"
        const match = item.values?.link?.match(/\/products\/([\w-]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    return {
      statusCode: 200,
      body: JSON.stringify({ handles: recommended_handles }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', details: error.message }),
    };
  }
};
