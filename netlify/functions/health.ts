export const handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'ok', service: 'ZENET Marketplace Serverless Netlify API' })
  };
};
