import http from 'http';

async function testProdMode() {
  console.log('Testing production bundle in simulated production environment...');
  
  // Test endpoints on the running server
  const endpoints = [
    { name: 'Servers', path: '/api/onegridhub/servers' },
    { name: 'Countries (all1)', path: '/api/onegridhub/countries?server=all1' },
    { name: 'Services (all1, USA)', path: '/api/onegridhub/services?server=all1&country=1' },
    { name: 'Social Boost Services', path: '/api/social-boost/services' },
    { name: 'Social Boost Pricing Settings', path: '/api/social-boost/pricing-settings' },
    { name: 'Health Check', path: '/api/health' }
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`http://127.0.0.1:3000${ep.path}`, {
        headers: { 'Accept': 'application/json, text/plain, */*' }
      });
      const ct = res.headers.get('content-type') || '';
      console.log(`\nEndpoint: ${ep.name} (${ep.path})`);
      console.log(`Status: ${res.status}`);
      console.log(`Content-Type: ${ct}`);
      
      if (ct.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data)) {
          console.log(`Payload: Array with ${data.length} items. First item:`, JSON.stringify(data[0]));
        } else if (data.services && Array.isArray(data.services)) {
          console.log(`Payload: Object with ${data.services.length} services. First item:`, JSON.stringify(data.services[0]));
        } else {
          console.log(`Payload keys:`, Object.keys(data));
        }
      } else {
        const text = await res.text();
        console.log(`Non-JSON response (first 100 chars):`, text.slice(0, 100));
      }
    } catch (err) {
      console.error(`Error testing ${ep.name}:`, err.message);
    }
  }
}

testProdMode();
