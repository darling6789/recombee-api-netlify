const recombee = require('recombee-api-client');
const rqs = recombee.requests;

const client = new recombee.ApiClient(
  'irondev-dev', // Your Recombee DB
  'PDsRROOobUULxV4l3NT95L9tKxKZ2qMt9glC4qettpkqHyaQOr8glEuxuKcCn0iW', // PRIVATE token
  {
    region: 'eu-west'
  }
);

exports.handler = async (event) => {
  const productId = event.queryStringParameters.productId;
  const count = parseInt(event.queryStringParameters.count) || 8;
  const user_id = event.queryStringParameters.user_id; // <-- fixed typo here

  // Validate required parameters
  if (!productId || !user_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `"productId" and "user_id" are required.` }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    };
  }

  try {
    const response = await client.send(
      new rqs.RecommendItemsToItem(productId, user_id, count, {
        scenario: 'Look-a-likes',
        returnProperties: true,
        includedProperties: ['link', 'handle']
      })
    );

    const handles = response.recomms
      .map(item => item.values.handle)
      .filter(Boolean);

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
