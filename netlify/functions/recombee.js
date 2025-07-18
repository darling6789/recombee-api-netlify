const fetch = require('node-fetch');

exports.handler = async (event) => {
  const productId = event.queryStringParameters.product_id;
  const userId = event.queryStringParameters.user_id || 'anon-guest-123';

  if (!productId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing product_id' }),
    };
  }

  const API_URL = `https://rapi.recombee.com/recomms/users/${userId}/items/${productId}/recommendations`;
  const PRIVATE_TOKEN = 'HBazspyHEEpo9jcv6mugz9DI49HXAEQXNn4h8mRbVQs46ikWC8xNjHTZpn9iImLa';

  try {
    const recombeeResponse = await fetch(`${API_URL}?count=12`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${PRIVATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scenario: 'Look-a-likes',
        returnProperties: true,
        includedProperties: ['link'],
      }),
    });

    if (!recombeeResponse.ok) {
      return {
        statusCode: recombeeResponse.status,
        body: JSON.stringify({ error: 'Failed to fetch from Recombee' }),
      };
    }

    const data = await recombeeResponse.json();

    // Return just the item IDs (or full properties if needed)
    const recommended = data.recomms.map(item => item.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ recommended_items: recommended }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', details: error.message }),
    };
  }
};
