const recombee = require('recombee-api-client');
const rqs = recombee.requests;

const client = new recombee.ApiClient(
  'the-jewellery-room-dev',
  'HBazspyHEEpo9jcv6mugz9DI49HXAEQXNn4h8mRbVQs46ikWC8xNjHTZpn9iImLa',
  { region: 'eu-west' }
);

exports.handler = async (event) => {
  const productId = event.queryStringParameters.productId;
  const count = parseInt(event.queryStringParameters.count) || 8;

  try {
    const response = await client.send(
      new rqs.RecommendItemsToItem(productId, 'anon-guest-123', count, {
        scenario: 'Look-a-likes',
        returnProperties: true,
        includedProperties: ['link', 'handle']
      })
    );

    const handles = response.recomms.map(item => item.values.handle).filter(Boolean);

    return {
      statusCode: 200,
      body: JSON.stringify({ handles }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};
