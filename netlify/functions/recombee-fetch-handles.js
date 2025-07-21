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
  const product_id = event.queryStringParameters.product_id;
  const count = parseInt(event.queryStringParameters.count) || 8;
  const user_id = event.queryStringParameters.user_id; // <-- fixed typo here

  // Validate required parameters
  if (!product_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `"product_id" is required.` }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    };
  }

  if (!user_id) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `"user_id" is required.` }),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    };
  }

  try {
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
